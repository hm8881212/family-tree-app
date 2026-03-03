import { Response } from 'express';

export function sendError(res: Response, status: number, message: string, details?: unknown): void {
  res.status(status).json({ error: message, ...(details ? { details } : {}) });
}

export function sendValidationError(res: Response, details: unknown): void {
  sendError(res, 422, 'Validation failed', details);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
