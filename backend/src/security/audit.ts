import crypto from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';

type AuditClient = PrismaClient | Prisma.TransactionClient;

function config() {
  const secret = process.env.AUDIT_SIGNING_KEY;
  const keyId = process.env.AUDIT_SIGNING_KEY_ID;
  if (!secret || secret.length < 32 || !keyId) throw new Error('AUDIT_SIGNING_KEY_AND_ID_REQUIRED');
  return { secret, keyId };
}

export async function appendAudit(client: AuditClient, event: {
  organizationId: string;
  matterId?: string;
  documentId?: string;
  userId?: string;
  action: string;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) {
  const { secret, keyId } = config();
  await client.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${event.organizationId}, 0)) IS NULL AS locked`);
  const previous = await client.auditLog.findFirst({ where: { organizationId: event.organizationId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  const createdAt = new Date();
  const canonical = JSON.stringify({ ...event, createdAt: createdAt.toISOString(), previousHash: previous?.eventHash ?? null });
  const eventHash = crypto.createHash('sha256').update(canonical).digest('hex');
  const signature = crypto.createHmac('sha256', secret).update(eventHash).digest('hex');
  return client.auditLog.create({ data: {
    organizationId: event.organizationId,
    matterId: event.matterId,
    documentId: event.documentId,
    userId: event.userId,
    action: event.action,
    details: event.details as Prisma.InputJsonValue,
    ipAddress: event.ipAddress,
    userAgent: event.userAgent,
    previousHash: previous?.eventHash,
    eventHash,
    signature,
    signingKeyId: keyId,
    createdAt,
  } });
}

export function verifyAudit(eventHash: string, signature: string, secret: string) {
  const expected = crypto.createHmac('sha256', secret).update(eventHash).digest();
  const actual = Buffer.from(signature, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
