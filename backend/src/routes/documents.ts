import express from 'express';
import multer from 'multer';
import { DocumentService } from '../services/documentService';
import { authenticate, AuthRequest } from '../middleware/auth';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and Word documents are allowed.'));
    }
  },
});

// Get all documents (with pagination)
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || '';
    const status = req.query.status as string;
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortOrder = (req.query.sortOrder as string) || 'desc';

    const where: any = req.user!.role === 'ADMIN' ? {} : { senderId: req.user!.id };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        include: {
          sender: {
            select: { id: true, email: true, firstName: true, lastName: true }
          },
          signatures: {
            select: { id: true, status: true, signerEmail: true, signerName: true, signedAt: true }
          },
          _count: { select: { signatures: true } }
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.document.count({ where }),
    ]);

    return res.json({
      data: documents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    });
  } catch (error) {
    return next(error);
  }
});

// CSV export
router.get('/export/csv', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const where: any = req.user!.role === 'ADMIN' ? {} : { senderId: req.user!.id };
    const status = req.query.status as string;
    if (status && status !== 'all') where.status = status;

    const documents = await prisma.document.findMany({
      where,
      include: {
        sender: { select: { firstName: true, lastName: true, email: true } },
        _count: { select: { signatures: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const headers = ['Title', 'Description', 'Status', 'Sender', 'Sender Email', 'File Size (KB)', 'Signatures', 'Created At', 'Updated At'];
    const csvRows = [headers.join(',')];

    for (const doc of documents) {
      const row = [
        `"${(doc.title || '').replace(/"/g, '""')}"`,
        `"${(doc.description || '').replace(/"/g, '""')}"`,
        doc.status,
        `"${doc.sender.firstName} ${doc.sender.lastName}"`,
        doc.sender.email,
        Math.round(doc.fileSize / 1024),
        doc._count.signatures,
        new Date(doc.createdAt).toISOString(),
        new Date(doc.updatedAt).toISOString(),
      ];
      csvRows.push(row.join(','));
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=documents-export-${Date.now()}.csv`);
    return res.send(csvRows.join('\n'));
  } catch (error) {
    return next(error);
  }
});

// PDF export (JSON for frontend to render)
router.get('/export/pdf', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const where: any = req.user!.role === 'ADMIN' ? {} : { senderId: req.user!.id };
    const status = req.query.status as string;
    if (status && status !== 'all') where.status = status;

    const documents = await prisma.document.findMany({
      where,
      include: {
        sender: { select: { firstName: true, lastName: true, email: true } },
        signatures: { select: { status: true, signerName: true, signerEmail: true, signedAt: true } },
        _count: { select: { signatures: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      title: 'Documents Export',
      exportDate: new Date().toISOString(),
      totalDocuments: documents.length,
      documents: documents.map(doc => ({
        title: doc.title,
        description: doc.description,
        status: doc.status,
        sender: `${doc.sender.firstName} ${doc.sender.lastName}`,
        senderEmail: doc.sender.email,
        fileSizeKB: Math.round(doc.fileSize / 1024),
        signatureCount: doc._count.signatures,
        signatures: doc.signatures,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

// Get single document
router.get('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const document = await DocumentService.getDocument(req.params.id, req.user!.id, req.user!.role);
    return res.json(document);
  } catch (error) {
    return next(error);
  }
});

// Upload document
router.post('/upload', authenticate, upload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { title, description } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const document = await DocumentService.uploadDocument(req.file, req.user!.id, title, description);
    return res.status(201).json(document);
  } catch (error) {
    return next(error);
  }
});

// Add fields to document
router.post('/:id/fields', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { fields } = req.body;
    if (!Array.isArray(fields)) {
      return res.status(400).json({ error: 'Fields must be an array' });
    }

    const result = await DocumentService.addFields(req.params.id, fields, req.user!.id);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

// Send document for signatures
router.post('/:id/send', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { signers } = req.body;
    if (!Array.isArray(signers) || signers.length === 0) {
      return res.status(400).json({ error: 'At least one signer is required' });
    }

    const result = await DocumentService.sendDocument(req.params.id, signers, req.user!.id);

    const io = req.app.get('io');
    io.to(`document-${req.params.id}`).emit('document-sent', {
      documentId: req.params.id,
      signers: result
    });

    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

// Sign document
router.post('/:id/sign', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { signatureData } = req.body;
    if (!signatureData) {
      return res.status(400).json({ error: 'Signature data is required' });
    }

    const result = await DocumentService.signDocument(
      req.params.id,
      signatureData,
      req.user!.id,
      req.ip,
      req.get('User-Agent')
    );

    const io = req.app.get('io');
    io.to(`document-${req.params.id}`).emit('document-signed', {
      documentId: req.params.id,
      signature: result
    });

    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

// Bulk delete documents
router.post('/bulk/delete', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Document IDs are required' });
    }

    const results = [];
    for (const id of ids) {
      try {
        await DocumentService.deleteDocument(id, req.user!.id, req.user!.role);
        results.push({ id, success: true });
      } catch (err: any) {
        results.push({ id, success: false, error: err.message });
      }
    }

    return res.json({ results, deletedCount: results.filter(r => r.success).length });
  } catch (error) {
    return next(error);
  }
});

// Bulk update documents (status change)
router.post('/bulk/update', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { ids, updates } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Document IDs are required' });
    }
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ error: 'Updates object is required' });
    }

    const allowedUpdates: any = {};
    if (updates.status) allowedUpdates.status = updates.status;
    if (updates.description !== undefined) allowedUpdates.description = updates.description;

    const results = [];
    for (const id of ids) {
      try {
        const doc = await prisma.document.findUnique({ where: { id } });
        if (!doc) {
          results.push({ id, success: false, error: 'Document not found' });
          continue;
        }
        if (req.user!.role !== 'ADMIN' && doc.senderId !== req.user!.id) {
          results.push({ id, success: false, error: 'Access denied' });
          continue;
        }
        await prisma.document.update({ where: { id }, data: allowedUpdates });
        results.push({ id, success: true });
      } catch (err: any) {
        results.push({ id, success: false, error: err.message });
      }
    }

    return res.json({ results, updatedCount: results.filter(r => r.success).length });
  } catch (error) {
    return next(error);
  }
});

// Delete single document
router.delete('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const result = await DocumentService.deleteDocument(
      req.params.id,
      req.user!.id,
      req.user!.role
    );

    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

export default router;
