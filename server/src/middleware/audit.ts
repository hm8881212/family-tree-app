import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { pool } from '../db';

export function auditLog(action: string, entityType: string) {
  return async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
    // Store audit context on req for use after route handler
    (req as unknown as Record<string, unknown>)._audit = { action, entityType };
    next();
  };
}

export async function writeAuditLog(params: {
  entityType: string;
  entityId?: string;
  action: string;
  actorId?: string;
  oldValue?: unknown;
  newValue?: unknown;
}): Promise<void> {
  await pool.query(
    `INSERT INTO audit_log (entity_type, entity_id, action, actor_id, old_value, new_value)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      params.entityType,
      params.entityId ?? null,
      params.action,
      params.actorId ?? null,
      params.oldValue ? JSON.stringify(params.oldValue) : null,
      params.newValue ? JSON.stringify(params.newValue) : null,
    ]
  );
}
