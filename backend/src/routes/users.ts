import { Router } from 'express';
import { Prisma, PrismaClient, UserRole } from '@prisma/client';
import { authenticate, AuthRequest, requirePrivileged } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate);

const csv = (value: unknown) => {
  const raw = String(value ?? '');
  const neutralized = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${neutralized.replace(/"/g, '""')}"`;
};

router.get('/export/csv', requirePrivileged, async (req: AuthRequest, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: { organizationId: req.user!.organizationId },
      select: { email: true, firstName: true, lastName: true, role: true, isEmailVerified: true, isActive: true, createdAt: true, _count: { select: { sentDocuments: true, signatures: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const rows = [['First Name', 'Last Name', 'Email', 'Role', 'Active', 'Email Verified', 'Documents Sent', 'Signatures', 'Created At'].map(csv).join(',')];
    for (const user of users) rows.push([user.firstName, user.lastName, user.email, user.role, user.isActive, user.isEmailVerified, user._count.sentDocuments, user._count.signatures, user.createdAt.toISOString()].map(csv).join(','));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="users-export.csv"');
    return res.send(rows.join('\n'));
  } catch (error) { return next(error); }
});

router.get('/', requirePrivileged, async (req: AuthRequest, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 10)));
    const search = String(req.query.search || '').trim();
    const role = Object.values(UserRole).includes(req.query.role as UserRole) ? req.query.role as UserRole : undefined;
    const sortBy = ['createdAt', 'email', 'firstName', 'lastName', 'role'].includes(String(req.query.sortBy)) ? String(req.query.sortBy) : 'createdAt';
    const sortOrder: Prisma.SortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc';
    const where: Prisma.UserWhereInput = {
      organizationId: req.user!.organizationId,
      ...(role && { role }),
      ...(search && { OR: [{ firstName: { contains: search, mode: 'insensitive' } }, { lastName: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] }),
    };
    const [data, total] = await Promise.all([
      prisma.user.findMany({ where, select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true, createdAt: true, isEmailVerified: true, _count: { select: { sentDocuments: true, signatures: true } } }, orderBy: { [sortBy]: sortOrder }, skip: (page - 1) * limit, take: limit }),
      prisma.user.count({ where }),
    ]);
    return res.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) { return next(error); }
});

router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    if (req.user!.id !== req.params.id && (!req.user!.privileged || req.user!.role !== 'ADMIN')) return res.status(403).json({ error: 'Privileged administrator session required' });
    const user = await prisma.user.findFirst({
      where: { id: req.params.id, organizationId: req.user!.organizationId },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true, createdAt: true, isEmailVerified: true, _count: { select: { sentDocuments: true, signatures: true, templates: true, matterMemberships: true } } },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json(user);
  } catch (error) { return next(error); }
});

export default router;
