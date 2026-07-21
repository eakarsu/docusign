import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: 'ADMIN' | 'SENDER' | 'SIGNER' | 'VIEWER';
    organizationId: string;
    sessionId: string;
    privileged: boolean;
  };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const header = req.header('Authorization');
    const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    const token = bearer || req.cookies?.accessToken;
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const user = await AuthService.authenticate(token);
    if (!user) return res.status(401).json({ error: 'Invalid, expired, or revoked session' });
    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid, expired, or revoked session' });
  }
};

export const authorize = (roles: string[]) => (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Insufficient permissions' });
  return next();
};

export const requirePrivileged = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user?.privileged || req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Recent MFA-verified administrator session required' });
  const reason = req.header('X-Privileged-Reason');
  if (!reason || reason.trim().length < 10) return res.status(400).json({ error: 'X-Privileged-Reason (10+ characters) is required' });
  return next();
};
