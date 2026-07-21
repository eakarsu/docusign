import crypto from 'node:crypto';
import { MatterAction, authorizeMatter, safeObjectKey, validateDocumentBytes } from '../security/policy';
import { appendAudit } from '../security/audit';
import { StorageService } from './storageService';
import { IntegrationService } from './integrationService';
import { EmailService } from './emailService';
import { Prisma, PrismaClient } from '@prisma/client';
import { createError } from '../middleware/errorHandler';

type Database = PrismaClient | Prisma.TransactionClient;
export interface DocumentActor { id: string; organizationId: string; role: 'ADMIN' | 'SENDER' | 'SIGNER' | 'VIEWER'; privileged: boolean }

export class DocumentService {
  constructor(
    private prisma = new PrismaClient(),
    private storage = new StorageService(),
    private integrations = new IntegrationService(),
  ) {}

  private async matter(matterId: string, actor: DocumentActor, action: MatterAction, client: Database = this.prisma) {
    const matter = await client.matter.findFirst({
      where: { id: matterId, organizationId: actor.organizationId },
      include: { members: { where: { userId: actor.id }, take: 1 } },
    });
    if (!matter) throw createError('Matter not found', 404);
    const decision = authorizeMatter({ actor, organizationId: matter.organizationId, membership: matter.members[0], action });
    if (!decision.allowed) throw createError(decision.reason, 403);
    return matter;
  }

  private async document(documentId: string, actor: DocumentActor, action: MatterAction, client: Database = this.prisma) {
    const document = await client.document.findFirst({ where: { id: documentId, matter: { organizationId: actor.organizationId }, deletedAt: null } });
    if (!document) throw createError('Document not found', 404);
    await this.matter(document.matterId, actor, action, client);
    return document;
  }

  private async defaultMatter(actor: DocumentActor) {
    const membership = await this.prisma.matterMember.findFirst({ where: { userId: actor.id, revokedAt: null, matter: { organizationId: actor.organizationId, status: 'ACTIVE' } }, include: { matter: true }, orderBy: { createdAt: 'asc' } });
    if (!membership) throw createError('No active matter is available', 409);
    return membership.matter;
  }

