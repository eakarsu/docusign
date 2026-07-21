import express from 'express';
import multer from 'multer';
import { DocumentService, DocumentActor } from '../services/documentService';
import { authenticate, AuthRequest, requirePrivileged } from '../middleware/auth';

const router = express.Router();
const service = new DocumentService();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => callback(null, ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.mimetype)),
});

router.use(authenticate);

const actor = (req: AuthRequest): DocumentActor => req.user!;
const date = (value: unknown, field: string) => {
  const parsed = new Date(String(value));
  if (!Number.isFinite(parsed.getTime())) throw Object.assign(new Error(`${field} must be a valid date`), { statusCode: 400 });
  return parsed;
};

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    return res.json(await service.list(actor(req), {
      page: Number(req.query.page || 1),
      limit: Number(req.query.limit || 10),
      search: req.query.search as string,
      status: req.query.status as string,
      matterId: req.query.matterId as string,
      sortBy: req.query.sortBy as string,
      sortOrder: req.query.sortOrder as string,
    }));
  } catch (error) { return next(error); }
});

router.get('/export/csv', async (req: AuthRequest, res, next) => {
  try {
    const result = await service.list(actor(req), { page: 1, limit: 100, status: req.query.status as string, matterId: req.query.matterId as string });
    const quote = (value: unknown) => {
      const raw = String(value ?? '');
      const neutralized = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
      return `"${neutralized.replace(/"/g, '""')}"`;
    };
    const rows = [['Title', 'Description', 'Status', 'Jurisdiction', 'Legal Review', 'Version', 'Checksum', 'Created At'].map(quote).join(',')];
    for (const document of result.data) rows.push([document.title, document.description, document.status, document.jurisdiction, document.legalReviewStatus, document.currentVersion, document.checksum, document.createdAt.toISOString()].map(quote).join(','));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="documents-export.csv"');
    return res.send(rows.join('\n'));
  } catch (error) { return next(error); }
});

router.get('/export/pdf', async (req: AuthRequest, res, next) => {
  try {
    const result = await service.list(actor(req), { page: 1, limit: 100, status: req.query.status as string, matterId: req.query.matterId as string });
    return res.json({ title: 'Documents Export', exportedAt: new Date().toISOString(), documents: result.data.map(document => ({ id: document.id, title: document.title, status: document.status, jurisdiction: document.jurisdiction, legalReviewStatus: document.legalReviewStatus, currentVersion: document.currentVersion, checksum: document.checksum, createdAt: document.createdAt })) });
  } catch (error) { return next(error); }
});

router.post('/upload', upload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    if (!req.file || !String(req.body.title || '').trim()) return res.status(400).json({ error: 'File and title are required' });
    const document = await service.upload(req.file, actor(req), {
      matterId: req.body.matterId || undefined,
      title: String(req.body.title),
      description: req.body.description ? String(req.body.description) : undefined,
      jurisdiction: req.body.jurisdiction ? String(req.body.jurisdiction) : undefined,
      effectiveDate: req.body.effectiveDate ? date(req.body.effectiveDate, 'effectiveDate') : undefined,
    });
    return res.status(201).json(document);
  } catch (error) { return next(error); }
});

router.post('/deletions/:jobId/process', requirePrivileged, async (req: AuthRequest, res, next) => {
  try { return res.json(await service.processDeletion(req.params.jobId, actor(req))); }
  catch (error) { return next(error); }
});

router.get('/:id', async (req: AuthRequest, res, next) => {
  try { return res.json(await service.get(req.params.id, actor(req))); }
  catch (error) { return next(error); }
});

router.get('/:id/download', async (req: AuthRequest, res, next) => {
  try { return res.json(await service.download(req.params.id, actor(req))); }
  catch (error) { return next(error); }
});

router.post('/:id/versions', upload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    if (!req.file || !Number.isInteger(Number(req.body.rowVersion))) return res.status(400).json({ error: 'File and rowVersion are required' });
    return res.status(201).json(await service.addVersion(req.params.id, req.file, actor(req), Number(req.body.rowVersion)));
  } catch (error) { return next(error); }
});

router.post('/:id/fields', async (req: AuthRequest, res, next) => {
  try {
    if (!Array.isArray(req.body.fields)) return res.status(400).json({ error: 'fields must be an array' });
    return res.json(await service.addFields(req.params.id, req.body.fields, actor(req)));
  } catch (error) { return next(error); }
});

router.post('/:id/redact', async (req: AuthRequest, res, next) => {
  try {
    if (!Number.isInteger(Number(req.body.rowVersion)) || !Array.isArray(req.body.marks)) return res.status(400).json({ error: 'rowVersion and marks are required' });
    return res.status(201).json(await service.redact(req.params.id, actor(req), Number(req.body.rowVersion), req.body.marks));
  } catch (error) { return next(error); }
});

router.post('/:id/legal-review', async (req: AuthRequest, res, next) => {
  try {
    if (!['APPROVED', 'REJECTED'].includes(req.body.decision)) return res.status(400).json({ error: 'decision must be APPROVED or REJECTED' });
    return res.json(await service.legalReview(req.params.id, actor(req), { decision: req.body.decision, jurisdiction: String(req.body.jurisdiction || ''), effectiveDate: date(req.body.effectiveDate, 'effectiveDate'), rationale: String(req.body.rationale || '') }));
  } catch (error) { return next(error); }
});

router.post('/:id/send', async (req: AuthRequest, res, next) => {
  try {
    if (!Array.isArray(req.body.signers)) return res.status(400).json({ error: 'signers must be an array' });
    return res.json(await service.send(req.params.id, req.body.signers, actor(req)));
  } catch (error) { return next(error); }
});

router.post('/:id/sign', async (req: AuthRequest, res, next) => {
  try {
    return res.json(await service.sign(req.params.id, actor(req), { signatureData: String(req.body.signatureData || ''), consent: req.body.consent, ipAddress: req.ip, userAgent: req.get('User-Agent') }));
  } catch (error) { return next(error); }
});

router.post('/:id/decline', async (req: AuthRequest, res, next) => {
  try { return res.json(await service.decline(req.params.id, actor(req), String(req.body.reason || ''))); }
  catch (error) { return next(error); }
});

router.post('/:id/ocr', async (req: AuthRequest, res, next) => {
  try { return res.status(202).json(await service.runOcr(req.params.id, actor(req))); }
  catch (error) { return next(error); }
});

router.post('/:id/file', async (req: AuthRequest, res, next) => {
  try { return res.status(201).json(await service.file(req.params.id, actor(req))); }
  catch (error) { return next(error); }
});

router.delete('/:id', async (req: AuthRequest, res, next) => {
  try { return res.status(202).json(await service.requestDeletion(req.params.id, actor(req))); }
  catch (error) { return next(error); }
});

export default router;
