// Custom feature endpoints (batch_09 audit suggestions)
import express from 'express';
import OpenAI from 'openai';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = express.Router();

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:3000',
    'X-Title': 'DocuSign AI Clone',
  },
});

const MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5';

async function callLLM(system: string, user: string, maxTokens = 1800, temperature = 0.3) {
  if (!process.env.OPENROUTER_API_KEY) {
    const e: any = new Error('OPENROUTER_API_KEY not configured');
    e.statusCode = 503;
    throw e;
  }
  const r = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    max_tokens: maxTokens,
    temperature,
  });
  return { content: r.choices?.[0]?.message?.content || '', model: r.model };
}

function parseJSON(t: string) {
  if (!t) return null;
  const c = t.replace(/```(?:json)?/gi, '').replace(/```/g, '');
  const m = c.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

function err(res: express.Response, e: any, label: string) {
  if (e.statusCode === 503) return res.status(503).json({ error: e.message });
  console.error(`${label} error:`, e?.message || e);
  res.status(500).json({ error: e?.message || 'internal error' });
}

// 1. Predictive signing bottlenecks
router.post('/signing-bottleneck', authenticate, async (req: AuthRequest, res) => {
  try {
    const { envelope_id, signers, sla_hours } = req.body || {};
    if (!envelope_id) return res.status(400).json({ error: 'envelope_id required' });
    const ai = await callLLM(
      'You predict signing bottlenecks for an envelope. JSON only.',
      `ENVELOPE: ${envelope_id}\nSIGNERS: ${JSON.stringify(signers || [])}\nSLA_HOURS: ${sla_hours || 72}\nReturn JSON {"likely_bottleneck_signer":"","probability":0,"est_delay_hours":0,"mitigations":[""],"escalation_path":[""]}`
    );
    res.json({ type: 'signing-bottleneck', result: parseJSON(ai.content) || { raw: ai.content }, model: ai.model });
  } catch (e: any) { err(res, e, 'signing-bottleneck'); }
});

// 2. Smart routing to correct signatories
router.post('/smart-routing', authenticate, async (req: AuthRequest, res) => {
  try {
    const { document_type, party_pool } = req.body || {};
    if (!document_type) return res.status(400).json({ error: 'document_type required' });
    const ai = await callLLM(
      'You route a document to the correct signatories from a party pool. JSON only.',
      `DOC_TYPE: ${document_type}\nPOOL: ${JSON.stringify(party_pool || [])}\nReturn JSON {"order":[{"signer_id":"","role":"","why":""}],"witnesses_required":0,"notary_required":false}`
    );
    res.json({ type: 'smart-routing', result: parseJSON(ai.content) || { raw: ai.content }, model: ai.model });
  } catch (e: any) { err(res, e, 'smart-routing'); }
});

// 3. Compliance checks (witnesses, notary)
router.post('/compliance-check', authenticate, async (req: AuthRequest, res) => {
  try {
    const { document_type, jurisdiction, signers_summary } = req.body || {};
    if (!document_type) return res.status(400).json({ error: 'document_type required' });
    const ai = await callLLM(
      'You verify signing compliance (witnesses, notary, residency). JSON only.',
      `DOC_TYPE: ${document_type}\nJURISDICTION: ${jurisdiction || 'US-Generic'}\nSIGNERS: ${JSON.stringify(signers_summary || {})}\nReturn JSON {"compliance_score":0,"missing_requirements":[""],"required_witnesses":0,"notary_required":false,"warnings":[""]}`
    );
    res.json({ type: 'compliance-check', result: parseJSON(ai.content) || { raw: ai.content }, model: ai.model });
  } catch (e: any) { err(res, e, 'compliance-check'); }
});

// 4. CLM integration
// TODO: configure credentials for CLM_API_KEY (Ironclad/Coupa).
router.post('/clm-sync', authenticate, async (req: AuthRequest, res) => {
  try {
    const { envelope, target_clm = 'ironclad' } = req.body || {};
    if (!envelope) return res.status(400).json({ error: 'envelope required' });
    const ai = await callLLM(
      `You map a completed envelope to a CLM workflow. CLM API: ${Boolean(process.env.CLM_API_KEY)}. JSON only.`,
      `CLM: ${target_clm}\nENVELOPE: ${JSON.stringify(envelope)}\nReturn JSON {"workflow":"","metadata":{},"missing_fields":[""],"sync_status":"ready|blocked"}`
    );
    res.json({ type: 'clm-sync', result: parseJSON(ai.content) || { raw: ai.content }, model: ai.model });
  } catch (e: any) { err(res, e, 'clm-sync'); }
});

// 5. Template suggestion based on document type
router.post('/template-suggest', authenticate, async (req: AuthRequest, res) => {
  try {
    const { intent, party_count, document_excerpt } = req.body || {};
    if (!intent) return res.status(400).json({ error: 'intent required' });
    const ai = await callLLM(
      'You suggest the best document template for a stated intent. JSON only.',
      `INTENT: ${intent}\nPARTIES: ${party_count || 2}\nEXCERPT: ${String(document_excerpt || '').slice(0, 1500)}\nReturn JSON {"top_template":"","alternatives":[""],"fields_to_prefill":[""],"reasoning":""}`
    );
    res.json({ type: 'template-suggest', result: parseJSON(ai.content) || { raw: ai.content }, model: ai.model });
  } catch (e: any) { err(res, e, 'template-suggest'); }
});

// 6. Automated document comparison across versions
router.post('/version-diff', authenticate, async (req: AuthRequest, res) => {
  try {
    const { version_a, version_b } = req.body || {};
    if (!version_a || !version_b) return res.status(400).json({ error: 'version_a and version_b required' });
    const ai = await callLLM(
      'You compare two contract versions and produce structured material vs cosmetic changes. JSON only.',
      `A: ${String(version_a).slice(0, 4000)}\nB: ${String(version_b).slice(0, 4000)}\nReturn JSON {"material_changes":[{"clause":"","from":"","to":"","impact":"low|med|high"}],"cosmetic_changes":[""],"summary":""}`
    );
    res.json({ type: 'version-diff', result: parseJSON(ai.content) || { raw: ai.content }, model: ai.model });
  } catch (e: any) { err(res, e, 'version-diff'); }
});

export default router;
