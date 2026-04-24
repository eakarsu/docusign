import express from 'express';
import Joi from 'joi';
import { AuthService } from '../services/authService';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = express.Router();

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  role: Joi.string().valid('ADMIN', 'SENDER', 'SIGNER', 'VIEWER').optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// Register
router.post('/register', async (req, res, next) => {
  try {
    const { error } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    const result = await AuthService.register(req.body);
    return res.status(201).json(result);
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
    const { email, password } = req.body;
    const result = await AuthService.login(email, password);
    return res.json(result);
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
router.post('/logout', authenticate, (req: any, res) => {
  // JWT is stateless; client removes the token.
  // Log the logout action for audit trail.
  return res.json({ message: 'Logged out successfully' });
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
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
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
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
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
    const { firstName, lastName, email } = req.body;
    const updateData: any = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (email) updateData.email = email;

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
