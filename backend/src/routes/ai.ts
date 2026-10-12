import { createGovernedAIRouter } from './governedAi';
import { createOperationalRiskRouter } from './operationalRisk';
import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AIService } from '../services/aiService';
import { DocumentActor } from '../services/documentService';

const router = Router();
const service = new AIService();
router.use(authenticate);
const actor = (req: AuthRequest): DocumentActor => req.user!;

router.use(createGovernedAIRouter(service));

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

router.use('/operational-risk-review', createOperationalRiskRouter(service));

router.all(['/detect-fields/:documentId', '/generate-overlay/:documentId/:pageNumber'], (_req, res) => res.status(410).json({ error: 'Legacy simulated AI field detection is disabled; configure deterministic fields on a reviewed document version.' }));

export default router;
