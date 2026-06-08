import { Router, Response } from 'express';
import { pool } from '../db/client';
import { authMiddleware, soloAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/hoy', authMiddleware, async (req: AuthRequest, res: Response) => {
  const usuario_id = req.usuario!.id;
  const hoy = new Date().toISOString().split('T')[0];
  try {
    const { rows } = await pool.query(
      `SELECT a.*, r.nombre as ruta_nombre, r.descripcion as ruta_desc
       FROM asignaciones a JOIN rutas r ON r.id=a.ruta_id
       WHERE a.usuario_id=$1 AND a.fecha=$2 LIMIT 1`,
      [usuario_id, hoy]
    );
    if (!rows.length) return res.json(null);
    const asig = rows[0];
    const { rows: rc } = await pool.query(
      `SELECT rc.*, c.nombre as cliente_nombre, c.direccion, c.lat, c.lng, c.telefono
       FROM ruta_clientes rc JOIN clientes c ON c.id=rc.cliente_id
       WHERE rc.ruta_id=$1 ORDER BY rc.orden`,
      [asig.ruta_id]
    );
    res.json({
      ...asig,
      ruta: {
        id: asig.ruta_id,
        nombre: asig.ruta_nombre,
        descripcion: asig.ruta_desc,
        clientes: rc.map((x) => ({
          id: x.id,
          cliente_id: x.cliente_id,
          orden: x.orden,
          cliente: { id: x.cliente_id, nombre: x.cliente_nombre, direccion: x.direccion, lat: x.lat, lng: x.lng, telefono: x.telefono },
        })),
      },
    });
  } catch {
    res.status(500).json({ error: 'Error' });
  }
});

router.get('/', authMiddleware, soloAdmin, async (_req: AuthRequest, res: Response) => {
  const hoy = new Date().toISOString().split('T')[0];
  try {
    const { rows: asignaciones } = await pool.query(
      `SELECT a.*, u.nombre as usuario_nombre, u.rol as usuario_rol, r.nombre as ruta_nombre
       FROM asignaciones a
       JOIN usuarios u ON u.id=a.usuario_id
       JOIN rutas r ON r.id=a.ruta_id
       WHERE a.fecha >= $1::date - interval '7 days'
       ORDER BY a.fecha DESC, u.nombre`,
      [hoy]
    );
    const { rows: usuarios } = await pool.query(
      "SELECT id, nombre, rol FROM usuarios WHERE activo=true AND rol != 'admin' ORDER BY nombre"
    );
    const mapped = asignaciones.map((a) => ({
      ...a,
      usuario: { id: a.usuario_id, nombre: a.usuario_nombre, rol: a.usuario_rol },
      ruta: { id: a.ruta_id, nombre: a.ruta_nombre },
    }));
    res.json({ asignaciones: mapped, usuarios });
  } catch {
    res.status(500).json({ error: 'Error' });
  }
});

router.post('/', authMiddleware, soloAdmin, async (req: AuthRequest, res: Response) => {
  const { usuario_id, ruta_id, fecha } = req.body;
  if (!usuario_id || !ruta_id || !fecha) return res.status(400).json({ error: 'Todos los campos requeridos' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO asignaciones (usuario_id, ruta_id, fecha) VALUES ($1,$2,$3)
       ON CONFLICT (usuario_id, fecha) DO UPDATE SET ruta_id=$2 RETURNING *`,
      [usuario_id, ruta_id, fecha]
    );
    res.status(201).json(rows[0]);
  } catch {
    res.status(500).json({ error: 'Error al asignar' });
  }
});

export default router;
