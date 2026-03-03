import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../db';
import { sendError, sendValidationError } from '../utils/helpers';
import { authenticateToken, requireVerified, AuthRequest } from '../middleware/auth';
import { writeAuditLog } from '../middleware/audit';

const router = Router();

function requireSuperAdmin(req: AuthRequest, res: Response): boolean {
  if (req.user?.role !== 'superadmin') {
    sendError(res, 403, 'Super admin access required');
    return false;
  }
  return true;
}

// GET /api/superadmin/families
router.get('/families',
  authenticateToken,
  requireVerified,
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!requireSuperAdmin(req, res)) return;
    const families = await query(
      `SELECT f.*, u.email AS owner_email,
        (SELECT COUNT(*) FROM family_members fm WHERE fm.family_id = f.id AND fm.status = 'active') AS member_count,
        (SELECT COUNT(*) FROM person_families pf JOIN persons p ON p.id = pf.person_id WHERE pf.family_id = f.id AND p.deleted_at IS NULL) AS person_count
       FROM families f JOIN users u ON u.id = f.created_by
       WHERE f.deleted_at IS NULL ORDER BY f.created_at DESC`
    );
    res.json({ families });
  }
);

// GET /api/superadmin/audit-log
router.get('/audit-log',
  authenticateToken,
  requireVerified,
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!requireSuperAdmin(req, res)) return;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const logs = await query(
      `SELECT al.*, u.email AS actor_email
       FROM audit_log al LEFT JOIN users u ON u.id = al.actor_id
       ORDER BY al.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json({ logs, limit, offset });
  }
);

// POST /api/superadmin/families/:id/delete
router.post('/families/:id/delete',
  authenticateToken,
  requireVerified,
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!requireSuperAdmin(req, res)) return;
    const { id } = req.params;
    await query('UPDATE families SET deleted_at = NOW() WHERE id = $1', [id]);
    await writeAuditLog({ entityType: 'family', entityId: id, action: 'superadmin_delete', actorId: req.user!.id });
    res.json({ message: 'Family soft-deleted' });
  }
);

// POST /api/superadmin/users/:id/promote
router.post('/users/:id/promote',
  authenticateToken,
  requireVerified,
  [body('role').isIn(['user', 'superadmin'])],
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!requireSuperAdmin(req, res)) return;
    const errors = validationResult(req);
    if (!errors.isEmpty()) { sendValidationError(res, errors.array()); return; }
    const { id } = req.params;
    const { role } = req.body as { role: string };
    await query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);
    await writeAuditLog({ entityType: 'user', entityId: id, action: `promote_to_${role}`, actorId: req.user!.id });
    res.json({ message: `User role updated to ${role}` });
  }
);

// ─── Tree Merging ─────────────────────────────────────────────────────────────

// POST /api/families/merge-request
router.post('/merge-request',
  authenticateToken,
  requireVerified,
  [
    body('family_a_id').isUUID(),
    body('family_b_id').isUUID(),
    body('link_relationship_id').optional().isUUID(),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { sendValidationError(res, errors.array()); return; }

    const { family_a_id, family_b_id, link_relationship_id } = req.body as Record<string, string>;
    if (family_a_id === family_b_id) { sendError(res, 400, 'Cannot merge family with itself'); return; }

    const [mergeRequest] = await query<{ id: string }>(
      `INSERT INTO merge_requests (family_a_id, family_b_id, link_relationship_id, status)
       VALUES ($1, $2, $3, 'pending') RETURNING *`,
      [family_a_id, family_b_id, link_relationship_id ?? null]
    );

    // Auto-create approval slots for both family admins
    const admins = await query<{ user_id: string; family_id: string }>(
      `SELECT user_id, family_id FROM family_members
       WHERE family_id = ANY($1::uuid[]) AND role = 'admin' AND status = 'active'`,
      [[family_a_id, family_b_id]]
    );
    for (const admin of admins) {
      await query(
        'INSERT INTO merge_approvals (merge_request_id, admin_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [mergeRequest.id, admin.user_id]
      );
    }

    res.status(201).json({ mergeRequest, message: 'Merge request created. Both admins must approve.' });
  }
);

// POST /api/superadmin/merge-requests/:id/approve
router.post('/merge-requests/:id/approve',
  authenticateToken,
  requireVerified,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user!.id;

    // Check user is an approver
    const approval = await query(
      "SELECT * FROM merge_approvals WHERE merge_request_id = $1 AND admin_user_id = $2",
      [id, userId]
    );
    if (!approval.length && req.user!.role !== 'superadmin') {
      sendError(res, 403, 'Not an approver for this merge request'); return;
    }

    await query(
      "UPDATE merge_approvals SET decision = 'approved', decided_at = NOW() WHERE merge_request_id = $1 AND admin_user_id = $2",
      [id, userId]
    );

    // Check if all approvals are in
    const pending = await query(
      "SELECT * FROM merge_approvals WHERE merge_request_id = $1 AND decision IS NULL",
      [id]
    );
    if (pending.length === 0) {
      // Execute merge
      const [mr] = await query<{ family_a_id: string; family_b_id: string }>(
        'SELECT * FROM merge_requests WHERE id = $1', [id]
      );
      await executeMerge(mr.family_a_id, mr.family_b_id);
      await query("UPDATE merge_requests SET status = 'approved' WHERE id = $1", [id]);
      await writeAuditLog({
        entityType: 'merge_request', entityId: id,
        action: 'merge_approved', actorId: userId,
        newValue: { family_a_id: mr.family_a_id, family_b_id: mr.family_b_id }
      });
    }

    res.json({ message: pending.length === 0 ? 'Merge executed!' : 'Approval recorded. Waiting for other admin.' });
  }
);

async function executeMerge(familyAId: string, familyBId: string): Promise<void> {
  // Add all family B persons to family A (person_families)
  await query(
    `INSERT INTO person_families (person_id, family_id)
     SELECT person_id, $1 FROM person_families
     WHERE family_id = $2
     ON CONFLICT DO NOTHING`,
    [familyAId, familyBId]
  );
  // Add all family B members to family A
  await query(
    `INSERT INTO family_members (family_id, user_id, role, status, joined_at)
     SELECT $1, user_id, role, status, joined_at FROM family_members
     WHERE family_id = $2
     ON CONFLICT DO NOTHING`,
    [familyAId, familyBId]
  );
}

export default router;
