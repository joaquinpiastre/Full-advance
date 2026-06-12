import { Router, Response } from 'express';
import { pool } from '../db/client';
import { authMiddleware, adminOSupervisor, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.*, u.nombre as autor_nombre, u.rol as autor_rol
       FROM anuncios a
       JOIN usuarios u ON u.id = a.autor_id
       ORDER BY a.created_at DESC`
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Error' });
  }
});

router.post('/', authMiddleware, adminOSupervisor, async (req: AuthRequest, res: Response) => {
  const { titulo, mensaje, tipo } = req.body;
  if (!mensaje?.trim()) return res.status(400).json({ error: 'El mensaje es obligatorio' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO anuncios (autor_id, titulo, mensaje, tipo) VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.usuario!.id, titulo?.trim() || null, mensaje.trim(), tipo === 'oferta' ? 'oferta' : 'info']
    );
    res.status(201).json({ ...rows[0], autor_nombre: req.usuario!.nombre, autor_rol: req.usuario!.rol });
  } catch {
    res.status(500).json({ error: 'Error al crear el anuncio' });
  }
});

router.delete('/:id', authMiddleware, adminOSupervisor, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM anuncios WHERE id=$1', [id]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Error' });
  }
});

export default router;
