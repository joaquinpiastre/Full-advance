import { Router, Response } from 'express';
import { pool } from '../db/client';
import { authMiddleware, adminOSupervisor, AuthRequest } from '../middleware/auth';

const router = Router();

const VALORES = ['excelente', 'bueno', 'regular', 'malo', 'muy_malo'];

// El supervisor califica, al final de una visita de control, cómo el
// repartidor/preventista atiende a un cliente de su ruta.
router.post('/', authMiddleware, adminOSupervisor, async (req: AuthRequest, res: Response) => {
  const { evaluado_id, cliente_id, ruta_id, calificacion, comentario } = req.body;
  if (!evaluado_id || !calificacion) return res.status(400).json({ error: 'evaluado_id y calificacion son obligatorios' });
  if (!VALORES.includes(calificacion)) return res.status(400).json({ error: 'Calificación inválida' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO calificaciones_visita (supervisor_id, evaluado_id, cliente_id, ruta_id, calificacion, comentario)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.usuario!.id, evaluado_id, cliente_id ?? null, ruta_id ?? null, calificacion, comentario?.trim() || null]
    );
    res.status(201).json(rows[0]);
  } catch {
    res.status(500).json({ error: 'Error al guardar la calificación' });
  }
});

// Listado de calificaciones para admin/supervisor.
router.get('/', authMiddleware, adminOSupervisor, async (_req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT cv.*,
        s.nombre as supervisor_nombre,
        e.nombre as evaluado_nombre, e.rol as evaluado_rol,
        c.nombre as cliente_nombre, c.direccion as cliente_dir,
        r.nombre as ruta_nombre
      FROM calificaciones_visita cv
      JOIN usuarios s ON s.id = cv.supervisor_id
      JOIN usuarios e ON e.id = cv.evaluado_id
      LEFT JOIN clientes c ON c.id = cv.cliente_id
      LEFT JOIN rutas r ON r.id = cv.ruta_id
      ORDER BY cv.created_at DESC
      LIMIT 200
    `);
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Error' });
  }
});

export default router;
