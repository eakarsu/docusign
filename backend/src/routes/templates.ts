import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * @swagger
 * /api/templates:
 *   get:
 *     summary: Get all templates
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of templates
 */
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const templates = await prisma.template.findMany({
      where: {
        OR: [
          { creatorId: req.user!.id },
          { isPublic: true }
        ]
      },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(templates);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/templates:
 *   post:
 *     summary: Create a new template
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               fileUrl:
 *                 type: string
 *               fields:
 *                 type: object
 *               isPublic:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Template created successfully
 */
router.post('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { name, description, fileUrl, fields, isPublic = false } = req.body;

    if (!name || !fileUrl) {
      return res.status(400).json({ error: 'Name and file URL are required' });
    }

    const template = await prisma.template.create({
      data: {
        name,
        description,
        fileUrl,
        fields,
        isPublic,
        creatorId: req.user!.id
      },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    res.status(201).json(template);
  } catch (error) {
    next(error);
  }
});

export default router;
