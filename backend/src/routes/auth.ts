import express from 'express';
import Joi from 'joi';
import { AuthService } from '../services/authService';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = express.Router();

const registerSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required(),
  password: Joi.string().min(12).max(128).required(),
  firstName: Joi.string().trim().min(1).max(100).required(),
  lastName: Joi.string().trim().min(1).max(100).required(),
  invitationToken: Joi.string().min(32).max(256).optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required(),
  password: Joi.string().required(),
  mfaCode: Joi.string().pattern(/^\d{6}$/).optional()
});

const cookie = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, maxAge: 15 * 60 * 1000, path: '/' };
const context = (req: express.Request) => ({ ipAddress: req.ip || req.socket.remoteAddress || 'unknown', userAgent: String(req.get('User-Agent') || 'unknown') });

// Register
router.post('/register', async (req, res, next) => {
  try {
    const { error } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    const result = await AuthService.register(req.body, context(req));
    const { token, sessionId: _sessionId, ...body } = result as any;
    if (token) res.cookie('accessToken', token, cookie);
    return res.status(201).json(body);
  } catch (error) {
    return next(error);
  }
});

// Login
router.post('/login', async (req, res, next) => {
  try {
    const { error } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    const { email, password, mfaCode } = req.body;
    const result = await AuthService.login(email, password, context(req), mfaCode);
    const { token, sessionId: _sessionId, ...body } = result;
    res.cookie('accessToken', token, cookie);
    return res.json(body);
  } catch (error) {
    return next(error);
  }
});

// Get current user profile
router.get('/me', authenticate, async (req: any, res, next) => {
  try {
    const profile = await AuthService.getProfile(req.user.id);
    return res.json({ user: profile });
  } catch (error) {
    return next(error);
  }
});

// Logout
router.post('/logout', authenticate, async (req: AuthRequest, res) => {
  await AuthService.logout(req.user!.id, req.user!.sessionId);
  res.clearCookie('accessToken', cookie);
  return res.json({ message: 'Logged out successfully' });
});

router.post('/mfa/enroll', authenticate, async (req: AuthRequest, res, next) => {
  try { return res.json(await AuthService.beginMfaEnrollment(req.user!.id)); }
  catch (error) { return next(error); }
});

router.post('/mfa/confirm', authenticate, async (req: AuthRequest, res, next) => {
  try {
    if (!/^\d{6}$/.test(String(req.body.code || ''))) return res.status(400).json({ error: 'Six-digit code required' });
    return res.json(await AuthService.confirmMfaEnrollment(req.user!.id, req.user!.sessionId, req.body.code));
  } catch (error) { return next(error); }
});

router.post('/mfa/step-up', authenticate, async (req: AuthRequest, res, next) => {
  try {
    if (!/^\d{6}$/.test(String(req.body.code || ''))) return res.status(400).json({ error: 'Six-digit code required' });
    return res.json(await AuthService.stepUp(req.user!.id, req.user!.sessionId, req.body.code));
  } catch (error) { return next(error); }
});

router.post('/mfa/disable', authenticate, async (req: AuthRequest, res, next) => {
  try {
    if (!req.body.password || !/^\d{6}$/.test(String(req.body.code || ''))) return res.status(400).json({ error: 'Password and six-digit code required' });
    const result = await AuthService.disableMfa(req.user!.id, req.body.password, req.body.code);
    res.clearCookie('accessToken', cookie);
    return res.json(result);
  } catch (error) { return next(error); }
});

// Request password reset
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    const result = await AuthService.resetPassword(email);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

// Confirm password reset with token
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }
    if (newPassword.length < 12 || newPassword.length > 128) {
      return res.status(400).json({ error: 'Password must be 12 to 128 characters' });
    }
    const result = await AuthService.confirmResetPassword(token, newPassword);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

// Change password (authenticated)
router.post('/change-password', authenticate, async (req: any, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }
    if (newPassword.length < 12 || newPassword.length > 128) {
      return res.status(400).json({ error: 'New password must be 12 to 128 characters' });
    }
    const result = await AuthService.changePassword(req.user.id, currentPassword, newPassword);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

// Verify email
router.get('/verify-email/:token', async (req, res, next) => {
  try {
    const { token } = req.params;
    const result = await AuthService.verifyEmail(token);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

// Resend verification email
router.post('/resend-verification', authenticate, async (req: any, res, next) => {
  try {
    const result = await AuthService.resendVerificationEmail(req.user.id);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

// Update profile
router.put('/profile', authenticate, async (req: any, res, next) => {
  try {
    const { firstName, lastName } = req.body;
    const updateData: any = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const result = await AuthService.updateProfile(req.user.id, updateData);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

export default router;
