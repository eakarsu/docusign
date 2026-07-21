import crypto from 'node:crypto';
import { Router } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest, requirePrivileged } from '../middleware/auth';
import { IntegrationService } from '../services/integrationService';
import { appendAudit } from '../security/audit';

const router = Router();
const prisma = new PrismaClient();
const integrations = new IntegrationService();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1)); const limit = Math.min(100, Math.max(1, Number(req.query.limit || 10))); const search = String(req.query.search || '');
    const where: Prisma.TemplateWhereInput = { organizationId: req.user!.organizationId, ...(search && { OR: [{ name: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }] }) };
    const [data, total] = await Promise.all([prisma.template.findMany({ where, include: { creator: { select: { id: true, firstName: true, lastName: true, email: true } }, reviewedBy: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * limit, take: limit }), prisma.template.count({ where })]);
    return res.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) { return next(error); }
});

router.get('/export/csv', async (req: AuthRequest, res, next) => {
  try {
    const templates = await prisma.template.findMany({ where: { organizationId: req.user!.organizationId }, orderBy: { updatedAt: 'desc' } });
    const quote = (value: unknown) => { const raw = String(value ?? ''); const neutralized = /^[=+\-@]/.test(raw) ? `'${raw}` : raw; return `"${neutralized.replace(/"/g, '""')}"`; };
    const rows = [['Name', 'Jurisdiction', 'Authority', 'Source Version', 'Checksum', 'Authoritative', 'Effective From', 'Effective To'].map(quote).join(',')];
    for (const item of templates) rows.push([item.name, item.jurisdiction, item.authority, item.sourceVersion, item.checksum, item.isAuthoritative, item.effectiveFrom.toISOString(), item.effectiveTo?.toISOString()].map(quote).join(','));
    res.setHeader('content-type', 'text/csv; charset=utf-8'); res.setHeader('content-disposition', 'attachment; filename="templates-export.csv"'); return res.send(rows.join('\n'));
  } catch (error) { return next(error); }
});

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const { name, description, fileUrl, fields = {}, jurisdiction = 'UNSPECIFIED' } = req.body;
    if (!String(name || '').trim()) return res.status(400).json({ error: 'name is required' });
    const checksum = crypto.createHash('sha256').update(JSON.stringify({ name, description, fileUrl, fields })).digest('hex');
    const template = await prisma.$transaction(async tx => {
      const created = await tx.template.create({ data: { organizationId: req.user!.organizationId, name: String(name).trim(), description, fileUrl: String(fileUrl || ''), storageKey: '', checksum, fields, jurisdiction, authority: 'user-draft', authorityUrl: '', sourceVersion: `draft-${crypto.randomUUID()}`, effectiveFrom: new Date(), isPublic: false, isAuthoritative: false, creatorId: req.user!.id } });
      await appendAudit(tx, { organizationId: req.user!.organizationId, userId: req.user!.id, action: 'TEMPLATE_DRAFT_CREATED', details: { templateId: created.id, checksum: created.checksum } });
      return created;
    });
    return res.status(201).json(template);
  } catch (error) { return next(error); }
});

