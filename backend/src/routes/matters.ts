import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { DocumentActor, DocumentService } from '../services/documentService';
import { authorizeMatter } from '../security/policy';
import { appendAudit } from '../security/audit';
import crypto from 'node:crypto';
import { EmailService } from '../services/emailService';

const router = Router();
const prisma = new PrismaClient();
const documents = new DocumentService();
router.use(authenticate);
const actor = (req: AuthRequest): DocumentActor => req.user!;

router.get('/', async (req: AuthRequest, res) => {
  if (req.user!.role === 'ADMIN' && !req.user!.privileged) return res.status(403).json({ error: 'Recent MFA-verified administrator session required' });
  const matters = await prisma.matter.findMany({ where: { organizationId: req.user!.organizationId, ...(req.user!.role === 'ADMIN' ? {} : { members: { some: { userId: req.user!.id, revokedAt: null } } }) }, include: { members: { where: { userId: req.user!.id } }, _count: { select: { documents: true, members: true } } }, orderBy: { updatedAt: 'desc' } });
  return res.json({ data: matters });
});

router.post('/', async (req: AuthRequest, res) => {
  const name = String(req.body.name || '').trim(); const reference = String(req.body.reference || '').trim(); const jurisdiction = String(req.body.jurisdiction || '').trim(); const retentionUntil = new Date(req.body.retentionUntil);
  if (!name || !reference || !jurisdiction || !Number.isFinite(retentionUntil.getTime()) || retentionUntil <= new Date()) return res.status(400).json({ error: 'name, reference, jurisdiction, and future retentionUntil are required' });
  const matter = await prisma.$transaction(async tx => {
    const created = await tx.matter.create({ data: { organizationId: req.user!.organizationId, name, reference, jurisdiction, retentionUntil, createdById: req.user!.id } });
    await tx.matterMember.create({ data: { matterId: created.id, userId: req.user!.id, role: 'OWNER' } });
    await appendAudit(tx, { organizationId: req.user!.organizationId, matterId: created.id, userId: req.user!.id, action: 'MATTER_CREATED', details: { reference: created.reference, jurisdiction: created.jurisdiction, retentionUntil: created.retentionUntil.toISOString() } });
    return created;
  });
  return res.status(201).json(matter);
});

router.post('/:id/invitations', async (req: AuthRequest, res, next) => {
  try {
    const matter = await prisma.matter.findFirst({ where: { id: req.params.id, organizationId: req.user!.organizationId }, include: { members: { where: { userId: req.user!.id } } } });
    if (!matter) return res.status(404).json({ error: 'Matter not found' });
    const access = authorizeMatter({ actor: req.user!, organizationId: matter.organizationId, membership: matter.members[0], action: 'write' });
    if (!access.allowed) return res.status(403).json({ error: access.reason });
    if (req.user!.role !== 'ADMIN' && !['OWNER', 'COUNSEL'].includes(matter.members[0]?.role)) return res.status(403).json({ error: 'Only matter owners or counsel may invite members' });
    const email = String(req.body.email || '').trim().toLowerCase();
    const role = String(req.body.role || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !['COUNSEL', 'PARALEGAL', 'CLIENT', 'WITNESS', 'AUDITOR'].includes(role)) return res.status(400).json({ error: 'Valid email and non-owner matter role required' });
    if (await prisma.user.findUnique({ where: { email } })) return res.status(409).json({ error: 'Existing organization users must be added with the member endpoint' });
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const invitation = await prisma.matterInvitation.create({ data: { organizationId: matter.organizationId, matterId: matter.id, email, role: role as any, tokenHash, invitedById: req.user!.id, expiresAt: new Date(Date.now() + 72 * 3_600_000) } });
    try {
      const inviter = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
      await EmailService.sendMatterInvitation({ to: email, inviterName: `${inviter.firstName} ${inviter.lastName}`, matterName: matter.name, token: rawToken });
      await prisma.$transaction(async tx => appendAudit(tx, { organizationId: matter.organizationId, matterId: matter.id, userId: req.user!.id, action: 'MATTER_INVITATION_SENT', details: { invitationId: invitation.id, email, role, expiresAt: invitation.expiresAt.toISOString() } }));
      return res.status(202).json({ invitationId: invitation.id, email, role, expiresAt: invitation.expiresAt });
    } catch (error) {
      await prisma.matterInvitation.deleteMany({ where: { id: invitation.id, acceptedAt: null } });
      throw error;
    }
  } catch (error) { return next(error); }
});

