import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import crypto from 'crypto';
import { query, queryOne } from '../db';
import { hashPassword, verifyPassword } from '../utils/password';
import { signAccessToken, signRefreshToken, verifyRefreshToken, COOKIE_OPTIONS, ACCESS_COOKIE, REFRESH_COOKIE } from '../utils/jwt';
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/email';
import { sendError, sendValidationError } from '../utils/helpers';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { authRateLimiter } from '../middleware/rateLimiter';
import { writeAuditLog } from '../middleware/audit';
import { User, Invitation } from '../types';

const router = Router();

// POST /api/auth/register
router.post(
  '/register',
  authRateLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('invite_token').notEmpty().withMessage('Invite token required'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { sendValidationError(res, errors.array()); return; }

    const { email, password, invite_token } = req.body as { email: string; password: string; invite_token: string };

    // Validate invite token
    const tokenHash = crypto.createHash('sha256').update(invite_token).digest('hex');
    const invite = await queryOne<Invitation>(
      "SELECT * FROM invitations WHERE token_hash = $1 AND status = 'pending' AND expires_at > NOW()",
      [tokenHash]
    );
    if (!invite) { sendError(res, 400, 'Invalid or expired invite token'); return; }
    if (invite.email.toLowerCase() !== email.toLowerCase()) {
      sendError(res, 400, 'Email does not match invite'); return;
    }

    // Check existing user
    const existing = await queryOne<User>('SELECT id FROM users WHERE email = $1', [email]);
    if (existing) { sendError(res, 409, 'Email already registered'); return; }

    const passwordHash = await hashPassword(password);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const [user] = await query<User>(
      `INSERT INTO users (email, password_hash, verification_token, verification_token_expires_at)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [email, passwordHash, verificationToken, verificationExpiry]
    );

    // Join the family from invite
    await query(
      `INSERT INTO family_members (family_id, user_id, role, status, joined_at)
       VALUES ($1, $2, 'member', 'active', NOW())`,
      [invite.family_id, user.id]
    );

    // Mark invite used
    await query(
      "UPDATE invitations SET status = 'accepted', used_at = NOW() WHERE id = $1",
      [invite.id]
    );

    await sendVerificationEmail(email, verificationToken);
    await writeAuditLog({ entityType: 'user', entityId: user.id, action: 'register', newValue: { email } });

    res.status(201).json({ message: 'Registration successful. Please verify your email.' });
  }
);

// GET /api/auth/verify-email/:token
router.get('/verify-email/:token', async (req: Request, res: Response): Promise<void> => {
  const { token } = req.params;
  const user = await queryOne<User>(
    'SELECT * FROM users WHERE verification_token = $1 AND verification_token_expires_at > NOW()',
    [token]
  );
  if (!user) { sendError(res, 400, 'Invalid or expired verification token'); return; }

  await query(
    "UPDATE users SET verified = true, verification_token = NULL, verification_token_expires_at = NULL WHERE id = $1",
    [user.id]
  );
  await writeAuditLog({ entityType: 'user', entityId: user.id, action: 'verify_email' });

  res.json({ message: 'Email verified successfully.' });
});

// POST /api/auth/login
router.post(
  '/login',
  authRateLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { sendValidationError(res, errors.array()); return; }

    const { email, password } = req.body as { email: string; password: string };

    const user = await queryOne<User>('SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL', [email]);
    if (!user || !(await verifyPassword(user.password_hash, password))) {
      sendError(res, 401, 'Invalid email or password'); return;
    }
    if (!user.verified) { sendError(res, 403, 'Please verify your email first'); return; }

    const jwtPayload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = signAccessToken(jwtPayload);
    const refreshToken = signRefreshToken(jwtPayload);

    // Store refresh token
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, tokenHash, expiresAt]
    );

    res
      .cookie(ACCESS_COOKIE, accessToken, { ...COOKIE_OPTIONS, maxAge: 15 * 60 * 1000 })
      .cookie(REFRESH_COOKIE, refreshToken, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 })
      .json({ message: 'Login successful', user: { id: user.id, email: user.email, role: user.role } });
  }
);

// POST /api/auth/logout
router.post('/logout', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE];
  if (refreshToken) {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1', [tokenHash]);
  }
  res
    .clearCookie(ACCESS_COOKIE, COOKIE_OPTIONS)
    .clearCookie(REFRESH_COOKIE, COOKIE_OPTIONS)
    .json({ message: 'Logged out successfully' });
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE];
  if (!refreshToken) { sendError(res, 401, 'Refresh token required'); return; }

  try {
    const payload = verifyRefreshToken(refreshToken);
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const stored = await queryOne<{ id: string; user_id: string; revoked_at: Date | null }>(
      'SELECT * FROM refresh_tokens WHERE token_hash = $1 AND expires_at > NOW()',
      [tokenHash]
    );
    if (!stored || stored.revoked_at) {
      sendError(res, 401, 'Invalid or revoked refresh token'); return;
    }

    const user = await queryOne<User>('SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL', [payload.sub]);
    if (!user) { sendError(res, 401, 'User not found'); return; }

    // Rotate: revoke old, issue new
    await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1', [stored.id]);

    const newJwtPayload = { sub: user.id, email: user.email, role: user.role };
    const newAccessToken = signAccessToken(newJwtPayload);
    const newRefreshToken = signRefreshToken(newJwtPayload);
    const newTokenHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await query('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, newTokenHash, expiresAt]);

    res
      .cookie(ACCESS_COOKIE, newAccessToken, { ...COOKIE_OPTIONS, maxAge: 15 * 60 * 1000 })
      .cookie(REFRESH_COOKIE, newRefreshToken, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 })
      .json({ message: 'Token refreshed' });
  } catch {
    sendError(res, 401, 'Invalid refresh token');
  }
});

// POST /api/auth/forgot-password
router.post(
  '/forgot-password',
  authRateLimiter,
  [body('email').isEmail().normalizeEmail()],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { sendValidationError(res, errors.array()); return; }

    const { email } = req.body as { email: string };
    const user = await queryOne<User>('SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL', [email]);

    // Always respond the same to prevent user enumeration
    if (user) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await query(
        'UPDATE users SET password_reset_token = $1, password_reset_token_expires_at = $2 WHERE id = $3',
        [resetToken, expiresAt, user.id]
      );
      await sendPasswordResetEmail(email, resetToken);
    }

    res.json({ message: 'If that email exists, a reset link has been sent.' });
  }
);

// POST /api/auth/reset-password/:token
router.post(
  '/reset-password/:token',
  authRateLimiter,
  [body('password').isLength({ min: 8 })],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { sendValidationError(res, errors.array()); return; }

    const { token } = req.params;
    const { password } = req.body as { password: string };

    const user = await queryOne<User>(
      'SELECT * FROM users WHERE password_reset_token = $1 AND password_reset_token_expires_at > NOW()',
      [token]
    );
    if (!user) { sendError(res, 400, 'Invalid or expired reset token'); return; }

    const passwordHash = await hashPassword(password);
    await query(
      'UPDATE users SET password_hash = $1, password_reset_token = NULL, password_reset_token_expires_at = NULL WHERE id = $2',
      [passwordHash, user.id]
    );

    // Revoke all refresh tokens
    await query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL", [user.id]);
    await writeAuditLog({ entityType: 'user', entityId: user.id, action: 'password_reset' });

    res.json({ message: 'Password reset successfully.' });
  }
);

export default router;
