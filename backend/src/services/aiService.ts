import { GovernedAIService, GenerationOptions, ContractDraftInput, GovernedActor } from './governedAiService';
import crypto from 'node:crypto';
import OpenAI from 'openai';
import { AIArtifactStatus, Prisma, PrismaClient } from '@prisma/client';
import { authorizeMatter, defendLegalInput } from '../security/policy';
import { appendAudit } from '../security/audit';
import { createError } from '../middleware/errorHandler';
import { DocumentActor } from './documentService';

function provider(noRetry = false) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL;
  const modelVersion = process.env.OPENROUTER_MODEL_VERSION;
  const baseURL = process.env.OPENROUTER_BASE_URL;
  if (!apiKey || !model || !modelVersion || baseURL !== 'https://openrouter.ai/api/v1') {
    throw createError('AI_PROVIDER_MODEL_VERSION_AND_CANONICAL_BASE_REQUIRED', 503);
  }
  return { client: new OpenAI({ apiKey, baseURL, ...(noRetry ? { maxRetries: 0 } : {}), timeout: Number(process.env.OPENROUTER_TIMEOUT_MS || 120_000) }), model, modelVersion };
}

const checksum = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

export class AIService {
  constructor(private prisma = new PrismaClient()) {}

  private async matter(matterId: string, actor: DocumentActor, action: 'read' | 'write' | 'legal-review') {
    const matter = await this.prisma.matter.findFirst({ where: { id: matterId, organizationId: actor.organizationId }, include: { members: { where: { userId: actor.id } } } });
    if (!matter) throw createError('Matter not found', 404);
    const access = authorizeMatter({ actor, organizationId: matter.organizationId, membership: matter.members[0], action });
    if (!access.allowed) throw createError(access.reason, 403);
    return matter;
  }

  async analyzeDocument(documentId: string, actor: GovernedActor, options: GenerationOptions & { reviewFocus?: string } = {}) {
    return new GovernedAIService(this.prisma).analyzeDocument(documentId, actor, options);
  }

  async generateContract(actor: GovernedActor, input: ContractDraftInput, options: GenerationOptions = {}) {
    return new GovernedAIService(this.prisma).generateContract(actor, input, options);
  }

  async governedSources(actor: GovernedActor) {
    return new GovernedAIService(this.prisma).sources(actor);
  }

  async governedHistory(actor: GovernedActor) {
    return new GovernedAIService(this.prisma).history(actor);
  }

