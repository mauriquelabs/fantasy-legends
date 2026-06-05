import type { Request, Response, NextFunction } from 'express';
import { supabaseAdmin as supabase } from '../supabaseAdmin.js';
import { logger } from '../lib/logger.js';

export interface AuthenticatedRequest extends Request {
  user: { id: string; email: string };
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const match = req.headers.authorization?.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user?.email) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    (req as AuthenticatedRequest).user = { id: user.id, email: user.email };
    next();
  } catch (err) {
    logger.error({ err }, 'Auth service error');
    return res.status(503).json({ error: 'Authentication service unavailable' });
  }
}
