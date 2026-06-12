import { Router, Request, Response } from 'express';
import { pool } from '../db/client';
import { authMiddleware, adminOSupervisor, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/departamentos', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT id, nombre FROM departamentos ORDER BY nombre');
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Error' });
  }
});

router.post('/departamentos', authMiddleware, adminOSupervisor, async (req: AuthRequest, res: Response) => {
  const nombre = req.body?.nombre?.trim();
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO departamentos (nombre) VALUES ($1)
       ON CONFLICT (nombre) DO UPDATE SET nombre=EXCLUDED.nombre
       RETURNING id, nombre`,
      [nombre]
    );
    res.status(201).json(rows[0]);
  } catch {
    res.status(500).json({ error: 'Error al crear departamento' });
  }
});

router.get('/distritos', authMiddleware, async (req: Request, res: Response) => {
  const { departamento_id } = req.query;
  try {
    const { rows } = departamento_id
      ? await pool.query(
          'SELECT id, nombre, departamento_id FROM distritos WHERE departamento_id=$1 ORDER BY nombre',
          [departamento_id]
        )
      : await pool.query('SELECT id, nombre, departamento_id FROM distritos ORDER BY nombre');
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Error' });
  }
});

router.post('/distritos', authMiddleware, adminOSupervisor, async (req: AuthRequest, res: Response) => {
  const nombre = req.body?.nombre?.trim();
  const departamento_id = req.body?.departamento_id ?? null;
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO distritos (nombre, departamento_id) VALUES ($1, $2)
       ON CONFLICT (nombre, departamento_id) DO UPDATE SET nombre=EXCLUDED.nombre
       RETURNING id, nombre, departamento_id`,
      [nombre, departamento_id]
    );
    res.status(201).json(rows[0]);
  } catch {
    res.status(500).json({ error: 'Error al crear distrito' });
  }
});

export default router;
