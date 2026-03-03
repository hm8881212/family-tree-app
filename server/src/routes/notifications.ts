import { Router, Response } from 'express';
import { query, queryOne } from '../db';
import { sendError } from '../utils/helpers';
import { authenticateToken, requireVerified, AuthRequest } from '../middleware/auth';
import { Notification } from '../types';

const router = Router();

// GET /api/notifications
router.get('/',
  authenticateToken,
  requireVerified,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const notifications = await query<Notification>(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [userId]
    );
    const unreadCount = notifications.filter((n) => !n.read_at).length;
    res.json({ notifications, unreadCount });
  }
);

// POST /api/notifications/:id/read
router.post('/:id/read',
  authenticateToken,
  requireVerified,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user!.id;
    const result = await query(
      'UPDATE notifications SET read_at = NOW() WHERE id = $1 AND user_id = $2 AND read_at IS NULL RETURNING *',
      [id, userId]
    );
    if (!result.length) { sendError(res, 404, 'Notification not found'); return; }
    res.json({ message: 'Marked as read' });
  }
);

// POST /api/notifications/read-all
router.post('/read-all',
  authenticateToken,
  requireVerified,
  async (req: AuthRequest, res: Response): Promise<void> => {
    await query(
      'UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL',
      [req.user!.id]
    );
    res.json({ message: 'All notifications marked as read' });
  }
);

export async function createNotification(params: {
  userId: string;
  type: string;
  title: string;
  body: string;
  entityId?: string;
  entityType?: string;
}): Promise<void> {
  await query(
    `INSERT INTO notifications (user_id, type, title, body, entity_id, entity_type)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [params.userId, params.type, params.title, params.body,
      params.entityId ?? null, params.entityType ?? null]
  );
}

export default router;
