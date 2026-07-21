import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';
import { errorHandler } from './middleware/errorHandler';
import { sanitizeInput } from './middleware/validate';
import authRoutes from './routes/auth';
import documentRoutes from './routes/documents';
import matterRoutes from './routes/matters';
import userRoutes from './routes/users';
import templateRoutes from './routes/templates';
import aiRoutes from './routes/ai';
import { StorageService } from './services/storageService';

const prisma = new PrismaClient();

function origins() {
  const configured = String(process.env.FRONTEND_URL || '').split(',').map(item => item.trim()).filter(Boolean);
  if (process.env.NODE_ENV === 'production' && !configured.length) throw new Error('FRONTEND_URL_REQUIRED');
  return configured.length ? configured : ['http://localhost:3000'];
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], objectSrc: ["'none'"], frameAncestors: ["'none'"] } } }));
  app.use(cors({ origin: origins(), credentials: true, methods: ['GET', 'POST', 'PUT', 'DELETE'] }));
  app.use(rateLimit({ windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 900_000), limit: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 100), standardHeaders: true, legacyHeaders: false }));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(cookieParser());
  app.use(sanitizeInput);

  app.use('/api/auth', authRoutes);
  app.use('/api/documents', documentRoutes);
  app.use('/api/matters', matterRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/templates', templateRoutes);
  app.use('/api/ai', aiRoutes);

  app.get('/health/live', (_req, res) => res.json({ status: 'alive', timestamp: new Date().toISOString(), uptime: process.uptime() }));
  app.get('/health/ready', async (_req, res) => {
    const checks = { database: false, objectStorage: false, malwareScanner: false };
    try { await prisma.$queryRaw`SELECT 1`; checks.database = true; } catch { /* reported below */ }
    try { checks.objectStorage = await new StorageService().healthCheck(); } catch { /* reported below */ }
    try {
      const endpoint = process.env.MALWARE_SCANNER_HEALTH_URL;
      if (endpoint) checks.malwareScanner = (await fetch(endpoint, { signal: AbortSignal.timeout(3000) })).ok;
    } catch { /* reported below */ }
    const ready = Object.values(checks).every(Boolean);
    res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready', checks, timestamp: new Date().toISOString() });
  });
  app.get('/health', (_req, res) => res.json({ status: 'alive', readiness: '/health/ready' }));
  app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
  app.use(errorHandler);
  return app;
}
