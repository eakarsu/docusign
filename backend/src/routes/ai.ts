import express from 'express';
import { AIService } from '../services/aiService';
import { authenticate, AuthRequest } from '../middleware/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const router = express.Router();

/**
 * @swagger
 * /api/ai/analyze/{documentId}:
 *   post:
 *     summary: Analyze a document with AI
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Document analysis completed
 */
router.post('/analyze/:documentId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    // In a real implementation, you would extract text from the document
    // For now, we'll use a placeholder
    const documentText = "Sample document text for analysis";
    
    const analysis = await AIService.analyzeDocument(req.params.documentId, documentText);
    return res.json(analysis);
  } catch (error) {
    return next(error);
  }
});

/**
 * @swagger
 * /api/ai/generate-contract:
 *   post:
 *     summary: Generate a contract using AI
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               prompt:
 *                 type: string
 *               contractType:
 *                 type: string
 *     responses:
 *       200:
 *         description: Contract generated successfully
 */
router.post('/generate-contract', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { prompt, contractType } = req.body;
    
    if (!prompt || !contractType) {
      return res.status(400).json({ error: 'Prompt and contract type are required' });
    }

    const contract = await AIService.generateContract(prompt, contractType);
    return res.json({ contract });
  } catch (error) {
    return next(error);
  }
});

/**
 * @swagger
 * /api/ai/detect-fields/{documentId}:
 *   post:
 *     summary: Detect fields in a document using AI
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Fields detected successfully
 */
router.post('/detect-fields/:documentId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    // Get the document from database
    const document = await prisma.document.findUnique({
      where: { id: req.params.documentId },
      include: { sender: true }
    });
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // Check if user has access to this document
    if (document.senderId !== req.user!.id && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // For now, we'll use the document title and description as text
    // In a real implementation, you would extract text from the PDF file
    const documentText = `${document.title}\n${document.description || ''}`;
    
    console.log('🤖 AI detect-fields route called for document:', req.params.documentId);
    console.log('🤖 Document text length:', documentText.length);
    
    const fields = await AIService.detectFields(documentText);
    
    console.log('🤖 AI service returned fields:', fields);
    console.log('🤖 Fields count:', fields.length);
    
    return res.json({ 
      success: true,
      data: fields,
      fields: fields // Include both formats for compatibility
    });
  } catch (error) {
    console.error('❌ AI detect-fields error:', error);
    return next(error);
  }
});

export default router;
