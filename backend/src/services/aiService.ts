import crypto from 'node:crypto';
import OpenAI from 'openai';
import { AIArtifactStatus, Prisma, PrismaClient } from '@prisma/client';
import { authorizeMatter, defendLegalInput } from '../security/policy';
import { appendAudit } from '../security/audit';
import { createError } from '../middleware/errorHandler';
import { DocumentActor } from './documentService';

function provider() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL;
  const modelVersion = process.env.OPENROUTER_MODEL_VERSION;
  const baseURL = process.env.OPENROUTER_BASE_URL;
  if (!apiKey || !model || !modelVersion || baseURL !== 'https://openrouter.ai/api/v1') {
    throw createError('AI_PROVIDER_MODEL_VERSION_AND_CANONICAL_BASE_REQUIRED', 503);
  }
  return { client: new OpenAI({ apiKey, baseURL, timeout: Number(process.env.OPENROUTER_TIMEOUT_MS || 120_000) }), model, modelVersion };
}

const checksum = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
const providerJson = (raw: string) => { try { return JSON.parse(raw); } catch { throw createError('AI_OUTPUT_SCHEMA_INVALID', 502); } };

export class AIService {
  constructor(private prisma = new PrismaClient()) {}

  private async matter(matterId: string, actor: DocumentActor, action: 'read' | 'write' | 'legal-review') {
    const matter = await this.prisma.matter.findFirst({ where: { id: matterId, organizationId: actor.organizationId }, include: { members: { where: { userId: actor.id } } } });
    if (!matter) throw createError('Matter not found', 404);
    const access = authorizeMatter({ actor, organizationId: matter.organizationId, membership: matter.members[0], action });
    if (!access.allowed) throw createError(access.reason, 403);
    return matter;
  }

