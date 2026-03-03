import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { query, queryOne } from '../db';
import { sendError, sendValidationError } from '../utils/helpers';
import { authenticateToken, requireVerified, requireAdmin, AuthRequest } from '../middleware/auth';
import { writeAuditLog } from '../middleware/audit';
import { EditProposal, FamilyMember } from '../types';
import { computeRelationshipLabel as computeGraphLabel } from '../services/relationshipGraph';

const router = Router();

// POST /api/relationships (propose a relationship)
router.post('/',
  authenticateToken,
  requireVerified,
  [
    body('family_id').isUUID(),
    body('from_person_id').isUUID(),
    body('to_person_id').isUUID(),
    body('type').isIn(['parent_of', 'spouse_of', 'sibling_of', 'adopted_by']),
    body('subtype').optional().isString(),
    body('started_at').optional().isISO8601().toDate(),
    body('ended_at').optional().isISO8601().toDate(),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { sendValidationError(res, errors.array()); return; }

    const { family_id, from_person_id, to_person_id, type, subtype, started_at, ended_at } = req.body;
    const userId = req.user!.id;

    // Verify membership
    const member = await queryOne<FamilyMember>(
      "SELECT * FROM family_members WHERE family_id = $1 AND user_id = $2 AND status = 'active'",
      [family_id, userId]
    );
    if (!member && req.user!.role !== 'superadmin') {
      sendError(res, 403, 'Must be a family member to propose relationships'); return;
    }

    // Prevent self-relationship
    if (from_person_id === to_person_id) {
      sendError(res, 400, 'Cannot create relationship with self'); return;
    }

    const payload = {
      type: 'add_relationship' as const,
      from_person_id, to_person_id,
      rel_type: type, subtype, started_at, ended_at,
    };

    const [proposal] = await query<EditProposal>(
      `INSERT INTO edit_proposals (family_id, proposed_by, action, payload)
       VALUES ($1, $2, 'add_relationship', $3) RETURNING *`,
      [family_id, userId, JSON.stringify(payload)]
    );

    await writeAuditLog({
      entityType: 'edit_proposal', entityId: proposal.id,
      action: 'create_relationship_proposal', actorId: userId, newValue: payload,
    });

    res.status(201).json({ proposal, message: 'Relationship proposal submitted for admin review.' });
  }
);

// GET /api/persons/:id/relationships?mode=indian|international
router.get('/persons/:id/relationships',
  authenticateToken,
  requireVerified,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { id: personId } = req.params;
    const mode = (req.query.mode as string) === 'indian' ? 'indian' : 'international';

    // Get approved relationships
    const relationships = await query<{
      id: string;
      from_person_id: string;
      to_person_id: string;
      type: string;
      subtype: string;
      started_at: Date;
      ended_at: Date;
      from_first_name: string;
      from_last_name: string;
      to_first_name: string;
      to_last_name: string;
    }>(
      `SELECT r.*,
        fp.first_name AS from_first_name, fp.last_name AS from_last_name,
        tp.first_name AS to_first_name, tp.last_name AS to_last_name
       FROM relationships r
       JOIN persons fp ON fp.id = r.from_person_id
       JOIN persons tp ON tp.id = r.to_person_id
       WHERE (r.from_person_id = $1 OR r.to_person_id = $1)
         AND r.status = 'approved'
         AND fp.deleted_at IS NULL AND tp.deleted_at IS NULL`,
      [personId]
    );

    // Compute display labels using graph traversal
    const labeled = await Promise.all(relationships.map(async (r) => {
      const isFrom = r.from_person_id === personId;
      const relatedId = isFrom ? r.to_person_id : r.from_person_id;
      const label = await computeGraphLabel(personId, relatedId, mode);
      const relatedPerson = isFrom
        ? { id: r.to_person_id, first_name: r.to_first_name, last_name: r.to_last_name }
        : { id: r.from_person_id, first_name: r.from_first_name, last_name: r.from_last_name };
      return { ...r, label, related_person: relatedPerson, direction: isFrom ? 'outgoing' : 'incoming' };
    }));

    res.json({ relationships: labeled, mode });
  }
);

// GET /api/families/:id/tree?depth=3 (depth-limited tree for visualization)
router.get('/families/:id/tree',
  authenticateToken,
  requireVerified,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { id: familyId } = req.params;
    const depth = Math.min(parseInt(req.query.depth as string) || 3, 6);
    const userId = req.user!.id;

    const member = await queryOne<FamilyMember>(
      "SELECT * FROM family_members WHERE family_id = $1 AND user_id = $2 AND status = 'active'",
      [familyId, userId]
    );
    if (!member && req.user!.role !== 'superadmin') {
      sendError(res, 403, 'Must be a family member to view tree'); return;
    }

    // Get all persons in family
    const persons = await query(
      `SELECT p.id, p.first_name, p.last_name, p.gender, p.dob, p.dod, p.photo_url, p.is_unknown
       FROM persons p
       JOIN person_families pf ON pf.person_id = p.id
       WHERE pf.family_id = $1 AND p.deleted_at IS NULL
       ORDER BY p.last_name, p.first_name`,
      [familyId]
    );

    // Get all approved relationships for these persons
    const personIds = (persons as Array<{ id: string }>).map((p) => p.id);
    let relationships: unknown[] = [];
    if (personIds.length > 0) {
      relationships = await query(
        `SELECT r.id, r.from_person_id, r.to_person_id, r.type, r.subtype, r.started_at, r.ended_at
         FROM relationships r
         WHERE r.status = 'approved'
           AND r.from_person_id = ANY($1::uuid[])
           AND r.to_person_id = ANY($1::uuid[])`,
        [personIds]
      );
    }

    res.json({ persons, relationships, depth });
  }
);