router.post('/sync', requirePrivileged, async (req: AuthRequest, res, next) => {
  const requestId = crypto.randomUUID();
  const job = await prisma.integrationJob.create({ data: { organizationId: req.user!.organizationId, kind: 'TEMPLATE_SYNC', requestId, provider: 'pending', status: 'IN_PROGRESS', attempts: 1 } });
  try {
    const result = await integrations.call<{ templates: Array<{ name: string; description?: string; storageKey: string; checksum: string; fields: unknown; jurisdiction: string; authority: string; authorityUrl: string; sourceVersion: string; effectiveFrom: string; effectiveTo?: string }> }>('TEMPLATE_REGISTRY', requestId, { organizationId: req.user!.organizationId, cursor: req.body.cursor });
    if (!Array.isArray(result.data.templates)) throw new Error('TEMPLATE_REGISTRY_RESPONSE_INVALID');
    const synchronized = await prisma.$transaction(async tx => {
      const ids: string[] = [];
      for (const item of result.data.templates) {
        if (!item.name || !item.storageKey || !/^[a-f0-9]{64}$/i.test(item.checksum) || !item.jurisdiction || !item.authority || !item.authorityUrl || !item.sourceVersion || !Number.isFinite(new Date(item.effectiveFrom).getTime())) throw new Error('TEMPLATE_REGISTRY_ITEM_INVALID');
        const template = await tx.template.upsert({ where: { organizationId_authority_sourceVersion: { organizationId: req.user!.organizationId, authority: item.authority, sourceVersion: item.sourceVersion } }, update: { name: item.name, description: item.description, storageKey: item.storageKey, fileUrl: '', checksum: item.checksum, fields: item.fields as Prisma.InputJsonValue, jurisdiction: item.jurisdiction, authorityUrl: item.authorityUrl, effectiveFrom: new Date(item.effectiveFrom), effectiveTo: item.effectiveTo ? new Date(item.effectiveTo) : null, isAuthoritative: true, reviewedById: req.user!.id, reviewedAt: new Date() }, create: { organizationId: req.user!.organizationId, creatorId: req.user!.id, name: item.name, description: item.description, storageKey: item.storageKey, fileUrl: '', checksum: item.checksum, fields: item.fields as Prisma.InputJsonValue, jurisdiction: item.jurisdiction, authority: item.authority, authorityUrl: item.authorityUrl, sourceVersion: item.sourceVersion, effectiveFrom: new Date(item.effectiveFrom), effectiveTo: item.effectiveTo ? new Date(item.effectiveTo) : null, isAuthoritative: true, reviewedById: req.user!.id, reviewedAt: new Date() } });
        ids.push(template.id);
      }
      await tx.integrationJob.update({ where: { id: job.id }, data: { status: 'COMPLETED', provider: result.provider, providerVersion: result.providerVersion, outputChecksum: result.checksum, response: { templateIds: ids } } });
      await appendAudit(tx, { organizationId: req.user!.organizationId, userId: req.user!.id, action: 'AUTHORITATIVE_TEMPLATES_SYNCHRONIZED', details: { provider: result.provider, providerVersion: result.providerVersion, responseChecksum: result.checksum, templateIds: ids, privilegedReason: req.header('X-Privileged-Reason') } });
      return ids;
    });
    return res.json({ synchronized });
  } catch (error) {
    await prisma.integrationJob.update({ where: { id: job.id }, data: { status: 'FAILED', error: error instanceof Error ? error.message : 'TEMPLATE_SYNC_FAILED' } });
    return next(error);
  }
});

router.put('/:id', async (req: AuthRequest, res, next) => {
  try {
    const template = await prisma.template.findFirst({ where: { id: req.params.id, organizationId: req.user!.organizationId } });
    if (!template) return res.status(404).json({ error: 'Template not found' });
    if (template.creatorId !== req.user!.id || template.isAuthoritative) return res.status(403).json({ error: 'Only the creator may edit a non-authoritative draft' });
    const updated = await prisma.$transaction(async tx => {
      const value = await tx.template.update({ where: { id: template.id }, data: { name: req.body.name || undefined, description: req.body.description, fields: req.body.fields } });
      await appendAudit(tx, { organizationId: req.user!.organizationId, userId: req.user!.id, action: 'TEMPLATE_DRAFT_UPDATED', details: { templateId: value.id } });
      return value;
    });
    return res.json(updated);
  } catch (error) { return next(error); }
});

router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const result = await prisma.$transaction(async tx => {
      const deleted = await tx.template.deleteMany({ where: { id: req.params.id, organizationId: req.user!.organizationId, creatorId: req.user!.id, isAuthoritative: false } });
      if (deleted.count) await appendAudit(tx, { organizationId: req.user!.organizationId, userId: req.user!.id, action: 'TEMPLATE_DRAFT_DELETED', details: { templateId: req.params.id } });
      return deleted;
    });
    if (!result.count) return res.status(404).json({ error: 'Editable draft template not found' });
    return res.json({ success: true });
  } catch (error) { return next(error); }
});

export default router;