router.post('/:id/members', async (req: AuthRequest, res) => {
  const matter = await prisma.matter.findFirst({ where: { id: req.params.id, organizationId: req.user!.organizationId }, include: { members: { where: { userId: req.user!.id } } } });
  if (!matter) return res.status(404).json({ error: 'Matter not found' });
  const access = authorizeMatter({ actor: req.user!, organizationId: matter.organizationId, membership: matter.members[0], action: 'write' });
  if (!access.allowed) return res.status(403).json({ error: access.reason });
  if (req.user!.role !== 'ADMIN' && matter.members[0]?.role !== 'OWNER' && matter.members[0]?.role !== 'COUNSEL') return res.status(403).json({ error: 'Only matter owners or counsel may manage access' });
  const user = await prisma.user.findFirst({ where: { id: req.body.userId, organizationId: req.user!.organizationId, isActive: true } });
  if (!user || !['OWNER', 'COUNSEL', 'PARALEGAL', 'CLIENT', 'WITNESS', 'AUDITOR'].includes(req.body.role)) return res.status(400).json({ error: 'Valid organization user and matter role are required' });
  const member = await prisma.$transaction(async tx => {
    const value = await tx.matterMember.upsert({ where: { matterId_userId: { matterId: matter.id, userId: user.id } }, update: { role: req.body.role, revokedAt: null }, create: { matterId: matter.id, userId: user.id, role: req.body.role } });
    await appendAudit(tx, { organizationId: req.user!.organizationId, matterId: matter.id, userId: req.user!.id, action: 'MATTER_ACCESS_GRANTED', details: { subjectUserId: user.id, matterRole: value.role } });
    return value;
  });
  return res.status(201).json(member);
});

router.delete('/:id/members/:userId', async (req: AuthRequest, res) => {
  const matter = await prisma.matter.findFirst({ where: { id: req.params.id, organizationId: req.user!.organizationId }, include: { members: { where: { userId: req.user!.id } } } });
  if (!matter) return res.status(404).json({ error: 'Matter not found' });
  const access = authorizeMatter({ actor: req.user!, organizationId: matter.organizationId, membership: matter.members[0], action: 'write' });
  if (!access.allowed) return res.status(403).json({ error: access.reason });
  if (req.user!.role !== 'ADMIN' && matter.members[0]?.role !== 'OWNER' && matter.members[0]?.role !== 'COUNSEL') return res.status(403).json({ error: 'Only matter owners or counsel may manage access' });
  const result = await prisma.$transaction(async tx => {
    const value = await tx.matterMember.updateMany({ where: { matterId: matter.id, userId: req.params.userId, role: { not: 'OWNER' }, revokedAt: null }, data: { revokedAt: new Date() } });
    if (value.count) await appendAudit(tx, { organizationId: req.user!.organizationId, matterId: matter.id, userId: req.user!.id, action: 'MATTER_ACCESS_REVOKED', details: { subjectUserId: req.params.userId } });
    return value;
  });
  if (!result.count) return res.status(409).json({ error: 'Membership not found or owner access cannot be revoked here' });
  return res.json({ revoked: true });
});

router.post('/:id/legal-holds', async (req: AuthRequest, res, next) => {
  try { return res.status(201).json(await documents.placeHold(req.params.id, actor(req), String(req.body.reference || ''), String(req.body.reason || ''))); }
  catch (error) { return next(error); }
});

router.post('/legal-holds/:holdId/release', async (req: AuthRequest, res, next) => {
  try { return res.json(await documents.releaseHold(req.params.holdId, actor(req), String(req.body.reason || ''))); }
  catch (error) { return next(error); }
});

router.get('/:id/audit', async (req: AuthRequest, res) => {
  const matter = await prisma.matter.findFirst({ where: { id: req.params.id, organizationId: req.user!.organizationId }, include: { members: { where: { userId: req.user!.id } } } });
  if (!matter) return res.status(404).json({ error: 'Matter not found' });
  const access = authorizeMatter({ actor: req.user!, organizationId: matter.organizationId, membership: matter.members[0], action: 'audit' });
  if (!access.allowed) return res.status(403).json({ error: access.reason });
  const events = await prisma.auditLog.findMany({ where: { matterId: matter.id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  return res.json({ events });
});

export default router;
