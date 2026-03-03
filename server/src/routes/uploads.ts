/**
 * Photo upload via presigned URLs (Cloudflare R2 or AWS S3)
 * Flow: client requests presigned URL → uploads directly to R2 → calls /confirm to update person record
 */
import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import crypto from 'crypto';
import { queryOne, query } from '../db';
import { sendError, sendValidationError } from '../utils/helpers';
import { authenticateToken, requireVerified, AuthRequest } from '../middleware/auth';
import { writeAuditLog } from '../middleware/audit';
import { Person } from '../types';

const router = Router();

// Lazy-init S3 client (works with R2 via S3-compat API)
let s3: import('@aws-sdk/client-s3').S3Client | null = null;

async function getS3(): Promise<import('@aws-sdk/client-s3').S3Client> {
  if (s3) return s3;
  const { S3Client } = await import('@aws-sdk/client-s3');
  s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    },
  });
  return s3;
}

// POST /api/uploads/photo-url — get presigned PUT URL
router.post('/photo-url',
  authenticateToken,
  requireVerified,
  [
    body('person_id').isUUID(),
    body('content_type').isIn(['image/jpeg', 'image/png', 'image/webp']),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { sendValidationError(res, errors.array()); return; }

    if (!process.env.R2_ACCOUNT_ID || !process.env.R2_BUCKET) {
      sendError(res, 503, 'Photo uploads not configured (R2 env vars missing)'); return;
    }

    const { person_id, content_type } = req.body as { person_id: string; content_type: string };

    // Verify person exists
    const person = await queryOne<Person>('SELECT id FROM persons WHERE id = $1 AND deleted_at IS NULL', [person_id]);
    if (!person) { sendError(res, 404, 'Person not found'); return; }

    const ext = content_type === 'image/png' ? 'png' : content_type === 'image/webp' ? 'webp' : 'jpg';
    const key = `photos/${person_id}/${crypto.randomBytes(8).toString('hex')}.${ext}`;

    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const client = await getS3();

    const url = await getSignedUrl(client, new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      ContentType: content_type,
      CacheControl: 'public, max-age=31536000',
    }), { expiresIn: 300 }); // 5 minutes

    const publicUrl = `${process.env.R2_PUBLIC_URL ?? `https://pub-${process.env.R2_ACCOUNT_ID}.r2.dev`}/${key}`;

    res.json({ upload_url: url, public_url: publicUrl, key });
  }
);

// POST /api/uploads/photo-confirm — after upload, update person record
router.post('/photo-confirm',
  authenticateToken,
  requireVerified,
  [
    body('person_id').isUUID(),
    body('public_url').isURL(),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { sendValidationError(res, errors.array()); return; }

    const { person_id, public_url } = req.body as { person_id: string; public_url: string };
    const userId = req.user!.id;

    const [updated] = await query<Person>(
      'UPDATE persons SET photo_url = $1 WHERE id = $2 AND deleted_at IS NULL RETURNING *',
      [public_url, person_id]
    );
    if (!updated) { sendError(res, 404, 'Person not found'); return; }

    await writeAuditLog({ entityType: 'person', entityId: person_id, action: 'photo_updated', actorId: userId, newValue: { photo_url: public_url } });

    res.json({ person: updated, message: 'Photo updated.' });
  }
);

export default router;
