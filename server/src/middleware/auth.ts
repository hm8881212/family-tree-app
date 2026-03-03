import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { queryOne } from '../db';
import { User, FamilyMember } from '../types';
import { sendError } from '../utils/helpers';

export interface AuthRequest extends Request {
  user?: User;
}

export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.access_token;
  if (!token) {
    sendError(res, 401, 'Authentication required');
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    const user = await queryOne<User>('SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL', [payload.sub]);
    if (!user) {
      sendError(res, 401, 'User not found');
      return;
    }
    req.user = user;
    next();
  } catch {
    sendError(res, 401, 'Invalid or expired token');
  }
}

export function requireVerified(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user?.verified) {
    sendError(res, 403, 'Email verification required');
    return;
  }
  next();
}

export function requireSuperAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'superadmin') {
    sendError(res, 403, 'Superadmin access required');
    return;
  }
  next();
}

export function requireAdmin(paramKey = 'id') {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const familyId = req.params[paramKey];
    const userId = req.user!.id;

    if (req.user?.role === 'superadmin') {
      next();
      return;
    }

    const member = await queryOne<FamilyMember>(
      "SELECT * FROM family_members WHERE family_id = $1 AND user_id = $2 AND status = 'active'",
      [familyId, userId]
    );

    if (!member || member.role !== 'admin') {
      sendError(res, 403, 'Family admin access required');
      return;
    }
    next();
  };
}
