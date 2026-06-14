import { Router, Response } from 'express';
import { pool } from '../db/client';
import { authMiddleware, soloAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

router.post('/iniciar', authMiddleware, async (req: AuthRequest, res: Response) => {
  const usuario_id = req.usuario!.id;
  try {
    const activa = await pool.query('SELECT id FROM jornadas WHERE usuario_id=$1 AND activa=true', [usuario_id]);
    if (activa.rows.length) return res.status(400).json({ error: 'Ya hay una jornada activa' });
    const { rows } = await pool.query(
      'INSERT INTO jornadas (usuario_id) VALUES ($1) RETURNING *',
      [usuario_id]
    );
    res.status(201).json(rows[0]);
  } catch {
    res.status(500).json({ error: 'Error al iniciar jornada' });
  }
});

router.post('/:id/finalizar', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const usuario_id = req.usuario!.id;
  try {
    const { rows } = await pool.query(
      `UPDATE jornadas SET activa=false, fecha_fin=NOW()
       WHERE id=$1 AND usuario_id=$2 AND activa=true RETURNING *`,
      [id, usuario_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Jornada no encontrada' });
    await pool.query('DELETE FROM gps_live WHERE usuario_id=$1', [usuario_id]);
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: 'Error al finalizar jornada' });
  }
});

router.get('/activa', authMiddleware, async (req: AuthRequest, res: Response) => {
  const usuario_id = req.usuario!.id;
  try {
    const { rows } = await pool.query(
      'SELECT * FROM jornadas WHERE usuario_id=$1 AND activa=true LIMIT 1',
      [usuario_id]
    );
    res.json(rows[0] ?? null);
  } catch {
    res.status(500).json({ error: 'Error' });
  }
});

router.get('/historial', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { usuario_id } = req.query;
  const isAdmin = req.usuario!.rol === 'admin';
  try {
    let query = `
      SELECT j.*, u.nombre as usuario_nombre, u.rol as usuario_rol,
             COUNT(p.id)::int as total_paradas,
             ruta.ruta_id, ruta.ruta_nombre
      FROM jornadas j
      JOIN usuarios u ON u.id = j.usuario_id
      LEFT JOIN paradas p ON p.jornada_id = j.id AND p.completada = true
      LEFT JOIN LATERAL (
        SELECT rc.ruta_id, r.nombre as ruta_nombre
        FROM paradas p2
        JOIN ruta_clientes rc ON rc.cliente_id = p2.cliente_id
        JOIN rutas r ON r.id = rc.ruta_id
        WHERE p2.jornada_id = j.id
        GROUP BY rc.ruta_id, r.nombre
        ORDER BY COUNT(*) DESC
        LIMIT 1
      ) ruta ON true
    `;
    const params: any[] = [];
    if (!isAdmin) {
      params.push(req.usuario!.id);
      query += ` WHERE j.usuario_id = $${params.length}`;
    } else if (usuario_id) {
      params.push(usuario_id);
      query += ` WHERE j.usuario_id = $${params.length}`;
    }
    query += ' GROUP BY j.id, u.nombre, u.rol, ruta.ruta_id, ruta.ruta_nombre ORDER BY j.fecha_inicio DESC LIMIT 100';
    const { rows } = await pool.query(query, params);
    const mapped = rows.map((r) => ({
      ...r,
      usuario: { id: r.usuario_id, nombre: r.usuario_nombre, rol: r.usuario_rol },
      ruta: r.ruta_id ? { id: r.ruta_id, nombre: r.ruta_nombre } : null,
    }));
    res.json(mapped);
  } catch {
    res.status(500).json({ error: 'Error' });
  }
});

router.get('/:id/detalle', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const jornadaRes = await pool.query(
      'SELECT j.*, u.nombre, u.rol FROM jornadas j JOIN usuarios u ON u.id=j.usuario_id WHERE j.id=$1',
      [id]
    );
    if (!jornadaRes.rows.length) return res.status(404).json({ error: 'No encontrada' });
    const jornada = jornadaRes.rows[0];

    const paradasRes = await pool.query(
      `SELECT p.*, c.nombre as cliente_nombre, c.direccion as cliente_dir
       FROM paradas p LEFT JOIN clientes c ON c.id=p.cliente_id
       WHERE p.jornada_id=$1 ORDER BY p.timestamp_llegada`,
      [id]
    );
    const paradas = paradasRes.rows.map((p) => ({
      ...p,
      cliente: p.cliente_id ? { id: p.cliente_id, nombre: p.cliente_nombre, direccion: p.cliente_dir } : null,
    }));

    const { rows: rutaRows } = await pool.query(
      `SELECT rc.ruta_id, r.nombre as ruta_nombre
       FROM paradas p JOIN ruta_clientes rc ON rc.cliente_id = p.cliente_id
       JOIN rutas r ON r.id = rc.ruta_id
       WHERE p.jornada_id=$1
       GROUP BY rc.ruta_id, r.nombre
       ORDER BY COUNT(*) DESC LIMIT 1`,
      [id]
    );
    const ruta = rutaRows.length ? { id: rutaRows[0].ruta_id, nombre: rutaRows[0].ruta_nombre } : null;

    res.json({
      ...jornada,
      usuario: { id: jornada.usuario_id, nombre: jornada.nombre, rol: jornada.rol },
      ruta,
      paradas,
    });
  } catch {
    res.status(500).json({ error: 'Error' });
  }
});

export default router;