  async reviewArtifact(artifactId: string, actor: DocumentActor, decision: 'APPROVED' | 'REJECTED', rationale: string) {
    const artifact = await this.prisma.aIArtifact.findFirst({ where: { id: artifactId, organizationId: actor.organizationId } });
    if (!artifact) throw createError('AI artifact not found', 404);
    await this.matter(artifact.matterId, actor, 'legal-review');
    if (artifact.createdById === actor.id) throw createError('INDEPENDENT_AI_REVIEW_REQUIRED', 403);
    if (rationale.trim().length < 20) throw createError('AI_REVIEW_RATIONALE_REQUIRED', 400);
    if (artifact.documentId) {
      const document = await this.prisma.document.findUnique({ where: { id: artifact.documentId } });
      if (!document || document.currentVersion !== artifact.documentVersion) throw createError('AI_ARTIFACT_STALE', 409);
    }
    return this.prisma.$transaction(async tx => {
      const status: AIArtifactStatus = decision === 'APPROVED' ? 'APPROVED' : 'REJECTED';
      const claimed = await tx.aIArtifact.updateMany({ where: { id: artifact.id, status: 'PENDING_REVIEW' }, data: { status, reviewedById: actor.id, reviewerRationale: rationale, reviewedAt: new Date() } });
      if (claimed.count !== 1) throw createError('AI_REVIEW_CONFLICT', 409);
      if (decision === 'APPROVED' && artifact.documentId && artifact.kind === 'document-analysis') {
        const output = artifact.output as any;
        await tx.aIAnalysis.upsert({ where: { documentId: artifact.documentId }, update: { documentVersion: artifact.documentVersion!, provider: artifact.provider, model: artifact.model, modelVersion: artifact.modelVersion, inputChecksum: artifact.inputChecksum, outputChecksum: artifact.outputChecksum, summary: output.summary, riskAnalysis: output.risks, suggestions: output.suggestions, compliance: output.compliance, status: 'APPROVED', reviewerId: actor.id, reviewerRationale: rationale, reviewedAt: new Date() }, create: { documentId: artifact.documentId, documentVersion: artifact.documentVersion!, provider: artifact.provider, model: artifact.model, modelVersion: artifact.modelVersion, inputChecksum: artifact.inputChecksum, outputChecksum: artifact.outputChecksum, summary: output.summary, riskAnalysis: output.risks, suggestions: output.suggestions, compliance: output.compliance, status: 'APPROVED', reviewerId: actor.id, reviewerRationale: rationale, reviewedAt: new Date() } });
      }
      await appendAudit(tx, { organizationId: actor.organizationId, matterId: artifact.matterId, documentId: artifact.documentId || undefined, userId: actor.id, action: `AI_ARTIFACT_${decision}`, details: { artifactId, kind: artifact.kind, model: artifact.model, modelVersion: artifact.modelVersion, inputChecksum: artifact.inputChecksum, outputChecksum: artifact.outputChecksum, rationale } });
      return tx.aIArtifact.findUniqueOrThrow({ where: { id: artifact.id } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async compareVersions(documentId: string, fromVersion: number, toVersion: number, actor: DocumentActor) {
    const document = await this.prisma.document.findFirst({ where: { id: documentId, matter: { organizationId: actor.organizationId }, deletedAt: null } });
    if (!document) throw createError('Document not found', 404);
    await this.matter(document.matterId, actor, 'write');
    const versions = await this.prisma.documentVersion.findMany({ where: { documentId, version: { in: [fromVersion, toVersion] } } });
    const left = versions.find(item => item.version === fromVersion); const right = versions.find(item => item.version === toVersion);
    if (!left?.ocrText || !right?.ocrText) throw createError('OCR_REQUIRED_FOR_BOTH_VERSIONS', 409);
    const leftLines = new Set(left.ocrText.split(/\r?\n/).map(line => line.trim()).filter(Boolean));
    const rightLines = new Set(right.ocrText.split(/\r?\n/).map(line => line.trim()).filter(Boolean));
    return { documentId, fromVersion, toVersion, fromChecksum: left.checksum, toChecksum: right.checksum, added: [...rightLines].filter(line => !leftLines.has(line)), removed: [...leftLines].filter(line => !rightLines.has(line)), deterministic: true };
  }

  async suggestTemplate(description: string, actor: DocumentActor) {
    const membership = await this.prisma.matterMember.findFirst({ where: { userId: actor.id, revokedAt: null, matter: { organizationId: actor.organizationId, status: 'ACTIVE' } }, include: { matter: true }, orderBy: { createdAt: 'asc' } });
    if (!membership) throw createError('Active matter required', 409);
    const today = new Date();
    const templates = await this.prisma.template.findMany({ where: { organizationId: actor.organizationId, jurisdiction: membership.matter.jurisdiction, isAuthoritative: true, effectiveFrom: { lte: today }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }] }, orderBy: { effectiveFrom: 'desc' }, take: 25 });
    const words = new Set(description.toLowerCase().split(/\W+/).filter(word => word.length > 2));
    const ranked = templates.map(template => ({ template, score: [...words].filter(word => `${template.name} ${template.description || ''}`.toLowerCase().includes(word)).length })).sort((a, b) => b.score - a.score);
    return { matterId: membership.matterId, jurisdiction: membership.matter.jurisdiction, suggestions: ranked.slice(0, 5).map(item => ({ id: item.template.id, name: item.template.name, authority: item.template.authority, sourceVersion: item.template.sourceVersion, checksum: item.template.checksum, score: item.score })), deterministic: true };
  }

  async operationalRiskHistory(actor: DocumentActor) {
    const rows = await this.prisma.aIArtifact.findMany({ where: { createdById: actor.id, organizationId: actor.organizationId, kind: 'runtime-operational-risk-review', matter: { organizationId: actor.organizationId, members: { some: { userId: actor.id, revokedAt: null } } } }, orderBy: { createdAt: 'desc' }, take: 50 })
    return rows.map(row => this.operationalRiskItem(row))
  }

  private operationalRiskItem(row: { id: string; matterId: string; output: Prisma.JsonValue; model: string; createdAt: Date; status: string }) {
    const output = row.output && typeof row.output === 'object' && !Array.isArray(row.output) ? row.output : {}
    return { id: row.id, matterId: row.matterId, prompt: typeof output.submittedPrompt === 'string' ? output.submittedPrompt : '', content: typeof output.result === 'string' ? output.result : '', model: row.model, createdAt: row.createdAt.toISOString(), status: row.status, canDelete: false, providerReceipt: { id: typeof output.providerReceipt === 'string' ? output.providerReceipt : '' } }
  }

  async operationalRiskReview(prompt: string, actor: DocumentActor & { sessionId?: string }, options: { signal?: AbortSignal; revalidate?: () => Promise<void> } = {}) {
    const signal = options.signal || AbortSignal.timeout(60_000)
    signal.throwIfAborted()
    const membership = await this.prisma.matterMember.findFirst({
      where: { userId: actor.id, revokedAt: null, matter: { organizationId: actor.organizationId, status: 'ACTIVE' } }, include: { matter: true }, orderBy: { createdAt: 'asc' },
    })
    if (!membership) throw createError('Active matter required', 409)
    const access = authorizeMatter({ actor, organizationId: membership.matter.organizationId, membership, action: 'read' })
    if (!access.allowed) throw createError(access.reason, 403)
    const defended = defendLegalInput(prompt, 4_000)
    if (!defended.accepted) throw createError(defended.reason, 422)
    signal.throwIfAborted()
    const runtime = provider(true)
    const response = await runtime.client.chat.completions.create({
      model: runtime.model, messages: [
        { role: 'system', content: `Provide bounded legal-document workflow risk analysis for jurisdiction ${membership.matter.jurisdiction}. This is advisory issue spotting, not legal advice. Require independent counsel review, authoritative source validation, explicit signer consent, immutable audit evidence, and state uncertainty. Never claim a document is legally valid.` },
        { role: 'user', content: `${defended.instruction}\n${defended.delimited}` },
      ], temperature: 0,
    }, { signal })
    signal.throwIfAborted()
    const choice = response.choices[0]
    const result = typeof choice?.message?.content === 'string' ? choice.message.content.trim() : ''
    const providerReceipt = response.id?.trim()
    if (!result || !providerReceipt) throw createError('AI_PROVIDER_INCOMPLETE_RESPONSE', 502)
    if (choice?.message?.refusal || choice?.finish_reason === 'content_filter' || choice?.finish_reason === 'length') throw createError('AI_PROVIDER_INCOMPLETE_RESPONSE', 502)
    await options.revalidate?.(); signal.throwIfAborted()
    const output: Prisma.InputJsonValue = { result, providerReceipt, submittedPrompt: prompt, usage: response.usage ? JSON.parse(JSON.stringify(response.usage)) : null }
    const artifact = await this.prisma.$transaction(async tx => {
      signal.throwIfAborted()
      const current = await tx.user.findFirst({ where: { id: actor.id, isActive: true, organizationId: actor.organizationId, role: actor.role } })
      if (!current) throw createError('Identity changed during generation', 401)
      if (actor.sessionId) {
        const session = await tx.userSession.findFirst({ where: { sessionId: actor.sessionId, userId: actor.id, revokedAt: null, expiresAt: { gt: new Date() }, lastSeenAt: { gt: new Date(Date.now() - 30 * 60_000) } } })
        if (!session || (actor.privileged && (!session.privilegedAt || session.privilegedAt <= new Date(Date.now() - 15 * 60_000)))) throw createError('Session changed during generation', 401)
      }
      const fresh = await tx.matterMember.findFirst({ where: { userId: actor.id, matterId: membership.matterId, revokedAt: null, matter: { organizationId: actor.organizationId, status: 'ACTIVE' } }, include: { matter: true } })
      if (!fresh || fresh.role !== membership.role || fresh.matter.jurisdiction !== membership.matter.jurisdiction) throw createError('Matter access or context changed during generation', 409)
      signal.throwIfAborted()
      const row = await tx.aIArtifact.create({ data: {
        organizationId: actor.organizationId, matterId: membership.matterId, kind: 'runtime-operational-risk-review', provider: 'openrouter', model: runtime.model, modelVersion: runtime.modelVersion,
        inputChecksum: defended.checksum, outputChecksum: checksum(JSON.stringify(output)), output, jurisdiction: membership.matter.jurisdiction, effectiveDate: new Date(),
        promptDefense: { delimiter: 'UNTRUSTED_LEGAL_DOCUMENT', signalsChecked: true, boundedReview: true }, createdById: actor.id,
      } })
      signal.throwIfAborted()
      return row
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    return { artifactId: artifact.id, result, model: runtime.model, provider: 'openrouter', providerReceipt, usage: response.usage || null, item: this.operationalRiskItem(artifact) }
  }
}
