import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { createError } from '../middleware/errorHandler';
import { decryptTotpSecret, encryptTotpSecret, generateTotpSecret, verifyTotp } from '../security/mfa';
import { EmailService } from './emailService';
import { appendAudit } from '../security/audit';

const prisma = new PrismaClient();
const issuer = 'docusign-workflow-api';
const audience = 'docusign-workflow-client';
const digest = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32) throw new Error('JWT_SECRET_MUST_BE_32_CHARACTERS');
  return value;
}

function personalDomain(email: string) {
  return `personal-${digest(email.toLowerCase()).slice(0, 20)}.invalid`;
}

export interface SessionClaims {
  id: string;
  organizationId: string;
  sid: string;
  tokenVersion: number;
  privileged: boolean;
  type: 'access';
}

export class AuthService {
  static async register(userData: { email: string; password: string; firstName: string; lastName: string; invitationToken?: string }, context: { ipAddress: string; userAgent: string }) {
    const email = userData.email.trim().toLowerCase();
    if (await prisma.user.findUnique({ where: { email } })) throw createError('User already exists', 409);
    const invitation = userData.invitationToken ? await prisma.matterInvitation.findFirst({ where: { tokenHash: digest(userData.invitationToken), email, acceptedAt: null, expiresAt: { gt: new Date() } } }) : null;
    if (userData.invitationToken && !invitation) throw createError('Invalid or expired matter invitation', 400);
    const password = await bcrypt.hash(userData.password, 12);
    const verificationToken = crypto.randomBytes(32).toString('base64url');
    const retentionUntil = new Date(Date.now() + 7 * 365 * 86_400_000);
    const created = await prisma.$transaction(async tx => {
      const organization = invitation ? await tx.organization.findUniqueOrThrow({ where: { id: invitation.organizationId } }) : await tx.organization.create({ data: { name: `${userData.firstName} ${userData.lastName} Workspace`, domain: personalDomain(email) } });
      const appRole = invitation ? (['OWNER', 'COUNSEL', 'PARALEGAL'].includes(invitation.role) ? 'SENDER' : ['CLIENT', 'WITNESS'].includes(invitation.role) ? 'SIGNER' : 'VIEWER') : 'SENDER';
      const user = await tx.user.create({ data: {
        email,
        password,
        firstName: userData.firstName.trim(),
        lastName: userData.lastName.trim(),
        role: appRole,
        organizationId: organization.id,
        emailVerifyTokenHash: digest(verificationToken),
        isEmailVerified: process.env.REQUIRE_EMAIL_VERIFICATION !== 'true',
      } });
      if (invitation) {
        await tx.matterMember.upsert({ where: { matterId_userId: { matterId: invitation.matterId, userId: user.id } }, update: { role: invitation.role, revokedAt: null }, create: { matterId: invitation.matterId, userId: user.id, role: invitation.role } });
        await tx.matterInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });
        await appendAudit(tx, { organizationId: organization.id, matterId: invitation.matterId, userId: user.id, action: 'MATTER_INVITATION_ACCEPTED', details: { invitationId: invitation.id, role: invitation.role } });
      } else {
        const matter = await tx.matter.create({ data: { organizationId: organization.id, name: 'General', reference: 'GENERAL', jurisdiction: 'UNSPECIFIED', retentionUntil, createdById: user.id } });
        await tx.matterMember.create({ data: { matterId: matter.id, userId: user.id, role: 'OWNER' } });
        await appendAudit(tx, { organizationId: organization.id, matterId: matter.id, userId: user.id, action: 'WORKSPACE_REGISTERED', details: { emailVerified: process.env.REQUIRE_EMAIL_VERIFICATION !== 'true' } });
      }
      return user;
    });
    if (!created.isEmailVerified) {
      await EmailService.sendVerification({ to: created.email, firstName: created.firstName, token: verificationToken });
      return { user: this.publicUser(created), verificationRequired: true };
    }
    return { user: this.publicUser(created), ...(await this.createSession(created, context, false)) };
  }

  static async login(emailInput: string, password: string, context: { ipAddress: string; userAgent: string }, mfaCode?: string) {
    const user = await prisma.user.findUnique({ where: { email: emailInput.trim().toLowerCase() } });
    if (!user?.isActive || !await bcrypt.compare(password, user.password)) throw createError('Invalid credentials', 401);
    if (!user.isEmailVerified) throw createError('Email verification required', 403);
    if (user.mfaEnabled && (!user.mfaSecret || !mfaCode || !verifyTotp(decryptTotpSecret(user.mfaSecret), mfaCode))) throw createError('MFA_REQUIRED_OR_INVALID', 401);
    if (user.role === 'ADMIN' && !user.mfaEnabled) throw createError('ADMIN_MFA_REQUIRED', 403);
    return { user: this.publicUser(user), ...(await this.createSession(user, context, user.mfaEnabled)) };
  }

  private static async createSession(user: any, context: { ipAddress: string; userAgent: string }, privileged: boolean) {
    const sid = crypto.randomUUID();
    const token = jwt.sign({ id: user.id, organizationId: user.organizationId, sid, tokenVersion: user.tokenVersion, privileged, type: 'access' }, secret(), { expiresIn: '15m', issuer, audience });
    await prisma.userSession.create({ data: {
      sessionId: sid,
      userId: user.id,
      refreshTokenHash: digest(crypto.randomBytes(32).toString('hex')),
      privilegedAt: privileged ? new Date() : null,
      ipAddress: context.ipAddress.slice(0, 128),
      userAgent: context.userAgent.slice(0, 512),
      expiresAt: new Date(Date.now() + 8 * 3_600_000),
    } });
    return { token, sessionId: sid };
  }

  static async authenticate(token: string) {
    const claims = jwt.verify(token, secret(), { issuer, audience }) as SessionClaims;
    if (claims.type !== 'access') return null;
    const session = await prisma.userSession.findFirst({ where: { sessionId: claims.sid, userId: claims.id, revokedAt: null, expiresAt: { gt: new Date() } }, include: { user: true } });
    if (!session?.user.isActive || session.user.organizationId !== claims.organizationId || session.user.tokenVersion !== claims.tokenVersion) return null;
    if (session.lastSeenAt < new Date(Date.now() - 30 * 60_000)) {
      await prisma.userSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
      return null;
    }
    await prisma.userSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
    return { id: session.user.id, email: session.user.email, role: session.user.role, organizationId: session.user.organizationId, sessionId: session.sessionId, privileged: Boolean(session.privilegedAt && session.privilegedAt > new Date(Date.now() - 15 * 60_000)) };
  }

  static async logout(userId: string, sessionId: string) {
    await prisma.userSession.updateMany({ where: { userId, sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  static async beginMfaEnrollment(userId: string) {
    const user = await prisma.user.findFirst({ where: { id: userId, isActive: true } });
    if (!user) throw createError('User not found', 404);
    const totpSecret = generateTotpSecret();
    await prisma.user.update({ where: { id: user.id }, data: { mfaSecret: encryptTotpSecret(totpSecret), mfaEnabled: false } });
    const label = encodeURIComponent(`Signing Workflow:${user.email}`);
    const issuerName = encodeURIComponent('Signing Workflow');
    return { secret: totpSecret, otpauthUri: `otpauth://totp/${label}?secret=${totpSecret}&issuer=${issuerName}&algorithm=SHA1&digits=6&period=30` };
  }

  static async confirmMfaEnrollment(userId: string, sessionId: string, code: string) {
    const user = await prisma.user.findFirst({ where: { id: userId, isActive: true } });
    if (!user?.mfaSecret || !verifyTotp(decryptTotpSecret(user.mfaSecret), code)) throw createError('MFA_CODE_INVALID', 400);
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { mfaEnabled: true } }),
      prisma.userSession.updateMany({ where: { userId, sessionId, revokedAt: null }, data: { privilegedAt: new Date() } }),
    ]);
    return { mfaEnabled: true };
  }

  static async stepUp(userId: string, sessionId: string, code: string) {
    const user = await prisma.user.findFirst({ where: { id: userId, isActive: true, mfaEnabled: true } });
    if (!user?.mfaSecret || !verifyTotp(decryptTotpSecret(user.mfaSecret), code)) throw createError('MFA_CODE_INVALID', 400);
    const updated = await prisma.userSession.updateMany({ where: { userId, sessionId, revokedAt: null, expiresAt: { gt: new Date() } }, data: { privilegedAt: new Date() } });
    if (!updated.count) throw createError('SESSION_REVOKED', 401);
    return { privilegedUntil: new Date(Date.now() + 15 * 60_000).toISOString() };
  }

  static async disableMfa(userId: string, password: string, code: string) {
    const user = await prisma.user.findFirst({ where: { id: userId, isActive: true, mfaEnabled: true } });
    if (!user?.mfaSecret || !await bcrypt.compare(password, user.password) || !verifyTotp(decryptTotpSecret(user.mfaSecret), code)) throw createError('PASSWORD_OR_MFA_CODE_INVALID', 400);
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { mfaEnabled: false, mfaSecret: null, tokenVersion: { increment: 1 } } }),
      prisma.userSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    return { mfaEnabled: false, reauthenticationRequired: true };
  }

  static async resetPassword(emailInput: string) {
    const user = await prisma.user.findUnique({ where: { email: emailInput.trim().toLowerCase() } });
    if (user?.isActive) {
      const token = crypto.randomBytes(32).toString('base64url');
      await prisma.user.update({ where: { id: user.id }, data: { resetPasswordTokenHash: digest(token), resetPasswordExpires: new Date(Date.now() + 3_600_000) } });
      await EmailService.sendPasswordReset({ to: user.email, firstName: user.firstName, token });
    }
    return { message: 'If an account with that email exists, a reset link has been sent.' };
  }

  static async confirmResetPassword(token: string, newPassword: string) {
    const user = await prisma.user.findFirst({ where: { resetPasswordTokenHash: digest(token), resetPasswordExpires: { gt: new Date() }, isActive: true } });
    if (!user) throw createError('Invalid or expired reset token', 400);
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { password: await bcrypt.hash(newPassword, 12), resetPasswordTokenHash: null, resetPasswordExpires: null, tokenVersion: { increment: 1 } } }),
      prisma.userSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    return { message: 'Password reset successfully' };
  }

  static async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !await bcrypt.compare(currentPassword, user.password)) throw createError('Current password is incorrect', 400);
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { password: await bcrypt.hash(newPassword, 12), tokenVersion: { increment: 1 } } }),
      prisma.userSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    return { message: 'Password changed successfully' };
  }

  static async verifyEmail(token: string) {
    const user = await prisma.user.findFirst({ where: { emailVerifyTokenHash: digest(token), isActive: true } });
    if (!user) throw createError('Invalid verification token', 400);
    await prisma.user.update({ where: { id: user.id }, data: { isEmailVerified: true, emailVerifyTokenHash: null } });
    return { message: 'Email verified successfully' };
  }

  static async resendVerificationEmail(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw createError('User not found', 404);
    if (user.isEmailVerified) return { message: 'Email already verified' };
    const token = crypto.randomBytes(32).toString('base64url');
    await prisma.user.update({ where: { id: user.id }, data: { emailVerifyTokenHash: digest(token) } });
    await EmailService.sendVerification({ to: user.email, firstName: user.firstName, token });
    return { message: 'Verification email sent' };
  }

  static async getProfile(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { _count: { select: { sentDocuments: true, signatures: true, templates: true, matterMemberships: true } } } });
    if (!user) throw createError('User not found', 404);
    return { ...this.publicUser(user), createdAt: user.createdAt, updatedAt: user.updatedAt, _count: user._count };
  }

  static async updateProfile(userId: string, data: { firstName?: string; lastName?: string }) {
    const user = await prisma.user.update({ where: { id: userId }, data, select: { id: true, email: true, firstName: true, lastName: true, role: true, organizationId: true, isEmailVerified: true, createdAt: true, updatedAt: true } });
    return user;
  }

  private static publicUser(user: any) {
    return { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, organizationId: user.organizationId, isEmailVerified: user.isEmailVerified, mfaEnabled: user.mfaEnabled };
  }
}
