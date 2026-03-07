import { Router, Response } from 'express';
import { body, query as qv, validationResult } from 'express-validator';
import crypto from 'crypto';
import { query, queryOne } from '../db';
import { sendError, sendValidationError, slugify } from '../utils/helpers';
import { authenticateToken, requireVerified, requireAdmin, AuthRequest } from '../middleware/auth';
import { sendInviteEmail, sendJoinRequestEmail } from '../utils/email';
import { writeAuditLog } from '../middleware/audit';
import { Family, FamilyMember, Invitation, User } from '../types';

const router = Router();

// GET /api/families/mine
router.get('/mine',
  authenticateToken,
  requireVerified,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const families = await query(
      `SELECT f.id, f.name, f.slug, f.created_at, fm.role,
        (SELECT COUNT(*) FROM family_members m WHERE m.family_id = f.id AND m.status = 'active') AS member_count
       FROM families f
       JOIN family_members fm ON fm.family_id = f.id
       WHERE fm.user_id = $1 AND fm.status = 'active' AND f.deleted_at IS NULL
       ORDER BY f.name`,
      [userId]
    );
    res.json({ families });
  }
);

// GET /api/families/search?q=
router.get('/search',
  authenticateToken,
  requireVerified,
  [qv('q').optional().isString()],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { q } = req.query as { q?: string };
    const term = `%${q ?? ''}%`;
    const families = await query<Family>(
      "SELECT id, name, slug, created_at FROM families WHERE name ILIKE $1 AND deleted_at IS NULL ORDER BY name LIMIT 20",
      [term]
    );
    res.json({ families });
  }
);

// POST /api/families
router.post('/',
  authenticateToken,
  requireVerified,
  [body('name').trim().isLength({ min: 2, max: 100 })],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { sendValidationError(res, errors.array()); return; }

    const { name } = req.body as { name: string };
    const userId = req.user!.id;

    let slug = slugify(name);
    // Ensure unique slug
    const existing = await queryOne<{ id: string }>('SELECT id FROM families WHERE slug = $1', [slug]);
    if (existing) slug = `${slug}-${crypto.randomBytes(4).toString('hex')}`;

    const [family] = await query<Family>(
      'INSERT INTO families (name, slug, created_by) VALUES ($1, $2, $3) RETURNING *',
      [name, slug, userId]
    );

    // Creator becomes admin
    await query(
      "INSERT INTO family_members (family_id, user_id, role, status, joined_at) VALUES ($1, $2, 'admin', 'active', NOW())",
      [family.id, userId]
    );

    await writeAuditLog({ entityType: 'family', entityId: family.id, action: 'create', actorId: userId, newValue: { name } });

    res.status(201).json({ family });
  }
);

// POST /api/families/:id/invite (admin only)
router.post('/:id/invite',
  authenticateToken,
  requireVerified,
  requireAdmin(),
  [body('email').isEmail().normalizeEmail()],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { sendValidationError(res, errors.array()); return; }

    const { id: familyId } = req.params;
    const { email } = req.body as { email: string };
    const userId = req.user!.id;

    const family = await queryOne<Family>('SELECT * FROM families WHERE id = $1 AND deleted_at IS NULL', [familyId]);
    if (!family) { sendError(res, 404, 'Family not found'); return; }

    // Check no active pending invite for this email+family
    const existingInvite = await queryOne<Invitation>(
      "SELECT id FROM invitations WHERE email = $1 AND family_id = $2 AND status = 'pending' AND expires_at > NOW()",
      [email, familyId]
    );
    if (existingInvite) { sendError(res, 409, 'Active invite already exists for this email'); return; }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await query(
      'INSERT INTO invitations (email, invited_by, family_id, token_hash, expires_at) VALUES ($1, $2, $3, $4, $5)',
      [email, userId, familyId, tokenHash, expiresAt]
    );

    await sendInviteEmail(email, rawToken, family.name);
    await writeAuditLog({ entityType: 'invitation', action: 'create', actorId: userId, newValue: { email, familyId } });

    res.status(201).json({ message: `Invite sent to ${email}` });
  }
);

// GET /api/invites/:token/validate
router.get('/invites/:token/validate', async (req: AuthRequest, res: Response): Promise<void> => {
  const { token } = req.params;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const invite = await queryOne<Invitation & { family_name: string }>(
    `SELECT i.*, f.name AS family_name
     FROM invitations i JOIN families f ON i.family_id = f.id
     WHERE i.token_hash = $1 AND i.status = 'pending' AND i.expires_at > NOW()`,
    [tokenHash]
  );
  if (!invite) { sendError(res, 400, 'Invalid or expired invite token'); return; }
  res.json({ email: invite.email, family_name: invite.family_name, family_id: invite.family_id });
});

