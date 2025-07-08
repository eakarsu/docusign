import express from 'express';
import multer from 'multer';
import { DocumentService } from '../services/documentService';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = express.Router();

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

/**
 * @swagger
 * /api/documents:
 *   get:
 *     summary: Get all documents for the authenticated user
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of documents
 */
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const documents = await DocumentService.getDocuments(req.user!.id, req.user!.role);
    res.json(documents);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/documents/{id}:
 *   get:
 *     summary: Get a specific document
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Document details
 *       404:
 *         description: Document not found
 */
router.get('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const document = await DocumentService.getDocument(req.params.id, req.user!.id, req.user!.role);
    res.json(document);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/documents/upload:
 *   post:
 *     summary: Upload a new document
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Document uploaded successfully
 */
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
    res.status(201).json(document);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/documents/{id}/fields:
 *   post:
 *     summary: Add fields to a document
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fields:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Fields added successfully
 */
router.post('/:id/fields', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { fields } = req.body;
    if (!Array.isArray(fields)) {
      return res.status(400).json({ error: 'Fields must be an array' });
    }

    const result = await DocumentService.addFields(req.params.id, fields, req.user!.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/documents/{id}/send:
 *   post:
 *     summary: Send document for signatures
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               signers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     email:
 *                       type: string
 *                     name:
 *                       type: string
 *     responses:
 *       200:
 *         description: Document sent successfully
 */
router.post('/:id/send', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { signers } = req.body;
    if (!Array.isArray(signers) || signers.length === 0) {
      return res.status(400).json({ error: 'At least one signer is required' });
    }

    const result = await DocumentService.sendDocument(req.params.id, signers, req.user!.id);
    
    // Emit real-time update
    const io = req.app.get('io');
    io.to(`document-${req.params.id}`).emit('document-sent', {
      documentId: req.params.id,
      signers: result
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/documents/{id}/sign:
 *   post:
 *     summary: Sign a document
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               signatureData:
 *                 type: string
 *     responses:
 *       200:
 *         description: Document signed successfully
 */
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

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`document-${req.params.id}`).emit('document-signed', {
      documentId: req.params.id,
      signature: result
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
