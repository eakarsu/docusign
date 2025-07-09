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
 * /api/ai/generate-overlay/{documentId}/{pageNumber}:
 *   post:
 *     summary: Generate signature overlay image for a PDF page using AI vision
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: pageNumber
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               pdfImageBase64:
 *                 type: string
 *                 description: Base64 encoded PNG image of the PDF page
 *     responses:
 *       200:
 *         description: Overlay image generated successfully
 */
router.post('/generate-overlay/:documentId/:pageNumber', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { pdfImageBase64 } = req.body;
    const pageNumber = parseInt(req.params.pageNumber);
    
    if (!pdfImageBase64) {
      return res.status(400).json({ error: 'PDF image data is required' });
    }
    
    console.log('🤖 AI generate-overlay route called for document:', req.params.documentId, 'page:', pageNumber);
    
    const result = await AIService.generateSignatureOverlayImage(
      req.params.documentId, 
      pageNumber, 
      pdfImageBase64
    );
    
    console.log('🤖 AI service returned overlay result:', {
      hasOverlayImage: !!result.overlayImage,
      signatureFieldsCount: result.signatureFields.length
    });
    
    return res.json({ 
      success: true,
      data: result,
      overlayImage: result.overlayImage,
      signatureFields: result.signatureFields
    });
  } catch (error) {
    console.error('❌ AI generate-overlay error:', error);
    return next(error);
  }
});

/**
 * @swagger
 * /api/ai/detect-fields/{documentId}:
 *   post:
 *     summary: Detect fields in a document using AI (legacy method)
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
    
    // For now, we'll simulate the actual PDF content that would be extracted
    // In a real implementation, you would extract text from the PDF file using pdf-parse or similar
    const documentText = `${document.title}\n${document.description || ''}\n
    
PARTIES:
Client: [CLIENT_NAME]
Service Provider: [PROVIDER_NAME]

TERMS:
1. The service provider agrees to provide the following services:
   - Web development services
   - Technical support
   - Maintenance and updates

2. Payment terms: Net 30 days

3. This agreement shall remain in effect for one (1) year.

4. Additional terms and conditions apply as outlined below.

INITIAL SIGNATURES (Page 1):

Client Initial: _________________________ Date: _________

Provider Initial: _______________________ Date: _________

ADDITIONAL TERMS AND CONDITIONS - PAGE 2

4. Liability and Indemnification:
   - Service provider liability is limited to the contract value
   - Client agrees to indemnify provider against third-party claims

5. Termination:
   - Either party may terminate with 30 days written notice
   - All work completed up to termination date will be paid

6. Intellectual Property:
   - All work product belongs to the client upon full payment
   - Provider retains rights to general methodologies and know-how

7. Governing Law:
   - This agreement shall be governed by applicable state laws
   - Any disputes shall be resolved through binding arbitration

FINAL SIGNATURES (Page 2):

By signing below, both parties agree to all terms and conditions
outlined in this Service Agreement.

CLIENT:
Full Signature: _________________________ Date: _________
Print Name: _________________________
Title: _________________________

SERVICE PROVIDER:
Full Signature: _________________________ Date: _________
Print Name: _________________________
Title: _________________________

WITNESS (if required):
Signature: _________________________ Date: _________
Print Name: _________________________`;
    
    console.log('🤖 AI detect-fields route called for document:', req.params.documentId);
    console.log('🤖 Document text length:', documentText.length);
    
    const overlays = await AIService.detectSignatureOverlays(documentText);
    
    console.log('🤖 AI service returned signature overlays:', overlays);
    console.log('🤖 Overlays count:', overlays.length);
    
    return res.json({ 
      success: true,
      data: overlays,
      overlays: overlays,
      fields: overlays // Include for compatibility
    });
  } catch (error) {
    console.error('❌ AI detect-fields error:', error);
    return next(error);
  }
});

export default router;
