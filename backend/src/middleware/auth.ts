import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  usuario?: { id: number; rol: string; nombre: string };
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    req.usuario = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }
};

export const soloAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.usuario?.rol !== 'admin') return res.status(403).json({ error: 'Solo administradores' });
  next();
};
