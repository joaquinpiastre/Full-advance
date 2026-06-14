import { Router, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import { pool } from '../db/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = process.env.UPLOADS_DIR ?? './uploads';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Usuarios a los que se les puede asignar una tarea (repartidores y preventistas).
router.get('/usuarios', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, nombre, rol FROM usuarios
       WHERE activo=true AND rol IN ('repartidor','preventista') AND id != $1
       ORDER BY nombre`,
      [req.usuario!.id]
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Error' });
  }
});

// Tareas asignadas a mí.
router.get('/asignadas', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.*, u.nombre as autor_nombre, u.rol as autor_rol
       FROM tareas t JOIN usuarios u ON u.id=t.autor_id
       WHERE t.asignado_id=$1
       ORDER BY t.completada ASC, t.created_at DESC`,
      [req.usuario!.id]
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Error' });
  }
});

// Tareas que yo asigné, con su estado.
router.get('/creadas', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.*, u.nombre as asignado_nombre, u.rol as asignado_rol
       FROM tareas t JOIN usuarios u ON u.id=t.asignado_id
       WHERE t.autor_id=$1
       ORDER BY t.created_at DESC`,
      [req.usuario!.id]
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Error' });
  }
});

// Todas las tareas (admin/supervisor), para la sección de alertas.
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (req.usuario?.rol !== 'admin' && req.usuario?.rol !== 'supervisor') {
    return res.status(403).json({ error: 'Solo administradores o supervisores' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT t.*,
        a.nombre as autor_nombre, a.rol as autor_rol,
        u.nombre as asignado_nombre, u.rol as asignado_rol
       FROM tareas t
       JOIN usuarios a ON a.id=t.autor_id
       JOIN usuarios u ON u.id=t.asignado_id
       ORDER BY t.created_at DESC`
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Error' });
  }
});

// Asignar una tarea a un repartidor o preventista.
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { asignado_id, mensaje } = req.body;
  if (!asignado_id || !mensaje?.trim()) return res.status(400).json({ error: 'Destinatario y mensaje son obligatorios' });
  if (Number(asignado_id) === req.usuario!.id) return res.status(400).json({ error: 'No podés asignarte una tarea a vos mismo' });
  try {
    const { rows: destRows } = await pool.query(
      `SELECT id, nombre, rol FROM usuarios WHERE id=$1 AND activo=true AND rol IN ('repartidor','preventista')`,
      [asignado_id]
    );
    if (!destRows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    const { rows } = await pool.query(
      `INSERT INTO tareas (autor_id, asignado_id, mensaje) VALUES ($1,$2,$3) RETURNING *`,
      [req.usuario!.id, asignado_id, mensaje.trim()]
    );
    res.status(201).json({
      ...rows[0],
      autor_nombre: req.usuario!.nombre, autor_rol: req.usuario!.rol,
      asignado_nombre: destRows[0].nombre, asignado_rol: destRows[0].rol,
    });
  } catch {
    res.status(500).json({ error: 'Error al asignar la tarea' });
  }
});

// Marcar una tarea propia como realizada, con foto y nota opcionales como evidencia.
router.patch('/:id/completar', authMiddleware, upload.single('foto'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { nota } = req.body;
  const foto_uri = req.file ? `/uploads/${req.file.filename}` : null;
  try {
    const { rows } = await pool.query(
      `UPDATE tareas SET completada=true, completada_at=NOW(),
        nota_completada=$1, foto_uri=COALESCE($2, foto_uri)
       WHERE id=$3 AND asignado_id=$4 RETURNING *`,
      [nota?.trim() || null, foto_uri, id, req.usuario!.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Tarea no encontrada' });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: 'Error' });
  }
});

export default router;
