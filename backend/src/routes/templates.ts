import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Get all templates (with pagination)
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || '';
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortOrder = (req.query.sortOrder as string) || 'desc';

    const where: any = {
      OR: [
        { creatorId: req.user!.id },
        { isPublic: true }
      ]
    };

    if (search) {
      where.AND = [
        {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ]
        }
      ];
    }

    const [templates, total] = await Promise.all([
      prisma.template.findMany({
        where,
        include: {
          creator: {
            select: { id: true, firstName: true, lastName: true, email: true }
          }
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.template.count({ where }),
    ]);

    return res.json({
      data: templates,
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

// CSV export templates
router.get('/export/csv', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const where: any = {
      OR: [
        { creatorId: req.user!.id },
        { isPublic: true }
      ]
    };

    const templates = await prisma.template.findMany({
      where,
      include: {
        creator: { select: { firstName: true, lastName: true, email: true } }
      },
      orderBy: { createdAt: 'desc' },
    });

    const headers = ['Name', 'Description', 'Creator', 'Creator Email', 'Public', 'Created At'];
    const csvRows = [headers.join(',')];

    for (const t of templates) {
      csvRows.push([
        `"${(t.name || '').replace(/"/g, '""')}"`,
        `"${(t.description || '').replace(/"/g, '""')}"`,
        `"${t.creator.firstName} ${t.creator.lastName}"`,
        t.creator.email,
        t.isPublic ? 'Yes' : 'No',
        new Date(t.createdAt).toISOString(),
      ].join(','));
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=templates-export-${Date.now()}.csv`);
    return res.send(csvRows.join('\n'));
  } catch (error) {
    return next(error);
  }
});

// Create template
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
          select: { id: true, firstName: true, lastName: true, email: true }
        }
      }
    });

    return res.status(201).json(template);
  } catch (error) {
    return next(error);
  }
});

// Update template
router.put('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const template = await prisma.template.findUnique({ where: { id } });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    if (template.creatorId !== req.user!.id && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { name, description, fields, isPublic } = req.body;
    const updated = await prisma.template.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(fields && { fields }),
        ...(isPublic !== undefined && { isPublic }),
      },
      include: {
        creator: { select: { id: true, firstName: true, lastName: true, email: true } }
      }
    });

    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});

// Delete template
router.delete('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const template = await prisma.template.findUnique({ where: { id } });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    if (template.creatorId !== req.user!.id && req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.template.delete({ where: { id } });
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

export default router;
