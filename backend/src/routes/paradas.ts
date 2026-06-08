import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
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

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { jornada_id, lat, lng, cliente_id } = req.body;
  if (!jornada_id || !lat || !lng) return res.status(400).json({ error: 'jornada_id, lat y lng requeridos' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO paradas (jornada_id, lat, lng, cliente_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [jornada_id, lat, lng, cliente_id ?? null]
    );
    const parada = rows[0];
    if (cliente_id) {
      const c = await pool.query('SELECT * FROM clientes WHERE id=$1', [cliente_id]);
      parada.cliente = c.rows[0] ?? null;
    }
    res.status(201).json(parada);
  } catch {
    res.status(500).json({ error: 'Error al registrar parada' });
  }
});

router.post('/:id/foto', authMiddleware, upload.single('foto'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { numero } = req.body;
  if (!req.file) return res.status(400).json({ error: 'Foto requerida' });
  if (!['1', '2'].includes(String(numero))) return res.status(400).json({ error: 'Número de foto inválido' });

  const campo = numero === '1' ? 'foto1_uri' : 'foto2_uri';
  const uri = `/uploads/${req.file.filename}`;
  try {
    await pool.query(`UPDATE paradas SET ${campo}=$1 WHERE id=$2`, [uri, id]);
    res.json({ uri });
  } catch {
    res.status(500).json({ error: 'Error al guardar foto' });
  }
});

router.post('/:id/finalizar', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { nota } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE paradas SET completada=true, timestamp_salida=NOW(), nota=$1 WHERE id=$2 RETURNING *`,
      [nota ?? null, id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Parada no encontrada' });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: 'Error al finalizar parada' });
  }
});

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { jornada_id } = req.query;
  if (!jornada_id) return res.status(400).json({ error: 'jornada_id requerido' });
  try {
    const { rows } = await pool.query(
      `SELECT p.*, c.nombre as cliente_nombre, c.direccion as cliente_dir, c.telefono
       FROM paradas p
       LEFT JOIN clientes c ON c.id = p.cliente_id
       WHERE p.jornada_id=$1 ORDER BY p.timestamp_llegada`,
      [jornada_id]
    );
    const paradas = rows.map((p) => ({
      ...p,
      cliente: p.cliente_id ? { id: p.cliente_id, nombre: p.cliente_nombre, direccion: p.cliente_dir } : null,
    }));
    res.json(paradas);
  } catch {
    res.status(500).json({ error: 'Error' });
  }
});

export default router;
