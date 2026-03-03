import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

dotenv.config();

import authRouter from './routes/auth';
import familiesRouter from './routes/families';
import personsRouter from './routes/persons';
import proposalsRouter from './routes/proposals';
import relationshipsRouter from './routes/relationships';
import { generalRateLimiter } from './middleware/rateLimiter';
import { sendError } from './utils/helpers';

const app = express();
const PORT = process.env.PORT ?? 4000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use(generalRateLimiter);

// Routes
app.use('/api/auth', authRouter);
app.use('/api/families', familiesRouter);
app.use('/api/families/:id/persons', personsRouter);
app.use('/api/families/:id', personsRouter); // for /proposals sub-route
app.use('/api/proposals', proposalsRouter);
app.use('/api', relationshipsRouter);

// Invite validation (standalone)
app.use('/api/invites', familiesRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404
app.use((_req, res) => {
  sendError(res, 404, 'Not found');
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  sendError(res, 500, 'Internal server error');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
