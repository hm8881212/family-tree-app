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

// GET /api/persons/:id
router.get('/:personId',
  authenticateToken,
  requireVerified,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { personId } = req.params;
    const person = await queryOne<Person>('SELECT * FROM persons WHERE id = $1 AND deleted_at IS NULL', [personId]);
    if (!person) { sendError(res, 404, 'Person not found'); return; }
    res.json({ person });
  }
);

// PUT /api/persons/:id (propose edit)
router.put('/:personId',
  authenticateToken,
  requireVerified,
  [
    body('first_name').optional().trim().isLength({ min: 1, max: 100 }),
    body('last_name').optional().trim().isLength({ min: 1, max: 100 }),
    body('gender').optional().isIn(['male', 'female', 'other', 'unknown', '']),
    body('dob').optional({ nullable: true }).isISO8601().toDate(),
    body('dod').optional({ nullable: true }).isISO8601().toDate(),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { sendValidationError(res, errors.array()); return; }

    const { personId } = req.params;
    const userId = req.user!.id;

    const person = await queryOne<Person>('SELECT * FROM persons WHERE id = $1 AND deleted_at IS NULL', [personId]);
    if (!person) { sendError(res, 404, 'Person not found'); return; }

    // Find their family to verify membership
    const pfRow = await queryOne<{ family_id: string }>(
      'SELECT family_id FROM person_families WHERE person_id = $1 LIMIT 1', [personId]
    );
    if (pfRow) {
      const member = await queryOne<FamilyMember>(
        "SELECT * FROM family_members WHERE family_id = $1 AND user_id = $2 AND status = 'active'",
        [pfRow.family_id, userId]
      );
      if (!member && req.user!.role !== 'superadmin') {
        sendError(res, 403, 'Must be a family member to propose edits'); return;
      }
    }

    const changes: Record<string, unknown> = {};
    ['first_name', 'last_name', 'gender', 'dob', 'dod'].forEach((k) => {
      if (req.body[k] !== undefined) changes[k] = req.body[k] || null;
    });

    const payload = { type: 'edit_person' as const, person_id: personId, changes };
    const [proposal] = await query<EditProposal>(
      `INSERT INTO edit_proposals (family_id, proposed_by, action, payload)
       VALUES ($1, $2, 'edit_person', $3) RETURNING *`,
      [pfRow?.family_id ?? null, userId, JSON.stringify(payload)]
    );

    await writeAuditLog({ entityType: 'edit_proposal', entityId: proposal.id, action: 'propose_edit', actorId: userId, newValue: payload });
    res.status(201).json({ proposal, message: 'Edit proposal submitted for admin review.' });
  }
);

// DELETE /api/persons/:id (propose soft delete)
router.delete('/:personId',
  authenticateToken,
  requireVerified,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { personId } = req.params;
    const userId = req.user!.id;

    const person = await queryOne<Person>('SELECT * FROM persons WHERE id = $1 AND deleted_at IS NULL', [personId]);
    if (!person) { sendError(res, 404, 'Person not found'); return; }

    const pfRow = await queryOne<{ family_id: string }>(
      'SELECT family_id FROM person_families WHERE person_id = $1 LIMIT 1', [personId]
    );

    const payload = { type: 'delete_person' as const, person_id: personId };
    const [proposal] = await query<EditProposal>(
      `INSERT INTO edit_proposals (family_id, proposed_by, action, payload)
       VALUES ($1, $2, 'delete_person', $3) RETURNING *`,
      [pfRow?.family_id ?? null, userId, JSON.stringify(payload)]
    );

    await writeAuditLog({ entityType: 'edit_proposal', entityId: proposal.id, action: 'propose_delete', actorId: userId, newValue: payload });
    res.status(201).json({ proposal, message: 'Deletion proposal submitted for admin review.' });
  }
);

// POST /api/families/:id/persons/:personId/claim-user  (admin only)
// Link an unknown person node to a registered family member
router.post('/:personId/claim-user',
  authenticateToken,
  requireVerified,
  requireAdmin(),
  [body('user_id').isUUID()],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { sendValidationError(res, errors.array()); return; }

    const { personId, id: familyId } = req.params;
    const { user_id } = req.body;
    const actorId = req.user!.id;

    const person = await queryOne<Person>('SELECT * FROM persons WHERE id = $1 AND deleted_at IS NULL', [personId]);
    if (!person) { sendError(res, 404, 'Person not found'); return; }

    // Verify the target user is an active family member
    const member = await queryOne<FamilyMember>(
      "SELECT * FROM family_members WHERE family_id = $1 AND user_id = $2 AND status = 'active'",
      [familyId, user_id]
    );
    if (!member) { sendError(res, 400, 'Target user is not an active member of this family'); return; }

    const [updated] = await query<Person>(
      'UPDATE persons SET claimed_by_user_id = $1, is_unknown = false WHERE id = $2 RETURNING *',
      [user_id, personId]
    );

    await writeAuditLog({
      entityType: 'person',
      entityId: personId,
      action: 'claim_person',
      actorId,
      newValue: { claimed_by_user_id: user_id },
    });

    res.json({ person: updated, message: 'Person linked to user.' });
  }
);

// GET /api/families/:id/persons/members-list (admin only — for claim UI)
router.get('/members-list',
  authenticateToken,
  requireVerified,
  requireAdmin(),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { id: familyId } = req.params;
    const members = await query<{ id: string; email: string; role: string }>(
      `SELECT u.id, u.email, fm.role
       FROM family_members fm JOIN users u ON u.id = fm.user_id
       WHERE fm.family_id = $1 AND fm.status = 'active'
       ORDER BY u.email`,
      [familyId]
    );
    res.json({ members });
  }
);

// GET /api/persons/:id/history
router.get('/:personId/history',
  authenticateToken,
  requireVerified,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { personId } = req.params;
    const history = await query(
      `SELECT ph.*, u.email AS actor_email
       FROM person_history ph LEFT JOIN users u ON u.id = ph.changed_by
       WHERE ph.person_id = $1
       ORDER BY ph.changed_at DESC`,
      [personId]
    );
    res.json({ history });
  }
);

export default router;
