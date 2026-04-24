import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Get all users (Admin only, with pagination)
router.get('/', authenticate, authorize(['ADMIN']), async (req: AuthRequest, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || '';
    const role = req.query.role as string;
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortOrder = (req.query.sortOrder as string) || 'desc';

    const where: any = {};

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (role && role !== 'all') {
      where.role = role;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          createdAt: true,
          isEmailVerified: true,
          _count: {
            select: {
              sentDocuments: true,
              signatures: true,
            }
          }
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return res.json({
      data: users,
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

// Get user by ID
router.get('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    if (req.user!.role !== 'ADMIN' && req.user!.id !== id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        isEmailVerified: true,
        _count: {
          select: {
            sentDocuments: true,
            signatures: true,
            templates: true,
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(user);
  } catch (error) {
    return next(error);
  }
});

// CSV export users (Admin only)
router.get('/export/csv', authenticate, authorize(['ADMIN']), async (req: AuthRequest, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isEmailVerified: true,
        createdAt: true,
        _count: { select: { sentDocuments: true, signatures: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const headers = ['First Name', 'Last Name', 'Email', 'Role', 'Email Verified', 'Documents Sent', 'Signatures', 'Created At'];
    const csvRows = [headers.join(',')];

    for (const user of users) {
      csvRows.push([
        `"${user.firstName}"`,
        `"${user.lastName}"`,
        user.email,
        user.role,
        user.isEmailVerified ? 'Yes' : 'No',
        user._count.sentDocuments,
        user._count.signatures,
        new Date(user.createdAt).toISOString(),
      ].join(','));
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=users-export-${Date.now()}.csv`);
    return res.send(csvRows.join('\n'));
  } catch (error) {
    return next(error);
  }
});

export default router;
