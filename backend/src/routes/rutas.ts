import { Router, Request, Response } from 'express';
import { pool } from '../db/client';
import { authMiddleware, soloAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const { rows: rutas } = await pool.query('SELECT * FROM rutas WHERE activa=true ORDER BY nombre');
    const { rows: rc } = await pool.query(
      `SELECT rc.*, c.nombre as cliente_nombre, c.direccion, c.lat, c.lng, c.telefono
       FROM ruta_clientes rc JOIN clientes c ON c.id=rc.cliente_id ORDER BY rc.ruta_id, rc.orden`
    );
    const result = rutas.map((r) => ({
      ...r,
      clientes: rc.filter((x) => x.ruta_id === r.id).map((x) => ({
        id: x.id,
        ruta_id: x.ruta_id,
        cliente_id: x.cliente_id,
        orden: x.orden,
        cliente: { id: x.cliente_id, nombre: x.cliente_nombre, direccion: x.direccion, lat: x.lat, lng: x.lng, telefono: x.telefono },
      })),
    }));
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Error' });
  }
});

router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const { rows: ruta } = await pool.query('SELECT * FROM rutas WHERE id=$1', [id]);
    if (!ruta.length) return res.status(404).json({ error: 'No encontrada' });
    const { rows: rc } = await pool.query(
      `SELECT rc.*, c.nombre as cliente_nombre, c.direccion, c.lat, c.lng
       FROM ruta_clientes rc JOIN clientes c ON c.id=rc.cliente_id
       WHERE rc.ruta_id=$1 ORDER BY rc.orden`,
      [id]
    );
    res.json({ ...ruta[0], clientes: rc.map((x) => ({ ...x, cliente: { id: x.cliente_id, nombre: x.cliente_nombre, direccion: x.direccion } })) });
  } catch {
    res.status(500).json({ error: 'Error' });
  }
});

router.post('/', authMiddleware, soloAdmin, async (req: AuthRequest, res: Response) => {
  const { nombre, descripcion, clientes } = req.body;
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'INSERT INTO rutas (nombre, descripcion) VALUES ($1,$2) RETURNING *',
      [nombre, descripcion ?? null]
    );
    const ruta = rows[0];
    if (clientes?.length) {
      for (let i = 0; i < clientes.length; i++) {
        await client.query(
          'INSERT INTO ruta_clientes (ruta_id, cliente_id, orden) VALUES ($1,$2,$3)',
          [ruta.id, clientes[i], i + 1]
        );
      }
    }
    await client.query('COMMIT');
    res.status(201).json(ruta);
  } catch {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Error al crear ruta' });
  } finally {
    client.release();
  }
});

export default router;