  async list(actor: DocumentActor, input: { page: number; limit: number; search?: string; status?: string; matterId?: string; sortBy?: string; sortOrder?: string }) {
    const page = Math.max(1, input.page);
    const limit = Math.min(100, Math.max(1, input.limit));
    const allowedSort = new Set(['createdAt', 'updatedAt', 'title', 'status']);
    const sortBy = allowedSort.has(input.sortBy || '') ? input.sortBy! : 'createdAt';
    const sortOrder = input.sortOrder === 'asc' ? 'asc' : 'desc';
    const where: Prisma.DocumentWhereInput = {
      deletedAt: null,
      matter: {
        organizationId: actor.organizationId,
        ...(actor.role === 'ADMIN' ? {} : { members: { some: { userId: actor.id, revokedAt: null } } }),
      },
      ...(input.matterId && { matterId: input.matterId }),
      ...(input.status && input.status !== 'all' && { status: input.status as any }),
      ...(input.search && { OR: [{ title: { contains: input.search, mode: 'insensitive' } }, { description: { contains: input.search, mode: 'insensitive' } }] }),
    };
    if (actor.role === 'ADMIN' && !actor.privileged) throw createError('PRIVILEGED_SESSION_REQUIRED', 403);
    const [documents, total] = await Promise.all([
      this.prisma.document.findMany({ where, include: { sender: { select: { id: true, email: true, firstName: true, lastName: true } }, signatures: { select: { id: true, status: true, signerEmail: true, signerName: true, signedAt: true } }, _count: { select: { signatures: true, versions: true } } }, orderBy: { [sortBy]: sortOrder }, skip: (page - 1) * limit, take: limit }),
      this.prisma.document.count({ where }),
    ]);
    return { data: documents, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async get(documentId: string, actor: DocumentActor) {
    await this.document(documentId, actor, 'read');
    const document = await this.prisma.document.findUniqueOrThrow({ where: { id: documentId }, include: {
      matter: { select: { id: true, name: true, reference: true, jurisdiction: true, retentionUntil: true, legalHoldActive: true, members: { where: { userId: actor.id, revokedAt: null }, select: { userId: true, role: true } } } },
      sender: { select: { id: true, email: true, firstName: true, lastName: true } },
      fields: true,
      signatures: { select: { id: true, signerEmail: true, signerName: true, routingOrder: true, status: true, signedAt: true, declinedAt: true, failureReason: true, createdAt: true, updatedAt: true, signer: { select: { id: true, email: true, firstName: true, lastName: true } } } },
      versions: { select: { id: true, version: true, checksum: true, fileSize: true, mimeType: true, provenance: true, ocrProvider: true, ocrVersion: true, createdById: true, createdAt: true }, orderBy: { version: 'desc' } },
      legalReviews: { orderBy: { createdAt: 'desc' } },
      aiAnalysis: true,
    } });
    return { ...document, fileUrl: `/api/documents/${document.id}/download` };
  }

  async download(documentId: string, actor: DocumentActor) {
    const document = await this.document(documentId, actor, 'read');
    const version = await this.prisma.documentVersion.findUniqueOrThrow({ where: { documentId_version: { documentId, version: document.currentVersion } } });
    const url = await this.storage.presignedDownload(version.storageKey, actor.organizationId, document.matterId, version.storageVersionId || undefined);
    return { url, checksum: version.checksum, expiresInSeconds: 300, version: version.version };
  }

  async upload(file: Express.Multer.File, actor: DocumentActor, input: { matterId?: string; title: string; description?: string; jurisdiction?: string; effectiveDate?: Date }) {
    const matter = input.matterId ? await this.matter(input.matterId, actor, 'write') : await this.defaultMatter(actor);
    const decision = authorizeMatter({ actor, organizationId: matter.organizationId, membership: await this.prisma.matterMember.findUnique({ where: { matterId_userId: { matterId: matter.id, userId: actor.id } } }), action: 'write' });
    if (!decision.allowed) throw createError(decision.reason, 403);
    const validation = validateDocumentBytes(file.buffer, { filename: file.originalname, mimeType: file.mimetype, size: file.size });
    if (!validation.accepted) throw createError(validation.reason, 422);
    const id = crypto.randomUUID();
    const key = safeObjectKey(actor.organizationId, matter.id, id, 1, file.originalname);
    const stored = await this.storage.upload(file.buffer, { key, filename: file.originalname, mimeType: file.mimetype, organizationId: actor.organizationId, matterId: matter.id, userId: actor.id });
    const effectiveDate = input.effectiveDate || new Date();
    try {
      return await this.prisma.$transaction(async tx => {
        const document = await tx.document.create({ data: {
          id,
          matterId: matter.id,
          title: input.title.trim(),
          description: input.description?.trim(),
          originalFileName: file.originalname,
          fileUrl: `/api/documents/${id}/download`,
          storageKey: stored.key,
          storageVersionId: stored.versionId,
          checksum: stored.checksum,
          fileSize: file.size,
          mimeType: file.mimetype,
          senderId: actor.id,
          provenance: { source: 'user-upload', originalFileName: file.originalname, uploadedAt: new Date().toISOString() },
          jurisdiction: input.jurisdiction || matter.jurisdiction,
          effectiveDate,
          retentionUntil: matter.retentionUntil,
        } });
        await tx.documentVersion.create({ data: { documentId: id, version: 1, storageKey: stored.key, storageVersionId: stored.versionId, checksum: stored.checksum, fileSize: file.size, mimeType: file.mimetype, provenance: document.provenance as Prisma.InputJsonValue, createdById: actor.id } });
        await appendAudit(tx, { organizationId: actor.organizationId, matterId: matter.id, documentId: id, userId: actor.id, action: 'DOCUMENT_UPLOADED', details: { version: 1, checksum: stored.checksum, storageVersionId: stored.versionId } });
        return document;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      await this.storage.deleteAllVersions(stored.key, actor.organizationId, matter.id);
      throw error;
    }
  }

  async addVersion(documentId: string, file: Express.Multer.File, actor: DocumentActor, expectedRowVersion: number) {
    const document = await this.document(documentId, actor, 'write');
    if (!['DRAFT', 'CANCELLED'].includes(document.status)) throw createError('Only draft or cancelled documents can be versioned', 409);
    if (document.legalHoldActive) throw createError('LEGAL_HOLD_ACTIVE', 409);
    const nextVersion = document.currentVersion + 1;
    const key = safeObjectKey(actor.organizationId, document.matterId, document.id, nextVersion, file.originalname);
    const stored = await this.storage.upload(file.buffer, { key, filename: file.originalname, mimeType: file.mimetype, organizationId: actor.organizationId, matterId: document.matterId, userId: actor.id });
    try {
      return await this.prisma.$transaction(async tx => {
        const updated = await tx.document.updateMany({ where: { id: document.id, rowVersion: expectedRowVersion, currentVersion: document.currentVersion }, data: { currentVersion: nextVersion, rowVersion: { increment: 1 }, storageKey: key, storageVersionId: stored.versionId, checksum: stored.checksum, fileSize: file.size, mimeType: file.mimetype, originalFileName: file.originalname, legalReviewStatus: 'STALE' } });
        if (updated.count !== 1) throw createError('DOCUMENT_VERSION_CONFLICT', 409);
        const version = await tx.documentVersion.create({ data: { documentId: document.id, version: nextVersion, storageKey: key, storageVersionId: stored.versionId, checksum: stored.checksum, fileSize: file.size, mimeType: file.mimetype, provenance: { source: 'user-upload', replacesVersion: document.currentVersion, originalFileName: file.originalname }, createdById: actor.id } });
        await tx.aIArtifact.updateMany({ where: { documentId: document.id, status: 'PENDING_REVIEW' }, data: { status: 'STALE' } });
        await appendAudit(tx, { organizationId: actor.organizationId, matterId: document.matterId, documentId: document.id, userId: actor.id, action: 'DOCUMENT_VERSION_ADDED', details: { from: document.currentVersion, to: nextVersion, checksum: stored.checksum } });
        return version;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      await this.storage.deleteAllVersions(stored.key, actor.organizationId, document.matterId);
      throw error;
    }
  }

  async addFields(documentId: string, fields: any[], actor: DocumentActor) {
    const document = await this.document(documentId, actor, 'write');
    if (document.status !== 'DRAFT') throw createError('FIELDS_LOCKED_AFTER_SEND', 409);
    const clean = fields.map(field => {
      const x = Number(field.x); const y = Number(field.y); const width = Number(field.width); const height = Number(field.height); const page = Number(field.page || 1);
      if (![x, y, width, height, page].every(Number.isFinite) || x < 0 || y < 0 || width <= 0 || height <= 0 || page < 1) throw createError('INVALID_FIELD_GEOMETRY', 400);
      return { documentId, documentVersion: document.currentVersion, type: field.type, label: String(field.label || '').slice(0, 200), x, y, width, height, page, required: field.required !== false, signerEmail: field.signerEmail ? String(field.signerEmail).toLowerCase() : null };
    });
    return this.prisma.$transaction(async tx => {
      await tx.documentField.deleteMany({ where: { documentId, documentVersion: document.currentVersion } });
      const result = await tx.documentField.createMany({ data: clean });
      await appendAudit(tx, { organizationId: actor.organizationId, matterId: document.matterId, documentId, userId: actor.id, action: 'SIGNATURE_FIELDS_REPLACED', details: { version: document.currentVersion, count: result.count } });
      return result;
    });
  }

  async redact(documentId: string, actor: DocumentActor, expectedRowVersion: number, marks: Array<{ page: number; x: number; y: number; width: number; height: number; reason: string }>) {
    const document = await this.document(documentId, actor, 'write');
    if (!['DRAFT', 'CANCELLED'].includes(document.status)) throw createError('ONLY_DRAFT_DOCUMENTS_CAN_BE_REDACTED', 409);
    if (document.legalHoldActive) throw createError('LEGAL_HOLD_ACTIVE', 409);
    if (!Number.isInteger(expectedRowVersion) || !marks.length || marks.length > 100) throw createError('ROW_VERSION_AND_REDACTION_MARKS_REQUIRED', 400);
    const redactions = marks.map(mark => {
      const page = Number(mark.page); const x = Number(mark.x); const y = Number(mark.y); const width = Number(mark.width); const height = Number(mark.height); const reason = String(mark.reason || '').trim();
      if (![page, x, y, width, height].every(Number.isFinite) || !Number.isInteger(page) || page < 1 || x < 0 || y < 0 || width <= 0 || height <= 0 || reason.length < 5) throw createError('INVALID_REDACTION_MARK', 400);
      return { page, x, y, width, height, reason: reason.slice(0, 500) };
    });
    const source = await this.prisma.documentVersion.findUniqueOrThrow({ where: { documentId_version: { documentId, version: document.currentVersion } } });
    const object = await this.storage.download(source.storageKey, actor.organizationId, document.matterId, source.storageVersionId || undefined);
    if (object.checksum !== source.checksum) throw createError('OBJECT_CHECKSUM_MISMATCH', 409);
    const requestId = crypto.randomUUID();
    const job = await this.prisma.integrationJob.create({ data: { organizationId: actor.organizationId, matterId: document.matterId, documentId, kind: 'REDACTION', requestId, provider: 'pending', status: 'IN_PROGRESS', attempts: 1, inputChecksum: source.checksum } });
    try {
      const result = await this.integrations.call<{ contentBase64: string; redactionManifest: unknown; irreversible: boolean }>('REDACTION', requestId, { contentBase64: object.body.toString('base64'), mimeType: source.mimeType, sourceChecksum: source.checksum, marks: redactions });
      if (!result.data.irreversible || !result.data.contentBase64) throw new Error('REDACTION_PROVIDER_RESPONSE_INVALID');
      const output = Buffer.from(result.data.contentBase64, 'base64');
      const filename = `redacted-v${document.currentVersion + 1}.pdf`;
      const validation = validateDocumentBytes(output, { filename, mimeType: 'application/pdf', size: output.length });
      if (!validation.accepted || output.includes(object.body)) throw new Error('REDACTION_OUTPUT_INVALID');
      const nextVersion = document.currentVersion + 1;
      const key = safeObjectKey(actor.organizationId, document.matterId, document.id, nextVersion, filename);
      const stored = await this.storage.upload(output, { key, filename, mimeType: 'application/pdf', organizationId: actor.organizationId, matterId: document.matterId, userId: actor.id });
      try {
        return await this.prisma.$transaction(async tx => {
          const manifest = result.data.redactionManifest as Prisma.InputJsonValue;
          const provenance: Prisma.InputJsonObject = { source: 'irreversible-redaction', sourceVersion: document.currentVersion, sourceChecksum: source.checksum, provider: result.provider, providerVersion: result.providerVersion, providerResponseChecksum: result.checksum, redactionManifest: manifest, marks: redactions };
          const updated = await tx.document.updateMany({ where: { id: document.id, rowVersion: expectedRowVersion, currentVersion: document.currentVersion }, data: { currentVersion: nextVersion, rowVersion: { increment: 1 }, storageKey: stored.key, storageVersionId: stored.versionId, checksum: stored.checksum, fileSize: output.length, mimeType: 'application/pdf', originalFileName: filename, provenance, legalReviewStatus: 'STALE' } });
          if (updated.count !== 1) throw createError('DOCUMENT_VERSION_CONFLICT', 409);
          const version = await tx.documentVersion.create({ data: { documentId, version: nextVersion, storageKey: stored.key, storageVersionId: stored.versionId, checksum: stored.checksum, fileSize: output.length, mimeType: 'application/pdf', provenance, createdById: actor.id } });
          await tx.aIArtifact.updateMany({ where: { documentId, status: 'PENDING_REVIEW' }, data: { status: 'STALE' } });
          await tx.integrationJob.update({ where: { id: job.id }, data: { status: 'COMPLETED', provider: result.provider, providerVersion: result.providerVersion, outputChecksum: stored.checksum, response: { documentVersion: nextVersion, redactionManifest: manifest } } });
          await appendAudit(tx, { organizationId: actor.organizationId, matterId: document.matterId, documentId, userId: actor.id, action: 'DOCUMENT_IRREVERSIBLY_REDACTED', details: { sourceVersion: document.currentVersion, outputVersion: nextVersion, sourceChecksum: source.checksum, outputChecksum: stored.checksum, provider: result.provider, providerVersion: result.providerVersion, markCount: redactions.length } });
          return version;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        await this.storage.deleteAllVersions(stored.key, actor.organizationId, document.matterId);
        throw error;
      }
    } catch (error) {
      await this.prisma.integrationJob.update({ where: { id: job.id }, data: { status: 'FAILED', error: error instanceof Error ? error.message : 'REDACTION_FAILED' } });
      throw error;
    }
  }

  async legalReview(documentId: string, actor: DocumentActor, input: { decision: 'APPROVED' | 'REJECTED'; jurisdiction: string; effectiveDate: Date; rationale: string }) {
    const document = await this.document(documentId, actor, 'legal-review');
    if (document.senderId === actor.id) throw createError('INDEPENDENT_LEGAL_REVIEW_REQUIRED', 403);
    if (input.jurisdiction !== document.jurisdiction || input.effectiveDate.toISOString().slice(0, 10) !== document.effectiveDate.toISOString().slice(0, 10)) throw createError('JURISDICTION_OR_EFFECTIVE_DATE_MISMATCH', 409);
    if (input.rationale.trim().length < 20) throw createError('LEGAL_REVIEW_RATIONALE_REQUIRED', 400);
    return this.prisma.$transaction(async tx => {
      const review = await tx.legalReview.upsert({ where: { documentId_documentVersion: { documentId, documentVersion: document.currentVersion } }, update: { reviewerId: actor.id, decision: input.decision, jurisdiction: input.jurisdiction, effectiveDate: input.effectiveDate, rationale: input.rationale }, create: { documentId, documentVersion: document.currentVersion, reviewerId: actor.id, decision: input.decision, jurisdiction: input.jurisdiction, effectiveDate: input.effectiveDate, rationale: input.rationale } });
      await tx.document.update({ where: { id: document.id }, data: { legalReviewStatus: input.decision } });
      await appendAudit(tx, { organizationId: actor.organizationId, matterId: document.matterId, documentId, userId: actor.id, action: `LEGAL_REVIEW_${input.decision}`, details: { version: document.currentVersion, jurisdiction: input.jurisdiction, effectiveDate: input.effectiveDate.toISOString(), rationale: input.rationale } });
      return review;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async send(documentId: string, signers: Array<{ email: string; name: string; routingOrder?: number }>, actor: DocumentActor) {
    const document = await this.document(documentId, actor, 'send');
    if (document.status !== 'DRAFT') throw createError('DOCUMENT_NOT_DRAFT', 409);
    if (document.legalReviewStatus !== 'APPROVED') throw createError('CURRENT_VERSION_LEGAL_REVIEW_REQUIRED', 409);
    const normalized = signers.map((signer, index) => ({ email: signer.email.trim().toLowerCase(), name: signer.name.trim(), routingOrder: signer.routingOrder || index + 1 }));
    if (!normalized.length || new Set(normalized.map(signer => signer.email)).size !== normalized.length || normalized.some(signer => !signer.email || !signer.name)) throw createError('VALID_UNIQUE_SIGNERS_REQUIRED', 400);
    const users = await this.prisma.user.findMany({ where: { email: { in: normalized.map(signer => signer.email) }, organizationId: actor.organizationId, isActive: true } });
    if (users.length !== normalized.length) throw createError('ALL_SIGNERS_MUST_BE_ACTIVE_ORGANIZATION_USERS', 409);
    const created = await this.prisma.$transaction(async tx => {
      const signatures = [];
      for (const signer of normalized) {
        const user = users.find(item => item.email === signer.email)!;
        await tx.matterMember.upsert({ where: { matterId_userId: { matterId: document.matterId, userId: user.id } }, update: { revokedAt: null }, create: { matterId: document.matterId, userId: user.id, role: 'CLIENT' } });
        signatures.push(await tx.signature.create({ data: { documentId, documentVersion: document.currentVersion, signerId: user.id, signerEmail: signer.email, signerName: signer.name, routingOrder: signer.routingOrder } }));
      }
      await tx.document.update({ where: { id: document.id }, data: { status: 'SENT', rowVersion: { increment: 1 } } });
      await appendAudit(tx, { organizationId: actor.organizationId, matterId: document.matterId, documentId, userId: actor.id, action: 'DOCUMENT_SENT', details: { version: document.currentVersion, signerIds: signatures.map(signature => signature.signerId) } });
      return signatures;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    const sender = await this.prisma.user.findUniqueOrThrow({ where: { id: actor.id } });
    const failures: Array<{ id: string; error: string }> = [];
    for (const signature of created) {
      const requestId = crypto.randomUUID();
      const job = await this.prisma.integrationJob.create({ data: { organizationId: actor.organizationId, matterId: document.matterId, documentId, kind: 'ESIGN_DELIVERY', requestId, provider: 'smtp', status: 'IN_PROGRESS', attempts: 1 } });
      try {
        await EmailService.sendSignatureRequest({ documentTitle: document.title, senderName: `${sender.firstName} ${sender.lastName}`, signerName: signature.signerName, signerEmail: signature.signerEmail, documentId, signUrl: `${process.env.FRONTEND_URL}/sign/${documentId}` });
        await this.prisma.integrationJob.update({ where: { id: job.id }, data: { status: 'COMPLETED', response: { deliveredTo: signature.signerEmail } } });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'DELIVERY_FAILED';
        failures.push({ id: signature.id, error: message });
        await this.prisma.$transaction([
          this.prisma.signature.update({ where: { id: signature.id }, data: { status: 'DELIVERY_FAILED', failureReason: message } }),
          this.prisma.integrationJob.update({ where: { id: job.id }, data: { status: 'FAILED', error: message } }),
        ]);
      }
    }
    if (failures.length) throw createError(`SIGNER_DELIVERY_FAILED:${failures.map(item => item.id).join(',')}`, 502);
    return created;
  }

  async sign(documentId: string, actor: DocumentActor, input: { signatureData: string; consent: { agreed: boolean; text: string; timestamp: string }; ipAddress?: string; userAgent?: string }) {
    const document = await this.document(documentId, actor, 'sign');
    if (!['SENT', 'IN_PROGRESS'].includes(document.status)) throw createError('DOCUMENT_NOT_SIGNABLE', 409);
    if (!input.consent?.agreed || input.consent.text !== 'I agree to use an electronic signature for this document.') throw createError('ELECTRONIC_SIGNATURE_CONSENT_REQUIRED', 400);
    if (!/^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(input.signatureData) || input.signatureData.length > 1_000_000) throw createError('INVALID_SIGNATURE_DATA', 400);
    return this.prisma.$transaction(async tx => {
      const signature = await tx.signature.findFirst({ where: { documentId, documentVersion: document.currentVersion, signerId: actor.id, status: 'PENDING' } });
      if (!signature) throw createError('SIGNATURE_NOT_PENDING', 409);
      const prior = await tx.signature.count({ where: { documentId, documentVersion: document.currentVersion, routingOrder: { lt: signature.routingOrder }, status: { not: 'SIGNED' } } });
      if (prior) throw createError('SIGNING_ORDER_BLOCKED', 409);
      const claimed = await tx.signature.updateMany({ where: { id: signature.id, status: 'PENDING' }, data: { status: 'SIGNED', signedAt: new Date(), signatureData: input.signatureData, consent: input.consent as Prisma.InputJsonValue, ipAddress: input.ipAddress, userAgent: input.userAgent } });
      if (claimed.count !== 1) throw createError('SIGNATURE_CONFLICT', 409);
      const remaining = await tx.signature.count({ where: { documentId, documentVersion: document.currentVersion, status: { not: 'SIGNED' } } });
      await tx.document.update({ where: { id: document.id }, data: { status: remaining ? 'IN_PROGRESS' : 'COMPLETED', completedAt: remaining ? null : new Date(), rowVersion: { increment: 1 } } });
      await appendAudit(tx, { organizationId: actor.organizationId, matterId: document.matterId, documentId, userId: actor.id, action: 'DOCUMENT_SIGNED', details: { version: document.currentVersion, signatureId: signature.id, routingOrder: signature.routingOrder, completed: !remaining }, ipAddress: input.ipAddress, userAgent: input.userAgent });
      return tx.signature.findUniqueOrThrow({ where: { id: signature.id } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async decline(documentId: string, actor: DocumentActor, reason: string) {
    const document = await this.document(documentId, actor, 'sign');
    if (reason.trim().length < 10) throw createError('DECLINE_REASON_REQUIRED', 400);
    return this.prisma.$transaction(async tx => {
      const signature = await tx.signature.findFirst({ where: { documentId, documentVersion: document.currentVersion, signerId: actor.id, status: 'PENDING' } });
      if (!signature) throw createError('SIGNATURE_NOT_PENDING', 409);
      await tx.signature.update({ where: { id: signature.id }, data: { status: 'DECLINED', declinedAt: new Date(), failureReason: reason } });
      await tx.document.update({ where: { id: document.id }, data: { status: 'CANCELLED', rowVersion: { increment: 1 } } });
      await appendAudit(tx, { organizationId: actor.organizationId, matterId: document.matterId, documentId, userId: actor.id, action: 'SIGNATURE_DECLINED', details: { version: document.currentVersion, signatureId: signature.id, reason } });
      return { status: 'DECLINED' };
    });
  }

  async runOcr(documentId: string, actor: DocumentActor) {
    const document = await this.document(documentId, actor, 'write');
    const version = await this.prisma.documentVersion.findUniqueOrThrow({ where: { documentId_version: { documentId, version: document.currentVersion } } });
    const object = await this.storage.download(version.storageKey, actor.organizationId, document.matterId, version.storageVersionId || undefined);
    if (object.checksum !== version.checksum) throw createError('OBJECT_CHECKSUM_MISMATCH', 409);
    const requestId = crypto.randomUUID();
    const job = await this.prisma.integrationJob.create({ data: { organizationId: actor.organizationId, matterId: document.matterId, documentId, kind: 'OCR', requestId, provider: 'pending', status: 'IN_PROGRESS', attempts: 1, inputChecksum: version.checksum } });
    try {
      const result = await this.integrations.call<{ text: string; confidence: number }>('OCR', requestId, { mimeType: version.mimeType, contentBase64: object.body.toString('base64'), checksum: version.checksum });
      if (typeof result.data.text !== 'string' || !Number.isFinite(result.data.confidence)) throw new Error('OCR_RESPONSE_INVALID');
      await this.prisma.$transaction([
        this.prisma.documentVersion.update({ where: { id: version.id }, data: { ocrText: result.data.text, ocrProvider: result.provider, ocrVersion: result.providerVersion } }),
        this.prisma.integrationJob.update({ where: { id: job.id }, data: { status: 'COMPLETED', provider: result.provider, providerVersion: result.providerVersion, outputChecksum: result.checksum, response: { confidence: result.data.confidence, characters: result.data.text.length } } }),
      ]);
      return { characters: result.data.text.length, confidence: result.data.confidence, provider: result.provider, providerVersion: result.providerVersion };
    } catch (error) {
      await this.prisma.integrationJob.update({ where: { id: job.id }, data: { status: 'FAILED', error: error instanceof Error ? error.message : 'OCR_FAILED' } });
      throw error;
    }
  }

  async file(documentId: string, actor: DocumentActor) {
    const document = await this.document(documentId, actor, 'send');
    if (document.status !== 'COMPLETED' || document.legalReviewStatus !== 'APPROVED') throw createError('COMPLETED_LEGALLY_APPROVED_DOCUMENT_REQUIRED', 409);
    const requestId = crypto.randomUUID();
    const job = await this.prisma.integrationJob.create({ data: { organizationId: actor.organizationId, matterId: document.matterId, documentId, kind: 'FILING', requestId, provider: 'pending', status: 'IN_PROGRESS', attempts: 1, inputChecksum: document.checksum } });
    try {
      const result = await this.integrations.call<{ externalReference: string; filedAt: string; receipt: unknown }>('FILING', requestId, { documentId, version: document.currentVersion, checksum: document.checksum, jurisdiction: document.jurisdiction, effectiveDate: document.effectiveDate.toISOString() });
      if (!result.data.externalReference || !Number.isFinite(new Date(result.data.filedAt).getTime())) throw new Error('FILING_RESPONSE_INVALID');
      return await this.prisma.$transaction(async tx => {
        const receipt = await tx.filingReceipt.create({ data: { documentId, documentVersion: document.currentVersion, provider: result.provider, externalReference: result.data.externalReference, filedAt: new Date(result.data.filedAt), receiptChecksum: result.checksum, receipt: result.data.receipt as Prisma.InputJsonValue } });
        await tx.integrationJob.update({ where: { id: job.id }, data: { status: 'COMPLETED', provider: result.provider, providerVersion: result.providerVersion, outputChecksum: result.checksum, response: result.data as Prisma.InputJsonValue } });
        await appendAudit(tx, { organizationId: actor.organizationId, matterId: document.matterId, documentId, userId: actor.id, action: 'DOCUMENT_FILED', details: { provider: result.provider, externalReference: result.data.externalReference, receiptChecksum: result.checksum } });
        return receipt;
      });
    } catch (error) {
      await this.prisma.integrationJob.update({ where: { id: job.id }, data: { status: 'FAILED', error: error instanceof Error ? error.message : 'FILING_FAILED' } });
      throw error;
    }
  }

  async placeHold(matterId: string, actor: DocumentActor, reference: string, reason: string) {
    const matter = await this.matter(matterId, actor, 'hold');
    if (reference.trim().length < 3 || reason.trim().length < 15) throw createError('HOLD_REFERENCE_AND_REASON_REQUIRED', 400);
    return this.prisma.$transaction(async tx => {
      const hold = await tx.legalHold.create({ data: { matterId, reference, reason, placedById: actor.id } });
      await tx.matter.update({ where: { id: matterId }, data: { legalHoldActive: true } });
      await tx.document.updateMany({ where: { matterId, deletedAt: null }, data: { legalHoldActive: true } });
      await appendAudit(tx, { organizationId: actor.organizationId, matterId, userId: actor.id, action: 'LEGAL_HOLD_PLACED', details: { holdId: hold.id, reference, reason } });
      return hold;
    });
  }

  async releaseHold(holdId: string, actor: DocumentActor, reason: string) {
    if (reason.trim().length < 15) throw createError('HOLD_RELEASE_REASON_REQUIRED', 400);
    const hold = await this.prisma.legalHold.findFirst({ where: { id: holdId, releasedAt: null, matter: { organizationId: actor.organizationId } }, include: { matter: true } });
    if (!hold) throw createError('Legal hold not found', 404);
    await this.matter(hold.matterId, actor, 'hold');
    return this.prisma.$transaction(async tx => {
      const released = await tx.legalHold.update({ where: { id: hold.id }, data: { releasedAt: new Date(), releasedById: actor.id, releaseReason: reason } });
      const remaining = await tx.legalHold.count({ where: { matterId: hold.matterId, releasedAt: null } });
      if (!remaining) {
        await tx.matter.update({ where: { id: hold.matterId }, data: { legalHoldActive: false } });
        await tx.document.updateMany({ where: { matterId: hold.matterId, deletedAt: null }, data: { legalHoldActive: false } });
      }
      await appendAudit(tx, { organizationId: actor.organizationId, matterId: hold.matterId, userId: actor.id, action: 'LEGAL_HOLD_RELEASED', details: { holdId, reason } });
      return released;
    });
  }

  async requestDeletion(documentId: string, actor: DocumentActor) {
    const document = await this.document(documentId, actor, 'delete');
    if (document.legalHoldActive) throw createError('LEGAL_HOLD_ACTIVE', 409);
    if (document.retentionUntil > new Date()) throw createError('RETENTION_PERIOD_ACTIVE', 409);
    const versions = await this.prisma.documentVersion.findMany({ where: { documentId }, select: { storageKey: true } });
    return this.prisma.$transaction(async tx => {
      const job = await tx.deletionJob.create({ data: { documentId, requestedById: actor.id, objectKeys: [...new Set(versions.map(version => version.storageKey))] } });
      await tx.document.update({ where: { id: documentId }, data: { status: 'DELETION_PENDING', deletionRequestedAt: new Date(), rowVersion: { increment: 1 } } });
      await appendAudit(tx, { organizationId: actor.organizationId, matterId: document.matterId, documentId, userId: actor.id, action: 'DELETION_REQUESTED', details: { jobId: job.id, objectCount: job.objectKeys.length } });
      return job;
    });
  }

  async processDeletion(jobId: string, actor: DocumentActor) {
    if (actor.role !== 'ADMIN' || !actor.privileged) throw createError('PRIVILEGED_SESSION_REQUIRED', 403);
    const job = await this.prisma.deletionJob.findFirst({ where: { id: jobId, status: { in: ['PENDING', 'FAILED'] }, document: { matter: { organizationId: actor.organizationId } } }, include: { document: true } });
    if (!job) throw createError('Deletion job not found', 404);
    if (job.document.legalHoldActive || job.document.retentionUntil > new Date()) throw createError('DELETION_BLOCKED', 409);
    await this.prisma.deletionJob.update({ where: { id: job.id }, data: { status: 'IN_PROGRESS', attempts: { increment: 1 }, error: null } });
    const failures: string[] = [];
    for (const key of job.objectKeys) if (!await this.storage.deleteAllVersions(key, actor.organizationId, job.document.matterId)) failures.push(key);
    if (failures.length) {
      await this.prisma.deletionJob.update({ where: { id: job.id }, data: { status: 'FAILED', error: failures.join(',').slice(0, 2000) } });
      throw createError('OBJECT_DELETION_INCOMPLETE', 502);
    }
    return this.prisma.$transaction(async tx => {
      const completedAt = new Date();
      await tx.document.update({ where: { id: job.documentId }, data: { status: 'DELETED', deletedAt: completedAt } });
      const completed = await tx.deletionJob.update({ where: { id: job.id }, data: { status: 'COMPLETED', completedAt } });
      await appendAudit(tx, { organizationId: actor.organizationId, matterId: job.document.matterId, documentId: job.documentId, userId: actor.id, action: 'DELETION_COMPLETED', details: { jobId, objectCount: job.objectKeys.length } });
      return completed;
    });
  }
}
