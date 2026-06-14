import { Router, Response } from 'express';
import { pool } from '../db/client';
import { authMiddleware, soloAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// Encuestas activas que aplican a una zona (o a todas, si no tienen zonas
// definidas). Las usa el preventista/supervisor al finalizar una visita.
router.get('/activas', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { departamento } = req.query;
  try {
    const { rows } = await pool.query(
      `SELECT * FROM encuestas
       WHERE activa = true
         AND (zonas IS NULL OR zonas = '{}' OR $1::text = ANY(zonas))
       ORDER BY created_at`,
      [departamento ?? null]
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Error al obtener encuestas' });
  }
});

// Todas las encuestas (gestión del admin).
router.get('/', authMiddleware, soloAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT * FROM encuestas ORDER BY created_at DESC');
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Error al obtener encuestas' });
  }
});

router.post('/', authMiddleware, soloAdmin, async (req: AuthRequest, res: Response) => {
  const { pregunta, zonas } = req.body;
  if (!pregunta?.trim()) return res.status(400).json({ error: 'La pregunta es obligatoria' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO encuestas (pregunta, zonas) VALUES ($1, $2) RETURNING *`,
      [pregunta.trim(), Array.isArray(zonas) && zonas.length ? zonas : null]
    );
    res.status(201).json(rows[0]);
  } catch {
    res.status(500).json({ error: 'Error al crear la encuesta' });
  }
});

router.put('/:id', authMiddleware, soloAdmin, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { pregunta, zonas, activa } = req.body;
  try {
    const { rows: actuales } = await pool.query('SELECT * FROM encuestas WHERE id=$1', [id]);
    if (!actuales.length) return res.status(404).json({ error: 'Encuesta no encontrada' });
    const actual = actuales[0];

    const nuevaPregunta = pregunta?.trim() || actual.pregunta;
    const nuevasZonas = zonas === undefined
      ? actual.zonas
      : (Array.isArray(zonas) && zonas.length ? zonas : null);
    const nuevaActiva = activa === undefined ? actual.activa : !!activa;

    const { rows } = await pool.query(
      `UPDATE encuestas SET pregunta=$1, zonas=$2, activa=$3 WHERE id=$4 RETURNING *`,
      [nuevaPregunta, nuevasZonas, nuevaActiva, id]
    );
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: 'Error al actualizar la encuesta' });
  }
});

router.delete('/:id', authMiddleware, soloAdmin, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM encuestas WHERE id=$1', [id]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Error al eliminar la encuesta' });
  }
});

export default router;
