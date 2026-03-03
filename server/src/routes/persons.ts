import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query, queryOne } from '../db';
import { sendError, sendValidationError } from '../utils/helpers';
import { authenticateToken, requireVerified, requireAdmin, AuthRequest } from '../middleware/auth';
import { writeAuditLog } from '../middleware/audit';
import { Person, EditProposal, FamilyMember } from '../types';

const router = Router({ mergeParams: true });

// GET /api/families/:id/persons
router.get('/',
  authenticateToken,
  requireVerified,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { id: familyId } = req.params;
    const userId = req.user!.id;

    // Verify membership
    const member = await queryOne<FamilyMember>(
      "SELECT * FROM family_members WHERE family_id = $1 AND user_id = $2 AND status = 'active'",
      [familyId, userId]
    );
    if (!member && req.user!.role !== 'superadmin') {
      sendError(res, 403, 'Must be a family member to view persons'); return;
    }

    const persons = await query<Person>(
      `SELECT p.* FROM persons p
       JOIN person_families pf ON pf.person_id = p.id
       WHERE pf.family_id = $1 AND p.deleted_at IS NULL
       ORDER BY p.last_name, p.first_name`,
      [familyId]
    );
    res.json({ persons });
  }
);

// POST /api/families/:id/persons (propose add person)
router.post('/',
  authenticateToken,
  requireVerified,
  [
    body('first_name').trim().isLength({ min: 1, max: 100 }),
    body('last_name').trim().isLength({ min: 1, max: 100 }),
    body('gender').optional().isIn(['male', 'female', 'other', 'unknown']),
    body('dob').optional().isISO8601().toDate(),
    body('dod').optional().isISO8601().toDate(),
    body('is_unknown').optional().isBoolean(),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { sendValidationError(res, errors.array()); return; }

    const { id: familyId } = req.params;
    const userId = req.user!.id;

    // Verify membership
    const member = await queryOne<FamilyMember>(
      "SELECT * FROM family_members WHERE family_id = $1 AND user_id = $2 AND status = 'active'",
      [familyId, userId]
    );
    if (!member && req.user!.role !== 'superadmin') {
      sendError(res, 403, 'Must be a family member to propose persons'); return;
    }

    const { first_name, last_name, gender, dob, dod, is_unknown } = req.body;

    const payload = {
      type: 'add_person' as const,
      data: { first_name, last_name, gender, dob, dod, is_unknown: is_unknown ?? false, created_by: userId },
    };

    const [proposal] = await query<EditProposal>(
      `INSERT INTO edit_proposals (family_id, proposed_by, action, payload)
       VALUES ($1, $2, 'add_person', $3) RETURNING *`,
      [familyId, userId, JSON.stringify(payload)]
    );

    await writeAuditLog({
      entityType: 'edit_proposal',
      entityId: proposal.id,
      action: 'create_proposal',
      actorId: userId,
      newValue: payload,
    });

    res.status(201).json({ proposal, message: 'Person proposal submitted for admin review.' });
  }
);

// GET /api/families/:id/proposals (admin only)
router.get('/proposals',
  authenticateToken,
  requireVerified,
  requireAdmin(),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { id: familyId } = req.params;
    const proposals = await query<EditProposal & { proposer_email: string }>(
      `SELECT ep.*, u.email AS proposer_email
       FROM edit_proposals ep JOIN users u ON u.id = ep.proposed_by
       WHERE ep.family_id = $1 AND ep.status = 'pending'
       ORDER BY ep.created_at`,
      [familyId]
    );
    res.json({ proposals });
  }
);

export default router;
