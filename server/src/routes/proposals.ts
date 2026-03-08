import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query, queryOne } from '../db';
import { sendError, sendValidationError } from '../utils/helpers';
import { authenticateToken, requireVerified, AuthRequest } from '../middleware/auth';
import { writeAuditLog } from '../middleware/audit';
import { EditProposal, FamilyMember, Person } from '../types';

const router = Router();

async function requireProposalAdmin(req: AuthRequest, res: Response): Promise<EditProposal | null> {
  const { id } = req.params;
  const proposal = await queryOne<EditProposal>('SELECT * FROM edit_proposals WHERE id = $1', [id]);
  if (!proposal) { sendError(res, 404, 'Proposal not found'); return null; }

  if (req.user!.role === 'superadmin') return proposal;

  const member = await queryOne<FamilyMember>(
    "SELECT * FROM family_members WHERE family_id = $1 AND user_id = $2 AND role = 'admin' AND status = 'active'",
    [proposal.family_id, req.user!.id]
  );
  if (!member) { sendError(res, 403, 'Family admin access required'); return null; }
  return proposal;
}

// POST /api/proposals/:id/approve
router.post('/:id/approve',
  authenticateToken,
  requireVerified,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const proposal = await requireProposalAdmin(req, res);
    if (!proposal) return;

    if (proposal.status !== 'pending') { sendError(res, 400, 'Proposal is not pending'); return; }

    // Apply the proposal
    if (proposal.action === 'add_person') {
      const { data } = proposal.payload as { type: 'add_person'; data: Record<string, unknown> };
      const [person] = await query<Person>(
        `INSERT INTO persons (first_name, last_name, gender, dob, dod, is_unknown, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [data.first_name, data.last_name, data.gender ?? null, data.dob ?? null, data.dod ?? null, data.is_unknown ?? false, data.created_by]
      );
      await query('INSERT INTO person_families (person_id, family_id) VALUES ($1, $2)', [person.id, proposal.family_id]);
      await writeAuditLog({ entityType: 'person', entityId: person.id, action: 'add_person', actorId: req.user!.id, newValue: person });
    } else if (proposal.action === 'add_relationship') {
      const p = proposal.payload as { from_person_id: string; to_person_id: string; rel_type: string; subtype?: string; started_at?: string; ended_at?: string };
      await query(
        `INSERT INTO relationships (family_id, from_person_id, to_person_id, type, subtype, started_at, ended_at, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'approved')`,
        [proposal.family_id, p.from_person_id, p.to_person_id, p.rel_type, p.subtype ?? null, p.started_at ?? null, p.ended_at ?? null]
      );
      await writeAuditLog({ entityType: 'relationship', entityId: proposal.id, action: 'add_relationship', actorId: req.user!.id, newValue: p });
    } else if (proposal.action === 'edit_person') {
      const p = proposal.payload as { person_id: string; data: Record<string, unknown> };
      const fields = Object.entries(p.data).filter(([k]) => ['first_name','last_name','gender','dob','dod','is_unknown'].includes(k));
      if (fields.length > 0) {
        const sets = fields.map(([k], i) => `${k} = $${i + 2}`).join(', ');
        const vals = fields.map(([, v]) => v);
        await query(`UPDATE persons SET ${sets} WHERE id = $1`, [p.person_id, ...vals]);
      }
    }

    await query(
      "UPDATE edit_proposals SET status = 'approved', reviewed_by = $1, reviewed_at = NOW() WHERE id = $2",
      [req.user!.id, proposal.id]
    );

    res.json({ message: 'Proposal approved' });
  }
);

// POST /api/proposals/:id/reject
router.post('/:id/reject',
  authenticateToken,
  requireVerified,
  [body('reason').optional().isString().trim()],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { sendValidationError(res, errors.array()); return; }

    const proposal = await requireProposalAdmin(req, res);
    if (!proposal) return;

    if (proposal.status !== 'pending') { sendError(res, 400, 'Proposal is not pending'); return; }

    const { reason } = req.body as { reason?: string };
    await query(
      "UPDATE edit_proposals SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(), rejection_reason = $2 WHERE id = $3",
      [req.user!.id, reason ?? null, proposal.id]
    );

    res.json({ message: 'Proposal rejected' });
  }
);

export default router;