// POST /api/proposals/:id/approve (admin — approves any proposal including relationships)
router.post('/proposals/:id/approve',
  authenticateToken,
  requireVerified,
  requireAdmin(),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { id: proposalId } = req.params;
    const adminId = req.user!.id;

    const proposal = await queryOne<EditProposal>(
      "SELECT * FROM edit_proposals WHERE id = $1 AND status = 'pending'",
      [proposalId]
    );
    if (!proposal) { sendError(res, 404, 'Proposal not found or already reviewed'); return; }

    // Apply the proposal
    try {
      await applyProposal(proposal);
    } catch (err) {
      sendError(res, 500, `Failed to apply proposal: ${(err as Error).message}`); return;
    }

    await query(
      "UPDATE edit_proposals SET status = 'approved', reviewed_by = $1, reviewed_at = NOW() WHERE id = $2",
      [adminId, proposalId]
    );
    await writeAuditLog({
      entityType: 'edit_proposal', entityId: proposalId,
      action: 'approve', actorId: adminId,
    });

    res.json({ message: 'Proposal approved and applied.' });
  }
);

// POST /api/proposals/:id/reject (admin)
router.post('/proposals/:id/reject',
  authenticateToken,
  requireVerified,
  requireAdmin(),
  [body('reason').optional().isString()],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { id: proposalId } = req.params;
    const { reason } = req.body as { reason?: string };
    const adminId = req.user!.id;

    const result = await query(
      "UPDATE edit_proposals SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(), rejection_reason = $2 WHERE id = $3 AND status = 'pending' RETURNING *",
      [adminId, reason ?? null, proposalId]
    );
    if (!result.length) { sendError(res, 404, 'Proposal not found or already reviewed'); return; }

    await writeAuditLog({
      entityType: 'edit_proposal', entityId: proposalId,
      action: 'reject', actorId: adminId, newValue: { reason },
    });
    res.json({ message: 'Proposal rejected.' });
  }
);

// ─── Helpers ────────────────────────────────────────────────────────────────

async function applyProposal(proposal: EditProposal): Promise<void> {
  const payload = proposal.payload as Record<string, unknown>;

  switch (payload.type) {
    case 'add_person': {
      const data = payload.data as Record<string, unknown>;
      const [newPerson] = await query<{ id: string }>(
        `INSERT INTO persons (first_name, last_name, gender, dob, dod, is_unknown, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [data.first_name, data.last_name, data.gender ?? null, data.dob ?? null, data.dod ?? null, data.is_unknown ?? false, data.created_by]
      );
      await query(
        'INSERT INTO person_families (person_id, family_id) VALUES ($1, $2)',
        [newPerson.id, proposal.family_id]
      );
      break;
    }
    case 'edit_person': {
      const changes = payload.changes as Record<string, unknown>;
      const setClauses = Object.keys(changes)
        .filter((k) => ['first_name', 'last_name', 'gender', 'dob', 'dod', 'photo_url', 'is_unknown'].includes(k))
        .map((k, i) => `${k} = $${i + 2}`);
      if (setClauses.length > 0) {
        await query(
          `UPDATE persons SET ${setClauses.join(', ')} WHERE id = $1`,
          [payload.person_id, ...Object.values(changes)]
        );
      }
      break;
    }
    case 'add_relationship': {
      await query(
        `INSERT INTO relationships (from_person_id, to_person_id, type, subtype, started_at, ended_at, status, family_id)
         VALUES ($1, $2, $3, $4, $5, $6, 'approved', $7)`,
        [payload.from_person_id, payload.to_person_id, payload.rel_type, payload.subtype ?? null,
          payload.started_at ?? null, payload.ended_at ?? null, proposal.family_id]
      );
      break;
    }
    case 'delete_person': {
      await query('UPDATE persons SET deleted_at = NOW() WHERE id = $1', [payload.person_id]);
      break;
    }
  }
}

const INTL_LABELS: Record<string, Record<string, string>> = {
  parent_of: { outgoing: 'parent of', incoming: 'child of' },
  spouse_of: { outgoing: 'spouse of', incoming: 'spouse of' },
  sibling_of: { outgoing: 'sibling of', incoming: 'sibling of' },
  adopted_by: { outgoing: 'adopted by', incoming: 'adoptive parent of' },
};

const INDIAN_LABELS: Record<string, Record<string, Record<string, string>>> = {
  parent_of: {
    male: { outgoing: 'pita (father)', incoming: 'beta/beti (child)' },
    female: { outgoing: 'mata (mother)', incoming: 'beta/beti (child)' },
    other: { outgoing: 'parent', incoming: 'child' },
  },
  spouse_of: {
    male: { outgoing: 'pati (husband)', incoming: 'patni (wife)' },
    female: { outgoing: 'patni (wife)', incoming: 'pati (husband)' },
    other: { outgoing: 'spouse', incoming: 'spouse' },
  },
  sibling_of: {
    male: { outgoing: 'bhai (brother)', incoming: 'bhai (brother)' },
    female: { outgoing: 'behen (sister)', incoming: 'behen (sister)' },
    other: { outgoing: 'sibling', incoming: 'sibling' },
  },
};

function computeRelationshipLabel(
  type: string, _subtype: string,
  isFrom: boolean,
  mode: 'indian' | 'international'
): string {
  const dir = isFrom ? 'outgoing' : 'incoming';
  if (mode === 'international') {
    return INTL_LABELS[type]?.[dir] ?? type;
  }
  // Indian mode — gender-neutral fallback for now (full computation needs path traversal)
  return INDIAN_LABELS[type]?.other?.[dir] ?? INTL_LABELS[type]?.[dir] ?? type;
}

export default router;
