import express from 'express';
import { AIService } from '../services/aiService';
import { authenticate, AuthRequest } from '../middleware/auth';

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
    res.json(analysis);
  } catch (error) {
    next(error);
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
    res.json({ contract });
  } catch (error) {
    next(error);
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
    // In a real implementation, you would extract text from the document
    const documentText = "Sample document text for field detection";
    
    const fields = await AIService.detectFields(documentText);
    res.json({ fields });
  } catch (error) {
    next(error);
  }
});

export default router;
