import { Router, Response } from 'express';
import { pool } from '../db/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.post('/update', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { lat, lng, jornada_id, velocidad } = req.body;
  const usuario_id = req.usuario!.id;
  if (!lat || !lng || !jornada_id) return res.status(400).json({ error: 'lat, lng y jornada_id requeridos' });
  try {
    await pool.query(
      'INSERT INTO gps_points (usuario_id, jornada_id, lat, lng, velocidad) VALUES ($1, $2, $3, $4, $5)',
      [usuario_id, jornada_id, lat, lng, velocidad ?? 0]
    );
    await pool.query(
      `INSERT INTO gps_live (usuario_id, lat, lng, velocidad, timestamp)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (usuario_id) DO UPDATE SET lat=$2, lng=$3, velocidad=$4, timestamp=NOW()`,
      [usuario_id, lat, lng, velocidad ?? 0]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Error al guardar GPS' });
  }
});

router.get('/live', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT gl.usuario_id, u.nombre, u.rol, gl.lat, gl.lng, gl.timestamp,
             (gl.timestamp > NOW() - INTERVAL '1 minute') AS activo
      FROM gps_live gl
      JOIN usuarios u ON u.id = gl.usuario_id
      WHERE gl.timestamp > NOW() - INTERVAL '5 minutes'
      ORDER BY u.nombre
    `);
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Error al obtener ubicaciones' });
  }
});

router.get('/historial/:jornada_id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { jornada_id } = req.params;
  try {
    const { rows } = await pool.query(
      'SELECT lat, lng, velocidad, timestamp FROM gps_points WHERE jornada_id=$1 ORDER BY timestamp',
      [jornada_id]
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Error al obtener historial GPS' });
  }
});

export default router;
