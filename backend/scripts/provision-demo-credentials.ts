import bcrypt from 'bcryptjs';
import { PrismaClient, UserRole, MatterRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') return;
  const email = String(process.env.DEMO_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.DEMO_PASSWORD || '');
  if (!email || password.length < 12) throw new Error('Local demo credentials are not configured');

  const organization = await prisma.organization.upsert({
    where: { domain: 'demo-signing-workflow.invalid' },
    update: { name: 'Demo Signing Workflow' },
    create: { name: 'Demo Signing Workflow', domain: 'demo-signing-workflow.invalid' },
  });
  const accounts: Array<[string, string, string, UserRole, MatterRole]> = [
    [email, 'Demo', 'Sender', UserRole.SENDER, MatterRole.OWNER],
    [email.replace('@', '+signer@'), 'Demo', 'Signer', UserRole.SIGNER, MatterRole.CLIENT],
    [email.replace('@', '+viewer@'), 'Demo', 'Viewer', UserRole.VIEWER, MatterRole.AUDITOR],
  ];
  const passwordHash = await bcrypt.hash(password, 12);
  const users = [];
  for (const [accountEmail, firstName, lastName, role] of accounts) {
    users.push(await prisma.user.upsert({
      where: { email: accountEmail },
      update: { password: passwordHash, firstName, lastName, role, organizationId: organization.id, isActive: true, isEmailVerified: true, mfaEnabled: false, mfaSecret: null },
      create: { email: accountEmail, password: passwordHash, firstName, lastName, role, organizationId: organization.id, isActive: true, isEmailVerified: true },
    }));
  }
  let matter = await prisma.matter.findFirst({ where: { organizationId: organization.id, reference: 'DEMO-GENERAL' } });
  if (!matter) {
    matter = await prisma.matter.create({ data: { organizationId: organization.id, name: 'Demo General', reference: 'DEMO-GENERAL', jurisdiction: 'UNSPECIFIED', retentionUntil: new Date(Date.now() + 365 * 86_400_000), createdById: users[0].id } });
  }
  for (let index = 0; index < users.length; index += 1) {
    const membership = await prisma.matterMember.findFirst({ where: { matterId: matter.id, userId: users[index].id } });
    if (membership) await prisma.matterMember.update({ where: { id: membership.id }, data: { role: accounts[index][4], revokedAt: null } });
    else await prisma.matterMember.create({ data: { matterId: matter.id, userId: users[index].id, role: accounts[index][4] } });
  }
  console.log('Provisioned 3 local demo users.');
}

main().finally(() => prisma.$disconnect());
