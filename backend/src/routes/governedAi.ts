import { Router, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AuthService } from '../services/authService';
import { AIService } from '../services/aiService';
import { GenerationOptions, GovernedActor } from '../services/governedAiService';
import { createError } from '../middleware/errorHandler';

export function createGovernedAIRouter(service = new AIService()) {
  const router = Router();
  const generate = (run: (req: AuthRequest, actor: GovernedActor, options: GenerationOptions) => Promise<unknown>) => async (req: AuthRequest, res: Response, next: NextFunction) => {
    const controller = new AbortController();
    const cancel = () => controller.abort(createError('AI request cancelled', 499));
    const disconnected = () => { if (!res.writableFinished) cancel(); };
    req.once('aborted', cancel); res.once('close', disconnected);
    const timer = setTimeout(() => controller.abort(createError('AI request timed out', 504)), 120_000); timer.unref();
    try {
      const actor = req.user;
      if (!actor) throw createError('Authentication required', 401);
      if (req.aborted || res.destroyed) cancel();
      const token = req.header('Authorization')?.replace(/^Bearer /, '') || req.cookies?.accessToken;
      const revalidate = async () => {
        const current = token ? await AuthService.authenticate(token) : null;
        controller.signal.throwIfAborted();
        if (!current || current.id !== actor.id || current.sessionId !== actor.sessionId || current.organizationId !== actor.organizationId || current.role !== actor.role || current.privileged !== actor.privileged) throw createError('Session changed during generation', 401);
      };
      const result = await run(req, actor, { signal: controller.signal, revalidate });
      controller.signal.throwIfAborted();
      if (!res.destroyed) return res.status(202).json(result);
      return undefined;
    } catch (error) { if (req.aborted || res.destroyed) return undefined; return next(controller.signal.aborted ? controller.signal.reason : error); }
    finally { clearTimeout(timer); req.removeListener('aborted', cancel); res.removeListener('close', disconnected); }
  };
  router.get('/governed-sources', async (req: AuthRequest, res, next) => {
    try { if (!req.user) throw createError('Authentication required', 401); res.set('Cache-Control', 'no-store'); return res.json(await service.governedSources(req.user)); } catch (error) { return next(error); }
  });
  router.get('/governed-artifacts', async (req: AuthRequest, res, next) => {
    try { if (!req.user) throw createError('Authentication required', 401); res.set('Cache-Control', 'no-store'); return res.json(await service.governedHistory(req.user)); } catch (error) { return next(error); }
  });
  router.delete('/governed-artifacts/:id', (_req, res) => res.status(405).json({ error: 'AI evidence is retained. Reuse inputs to generate a new artifact; independent counsel review remains required.' }));
  router.post('/analyze/:documentId', generate((req, actor, options) => {
    if (req.body?.reviewFocus !== undefined && (typeof req.body.reviewFocus !== 'string' || Buffer.byteLength(req.body.reviewFocus, 'utf8') > 2_000)) throw createError('Optional reviewFocus must be text of at most 2000 bytes', 400);
    return service.analyzeDocument(req.params.documentId, actor, { ...options, reviewFocus: req.body?.reviewFocus || '' });
  }));
  router.post('/generate-contract', generate((req, actor, options) => {
    const keys = ['matterId', 'prompt', 'contractType', 'templateId', 'jurisdiction'] as const;
    if (!keys.every(key => typeof req.body?.[key] === 'string' && req.body[key].trim())) throw createError('matterId, prompt, contractType, templateId, jurisdiction and effectiveDate are required', 400);
    const effectiveDate = typeof req.body?.effectiveDate === 'string' ? new Date(req.body.effectiveDate) : new Date(NaN);
    if (!Number.isFinite(effectiveDate.getTime()) || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(req.body.effectiveDate)) throw createError('effectiveDate must be a valid date', 400);
    if (Buffer.byteLength(req.body.prompt, 'utf8') > 20_000 || Buffer.byteLength(req.body.contractType, 'utf8') > 150 || keys.filter(key => !['prompt', 'contractType'].includes(key)).some(key => req.body[key].length > 200)) throw createError('Draft input exceeds the native size limit', 400);
    return service.generateContract(actor, { matterId: req.body.matterId, prompt: req.body.prompt, contractType: req.body.contractType, templateId: req.body.templateId, jurisdiction: req.body.jurisdiction, effectiveDate }, options);
  }));
  return router;
}
