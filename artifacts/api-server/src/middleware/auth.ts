import type { Request, Response, NextFunction } from 'express';
import { supabaseAdmin as supabase } from '../supabaseAdmin.js';

export interface AuthenticatedRequest extends Request {
  user: { id: string; email: string };
}

export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    const { data: { user } } = await supabase.auth.getUser(token);
    if (user?.email) {
      (req as AuthenticatedRequest).user = { id: user.id, email: user.email };
    }
  }
  next();
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user?.email) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  (req as AuthenticatedRequest).user = { id: user.id, email: user.email };
  next();
}
