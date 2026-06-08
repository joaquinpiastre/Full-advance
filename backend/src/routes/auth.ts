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
  const { nombre, email, password, rol, horario_preferido } = req.body;
  if (!nombre || !email || !password || !rol) return res.status(400).json({ error: 'Todos los campos son requeridos' });
  if (!['repartidor', 'preventista', 'admin'].includes(rol)) return res.status(400).json({ error: 'Rol inválido' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO usuarios (nombre, email, password_hash, rol, horario_preferido) VALUES ($1, $2, $3, $4, $5) RETURNING id, nombre, email, rol, horario_preferido',
      [nombre, email, hash, rol, horario_preferido?.trim() || null]
    );
    res.status(201).json(rows[0]);
  } catch (e: any) {
    if (e.code === '23505') return res.status(400).json({ error: 'El email ya está registrado' });
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.put('/usuarios/:id', authMiddleware, soloAdmin, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { nombre, email, rol, horario_preferido, password } = req.body;
  if (!nombre || !email || !rol) return res.status(400).json({ error: 'Nombre, email y rol son requeridos' });
  if (!['repartidor', 'preventista', 'admin'].includes(rol)) return res.status(400).json({ error: 'Rol inválido' });
  try {
    let result;
    if (password && password.trim()) {
      const hash = await bcrypt.hash(password, 10);
      result = await pool.query(
        `UPDATE usuarios SET nombre=$1, email=$2, rol=$3, horario_preferido=$4, password_hash=$5
         WHERE id=$6 RETURNING id, nombre, email, rol, activo, horario_preferido`,
        [nombre, email, rol, horario_preferido?.trim() || null, hash, id]
      );
    } else {
      result = await pool.query(
        `UPDATE usuarios SET nombre=$1, email=$2, rol=$3, horario_preferido=$4
         WHERE id=$5 RETURNING id, nombre, email, rol, activo, horario_preferido`,
        [nombre, email, rol, horario_preferido?.trim() || null, id]
      );
    }
    if (!result.rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(result.rows[0]);
  } catch (e: any) {
    if (e.code === '23505') return res.status(400).json({ error: 'El email ya está registrado' });
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.get('/usuarios', authMiddleware, soloAdmin, async (_req: Request, res: Response) => {
  const { rows } = await pool.query('SELECT id, nombre, email, rol, activo, horario_preferido FROM usuarios ORDER BY nombre');
  res.json(rows);
});

export default router;