// POST /api/families/:id/join-request
router.post('/:id/join-request',
  authenticateToken,
  requireVerified,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { id: familyId } = req.params;
    const userId = req.user!.id;

    const family = await queryOne<Family>('SELECT * FROM families WHERE id = $1 AND deleted_at IS NULL', [familyId]);
    if (!family) { sendError(res, 404, 'Family not found'); return; }

    const existing = await queryOne<FamilyMember>(
      'SELECT * FROM family_members WHERE family_id = $1 AND user_id = $2',
      [familyId, userId]
    );
    if (existing) {
      sendError(res, 409, existing.status === 'pending' ? 'Join request already pending' : 'Already a member');
      return;
    }

    await query(
      "INSERT INTO family_members (family_id, user_id, role, status) VALUES ($1, $2, 'member', 'pending')",
      [familyId, userId]
    );

    // Notify admins
    const admins = await query<User & { email: string }>(
      `SELECT u.email FROM users u
       JOIN family_members fm ON fm.user_id = u.id
       WHERE fm.family_id = $1 AND fm.role = 'admin' AND fm.status = 'active'`,
      [familyId]
    );
    for (const admin of admins) {
      await sendJoinRequestEmail(admin.email, family.name, req.user!.email).catch(console.error);
    }

    res.status(201).json({ message: 'Join request submitted' });
  }
);

// GET /api/families/:id/join-requests (admin only)
router.get('/:id/join-requests',
  authenticateToken,
  requireVerified,
  requireAdmin(),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { id: familyId } = req.params;
    const requests = await query(
      `SELECT fm.id, fm.user_id, fm.created_at, u.email
       FROM family_members fm JOIN users u ON u.id = fm.user_id
       WHERE fm.family_id = $1 AND fm.status = 'pending'
       ORDER BY fm.created_at`,
      [familyId]
    );
    res.json({ requests });
  }
);

// POST /api/families/:id/approve-join/:userId (admin only)
router.post('/:id/approve-join/:userId',
  authenticateToken,
  requireVerified,
  requireAdmin(),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { id: familyId, userId: targetUserId } = req.params;
    const result = await query(
      "UPDATE family_members SET status = 'active', joined_at = NOW() WHERE family_id = $1 AND user_id = $2 AND status = 'pending' RETURNING *",
      [familyId, targetUserId]
    );
    if (!result.length) { sendError(res, 404, 'Join request not found'); return; }
    await writeAuditLog({ entityType: 'family_member', action: 'approve_join', actorId: req.user!.id, newValue: { familyId, userId: targetUserId } });
    res.json({ message: 'Join request approved' });
  }
);

// POST /api/families/:id/reject-join/:userId (admin only)
router.post('/:id/reject-join/:userId',
  authenticateToken,
  requireVerified,
  requireAdmin(),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { id: familyId, userId: targetUserId } = req.params;
    const result = await query(
      "DELETE FROM family_members WHERE family_id = $1 AND user_id = $2 AND status = 'pending' RETURNING *",
      [familyId, targetUserId]
    );
    if (!result.length) { sendError(res, 404, 'Join request not found'); return; }
    await writeAuditLog({ entityType: 'family_member', action: 'reject_join', actorId: req.user!.id, newValue: { familyId, userId: targetUserId } });
    res.json({ message: 'Join request rejected' });
  }
);

// GET /api/families/:id/tree
router.get('/:id/tree',
  authenticateToken,
  requireVerified,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id: familyId } = req.params;
      const family = await queryOne<Family>('SELECT id FROM families WHERE id = $1 AND deleted_at IS NULL', [familyId]);
      if (!family) { sendError(res, 404, 'Family not found'); return; }

      const persons = await query(
        `SELECT p.id, p.first_name, p.last_name, p.gender, p.dob, p.photo_url, p.is_unknown
         FROM persons p
         JOIN person_families pf ON pf.person_id = p.id
         WHERE pf.family_id = $1 AND p.deleted_at IS NULL
         ORDER BY p.created_at`,
        [familyId]
      );
      const relationships = await query(
        `SELECT id, from_person_id, to_person_id, type, subtype, status
         FROM relationships WHERE family_id = $1`,
        [familyId]
      );
      res.json({ persons, relationships });
    } catch (e) {
      console.error('Tree error:', e);
      sendError(res, 500, 'Failed to load tree');
    }
  }
);

// GET /api/families/:id
router.get('/:id',
  authenticateToken,
  requireVerified,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { id: familyId } = req.params;
    const userId = req.user!.id;

    const family = await queryOne<Family>('SELECT id, name, slug, created_at FROM families WHERE id = $1 AND deleted_at IS NULL', [familyId]);
    if (!family) { sendError(res, 404, 'Family not found'); return; }

    const membership = await queryOne<FamilyMember>(
      "SELECT * FROM family_members WHERE family_id = $1 AND user_id = $2 AND status = 'active'",
      [familyId, userId]
    );

    res.json({ family, membership: membership ? { role: membership.role } : null });
  }
);

export default router;
