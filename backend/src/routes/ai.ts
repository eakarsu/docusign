import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AIService } from '../services/aiService';
import { DocumentActor } from '../services/documentService';

const router = Router();
const service = new AIService();
router.use(authenticate);
const actor = (req: AuthRequest): DocumentActor => req.user!;

router.post('/analyze/:documentId', async (req: AuthRequest, res, next) => {
  try { return res.status(202).json(await service.analyzeDocument(req.params.documentId, actor(req))); }
  catch (error) { return next(error); }
});

router.post('/generate-contract', async (req: AuthRequest, res, next) => {
  try {
    const effectiveDate = new Date(req.body.effectiveDate);
    if (!req.body.matterId || !req.body.prompt || !req.body.contractType || !req.body.templateId || !req.body.jurisdiction || !Number.isFinite(effectiveDate.getTime())) return res.status(400).json({ error: 'matterId, prompt, contractType, templateId, jurisdiction and effectiveDate are required' });
    return res.status(202).json(await service.generateContract(actor(req), { matterId: req.body.matterId, prompt: req.body.prompt, contractType: req.body.contractType, templateId: req.body.templateId, jurisdiction: req.body.jurisdiction, effectiveDate }));
  } catch (error) { return next(error); }
});

router.post('/artifacts/:id/review', async (req: AuthRequest, res, next) => {
  try {
    if (!['APPROVED', 'REJECTED'].includes(req.body.decision)) return res.status(400).json({ error: 'decision must be APPROVED or REJECTED' });
    return res.json(await service.reviewArtifact(req.params.id, actor(req), req.body.decision, String(req.body.rationale || '')));
  } catch (error) { return next(error); }
});

router.post('/compare-versions', async (req: AuthRequest, res, next) => {
  try {
    const fromVersion = Number(req.body.fromVersion); const toVersion = Number(req.body.toVersion);
    if (!req.body.documentId || !Number.isInteger(fromVersion) || !Number.isInteger(toVersion) || fromVersion === toVersion) return res.status(400).json({ error: 'documentId and two distinct integer versions are required' });
    return res.json(await service.compareVersions(req.body.documentId, fromVersion, toVersion, actor(req)));
  } catch (error) { return next(error); }
});

router.post('/suggest-template', async (req: AuthRequest, res, next) => {
  try {
    if (!String(req.body.description || '').trim()) return res.status(400).json({ error: 'description is required' });
    return res.json(await service.suggestTemplate(String(req.body.description), actor(req)));
  } catch (error) { return next(error); }
});

router.post('/operational-risk-review', async (req: AuthRequest, res, next) => {
  try {
    const prompt = String(req.body?.prompt || '').trim();
    if (prompt.length < 20 || prompt.length > 4_000) return res.status(400).json({ error: 'prompt must contain between 20 and 4000 characters' });
    return res.json(await service.operationalRiskReview(prompt, actor(req)));
  } catch (error) { return next(error); }
});

router.all(['/detect-fields/:documentId', '/generate-overlay/:documentId/:pageNumber'], (_req, res) => res.status(410).json({ error: 'Legacy simulated AI field detection is disabled; configure deterministic fields on a reviewed document version.' }));

export default router;
