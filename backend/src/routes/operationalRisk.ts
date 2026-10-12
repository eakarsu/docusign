import { Router } from 'express'
import { AuthRequest } from '../middleware/auth'
import { AuthService } from '../services/authService'
import { AIService } from '../services/aiService'
import { createError } from '../middleware/errorHandler'
export function createOperationalRiskRouter(service = new AIService()) {
  const router = Router()
  router.get('/', async (req: AuthRequest, res, next) => { try { if (!req.user) throw createError('Authentication required', 401); res.set('Cache-Control', 'no-store'); return res.json({ items: await service.operationalRiskHistory(req.user) }) } catch (error) { return next(error) } })
  router.post('/', async (req: AuthRequest, res, next) => {
    const controller = new AbortController()
    const cancel = () => controller.abort(createError('AI request cancelled', 499))
    const disconnected = () => { if (!res.writableFinished) cancel() }
    req.once('aborted', cancel); res.once('close', disconnected)
    const timer = setTimeout(() => controller.abort(createError('AI request timed out', 504)), 60_000); timer.unref()
    try {
      const actor = req.user
      if (!actor) throw createError('Authentication required', 401)
      const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : ''
      if (prompt.length < 20 || prompt.length > 4000) throw createError('prompt must contain between 20 and 4000 characters', 400)
      if (req.aborted || res.destroyed) cancel()
      controller.signal.throwIfAborted()
      const token = req.header('Authorization')?.replace(/^Bearer /, '') || req.cookies?.accessToken
      const revalidate = async () => {
        const current = token ? await AuthService.authenticate(token) : null
        controller.signal.throwIfAborted()
        if (!current || current.id !== actor.id || current.sessionId !== actor.sessionId || current.organizationId !== actor.organizationId || current.role !== actor.role || current.privileged !== actor.privileged) throw createError('Session changed during generation', 401)
      }
      const report = await service.operationalRiskReview(prompt, actor, { signal: controller.signal, revalidate })
      controller.signal.throwIfAborted()
      if (!res.destroyed) return res.json(report)
      return undefined
    } catch (error) { if (res.destroyed || req.aborted) return undefined; return next(controller.signal.aborted ? controller.signal.reason : error) }
    finally { clearTimeout(timer); req.removeListener('aborted', cancel); res.removeListener('close', disconnected) }
  })
  router.delete('/', (_req, res) => res.status(405).json({ error: 'Native artifact deletion is not available; counsel review and retention gates remain required' }))
  return router
}
