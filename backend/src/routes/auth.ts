import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db/client';
import { authMiddleware, soloAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });
  try {
    const { rows } = await pool.query('SELECT * FROM usuarios WHERE email = $1 AND activo = true', [email]);
    if (!rows.length) return res.status(401).json({ error: 'Credenciales inválidas' });
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });
    const token = jwt.sign(
      { id: user.id, rol: user.rol, nombre: user.nombre },
      process.env.JWT_SECRET!,
      { expiresIn: '30d' }
    );
    res.json({ token, usuario: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol } });
  } catch (e) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.post('/usuarios', authMiddleware, soloAdmin, async (req: AuthRequest, res: Response) => {
  const { nombre, email, password, rol } = req.body;
  if (!nombre || !email || !password || !rol) return res.status(400).json({ error: 'Todos los campos son requeridos' });
  if (!['repartidor', 'preventista', 'admin'].includes(rol)) return res.status(400).json({ error: 'Rol inválido' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES ($1, $2, $3, $4) RETURNING id, nombre, email, rol',
      [nombre, email, hash, rol]
    );
    res.status(201).json(rows[0]);
  } catch (e: any) {
    if (e.code === '23505') return res.status(400).json({ error: 'El email ya está registrado' });
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.get('/usuarios', authMiddleware, soloAdmin, async (_req: Request, res: Response) => {
  const { rows } = await pool.query('SELECT id, nombre, email, rol, activo FROM usuarios ORDER BY nombre');
  res.json(rows);
});

export default router;