  async analyzeDocument(documentId: string, actor: DocumentActor) {
    const document = await this.prisma.document.findFirst({ where: { id: documentId, matter: { organizationId: actor.organizationId }, deletedAt: null } });
    if (!document) throw createError('Document not found', 404);
    await this.matter(document.matterId, actor, 'write');
    const version = await this.prisma.documentVersion.findUniqueOrThrow({ where: { documentId_version: { documentId, version: document.currentVersion } } });
    if (!version.ocrText) throw createError('OCR_REQUIRED_BEFORE_AI_ANALYSIS', 409);
    const defended = defendLegalInput(version.ocrText);
    if (!defended.accepted) throw createError(defended.reason, 422);
    const runtime = provider();
    const response = await runtime.client.chat.completions.create({
      model: runtime.model,
      messages: [
        { role: 'system', content: `You provide advisory legal-document issue spotting, never legal advice. Jurisdiction: ${document.jurisdiction}. Effective date: ${document.effectiveDate.toISOString().slice(0, 10)}. Return strict JSON with summary:string, risks:string[], compliance:string[], suggestions:string[], citations:{quote:string,reason:string}[]; use only supplied evidence and state uncertainty.` },
        { role: 'user', content: `${defended.instruction}\n${defended.delimited}` },
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
    });
    const raw = response.choices[0]?.message?.content;
    if (!raw) throw createError('AI_PROVIDER_EMPTY_RESPONSE', 502);
    const output = providerJson(raw) as { summary?: unknown; risks?: unknown; compliance?: unknown; suggestions?: unknown; citations?: unknown };
    if (typeof output.summary !== 'string' || ![output.risks, output.compliance, output.suggestions, output.citations].every(Array.isArray)) throw createError('AI_OUTPUT_SCHEMA_INVALID', 502);
    const artifact = await this.prisma.aIArtifact.create({ data: {
      organizationId: actor.organizationId,
      matterId: document.matterId,
      documentId,
      documentVersion: document.currentVersion,
      kind: 'document-analysis',
      provider: 'openrouter',
      model: runtime.model,
      modelVersion: runtime.modelVersion,
      inputChecksum: defended.checksum,
      outputChecksum: checksum(raw),
      output: output as Prisma.InputJsonValue,
      jurisdiction: document.jurisdiction,
      effectiveDate: document.effectiveDate,
      promptDefense: { delimiter: 'UNTRUSTED_LEGAL_DOCUMENT', signalsChecked: true },
      createdById: actor.id,
    } });
    return { artifactId: artifact.id, status: artifact.status, advisory: true, requiresIndependentLegalReview: true, outputChecksum: artifact.outputChecksum };
  }

  async generateContract(actor: DocumentActor, input: { matterId: string; prompt: string; contractType: string; templateId: string; jurisdiction: string; effectiveDate: Date }) {
    const matter = await this.matter(input.matterId, actor, 'read');
    if (matter.jurisdiction !== input.jurisdiction) throw createError('MATTER_JURISDICTION_MISMATCH', 409);
    const template = await this.prisma.template.findFirst({ where: { id: input.templateId, organizationId: actor.organizationId, jurisdiction: input.jurisdiction, isAuthoritative: true, effectiveFrom: { lte: input.effectiveDate }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: input.effectiveDate } }] } });
    if (!template) throw createError('EFFECTIVE_AUTHORITATIVE_TEMPLATE_REQUIRED', 409);
    const defended = defendLegalInput(input.prompt, 20_000);
    if (!defended.accepted) throw createError(defended.reason, 422);
    const runtime = provider();
    const response = await runtime.client.chat.completions.create({ model: runtime.model, messages: [
      { role: 'system', content: `Draft an advisory ${input.contractType} using authoritative template ${template.name}, source version ${template.sourceVersion}, jurisdiction ${input.jurisdiction}, effective date ${input.effectiveDate.toISOString().slice(0, 10)}. Preserve placeholders and identify unresolved facts. Do not claim legal validity. Return JSON {contract:string, unresolvedFacts:string[], templateChecksum:string}.` },
      { role: 'user', content: `${defended.instruction}\n${defended.delimited}` },
    ], temperature: 0, response_format: { type: 'json_object' } });
    const raw = response.choices[0]?.message?.content;
    if (!raw) throw createError('AI_PROVIDER_EMPTY_RESPONSE', 502);
    const output = providerJson(raw) as any;
    if (typeof output.contract !== 'string' || !Array.isArray(output.unresolvedFacts)) throw createError('AI_OUTPUT_SCHEMA_INVALID', 502);
    output.templateChecksum = template.checksum;
    const artifact = await this.prisma.aIArtifact.create({ data: { organizationId: actor.organizationId, matterId: matter.id, kind: 'contract-draft', provider: 'openrouter', model: runtime.model, modelVersion: runtime.modelVersion, inputChecksum: defended.checksum, outputChecksum: checksum(JSON.stringify(output)), output, jurisdiction: input.jurisdiction, effectiveDate: input.effectiveDate, promptDefense: { delimiter: 'UNTRUSTED_LEGAL_DOCUMENT', signalsChecked: true, templateId: template.id, templateChecksum: template.checksum }, createdById: actor.id } });
    return { artifactId: artifact.id, status: artifact.status, advisory: true, requiresIndependentLegalReview: true };
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

  async operationalRiskReview(prompt: string, actor: DocumentActor) {
    const membership = await this.prisma.matterMember.findFirst({
      where: { userId: actor.id, revokedAt: null, matter: { organizationId: actor.organizationId, status: 'ACTIVE' } },
      include: { matter: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!membership) throw createError('Active matter required', 409);
    const defended = defendLegalInput(prompt, 4_000);
    if (!defended.accepted) throw createError(defended.reason, 422);
    const runtime = provider();
    const response = await runtime.client.chat.completions.create({
      model: runtime.model,
      messages: [
        { role: 'system', content: `Provide bounded legal-document workflow risk analysis for jurisdiction ${membership.matter.jurisdiction}. This is advisory issue spotting, not legal advice. Require independent counsel review, authoritative source validation, explicit signer consent, immutable audit evidence, and state uncertainty. Never claim a document is legally valid.` },
        { role: 'user', content: `${defended.instruction}\n${defended.delimited}` },
      ],
      temperature: 0,
    });
    const result = response.choices[0]?.message?.content?.trim();
    const providerReceipt = response.id?.trim();
    if (!result || !providerReceipt) throw createError('AI_PROVIDER_INCOMPLETE_RESPONSE', 502);
    const output: Prisma.InputJsonValue = {
      result,
      providerReceipt,
      usage: response.usage ? JSON.parse(JSON.stringify(response.usage)) : null,
    };
    const artifact = await this.prisma.aIArtifact.create({ data: {
      organizationId: actor.organizationId,
      matterId: membership.matterId,
      kind: 'runtime-operational-risk-review',
      provider: 'openrouter',
      model: runtime.model,
      modelVersion: runtime.modelVersion,
      inputChecksum: defended.checksum,
      outputChecksum: checksum(JSON.stringify(output)),
      output,
      jurisdiction: membership.matter.jurisdiction,
      effectiveDate: new Date(),
      promptDefense: { delimiter: 'UNTRUSTED_LEGAL_DOCUMENT', signalsChecked: true, boundedReview: true },
      createdById: actor.id,
    } });
    return { artifactId: artifact.id, result, model: runtime.model, provider: 'openrouter', providerReceipt, usage: response.usage || null };
  }
}
