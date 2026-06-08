import { Router, Request, Response } from 'express';
import { pool } from '../db/client';
import { authMiddleware, soloAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const { rows: rutas } = await pool.query('SELECT * FROM rutas WHERE activa=true ORDER BY nombre');
    const { rows: rc } = await pool.query(
      `SELECT rc.*,
        c.nombre as cliente_nombre, c.direccion, c.lat, c.lng, c.telefono, c.notas,
        c.categoria, c.razon_social, c.cuit, c.rubro, c.email, c.contacto_nombre, c.horario_atencion,
        c.monto_compra_promedio, c.frecuencia_compra, c.forma_pago, c.dia_visita_preferido, c.cartilla_actualizada_at
       FROM ruta_clientes rc JOIN clientes c ON c.id=rc.cliente_id ORDER BY rc.ruta_id, rc.orden`
    );
    const result = rutas.map((r) => ({
      ...r,
      clientes: rc.filter((x) => x.ruta_id === r.id).map((x) => ({
        id: x.id,
        ruta_id: x.ruta_id,
        cliente_id: x.cliente_id,
        orden: x.orden,
        cliente: {
          id: x.cliente_id, nombre: x.cliente_nombre, direccion: x.direccion, lat: x.lat, lng: x.lng,
          telefono: x.telefono, notas: x.notas,
          categoria: x.categoria, razon_social: x.razon_social, cuit: x.cuit, rubro: x.rubro,
          email: x.email, contacto_nombre: x.contacto_nombre, horario_atencion: x.horario_atencion,
          monto_compra_promedio: x.monto_compra_promedio, frecuencia_compra: x.frecuencia_compra,
          forma_pago: x.forma_pago, dia_visita_preferido: x.dia_visita_preferido,
          cartilla_actualizada_at: x.cartilla_actualizada_at,
        },
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
      `SELECT rc.*,
        c.nombre as cliente_nombre, c.direccion, c.lat, c.lng, c.telefono, c.notas,
        c.categoria, c.razon_social, c.cuit, c.rubro, c.email, c.contacto_nombre, c.horario_atencion,
        c.monto_compra_promedio, c.frecuencia_compra, c.forma_pago, c.dia_visita_preferido, c.cartilla_actualizada_at
       FROM ruta_clientes rc JOIN clientes c ON c.id=rc.cliente_id
       WHERE rc.ruta_id=$1 ORDER BY rc.orden`,
      [id]
    );
    res.json({
      ...ruta[0],
      clientes: rc.map((x) => ({
        id: x.id,
        ruta_id: x.ruta_id,
        cliente_id: x.cliente_id,
        orden: x.orden,
        cliente: {
          id: x.cliente_id, nombre: x.cliente_nombre, direccion: x.direccion, lat: x.lat, lng: x.lng,
          telefono: x.telefono, notas: x.notas,
          categoria: x.categoria, razon_social: x.razon_social, cuit: x.cuit, rubro: x.rubro,
          email: x.email, contacto_nombre: x.contacto_nombre, horario_atencion: x.horario_atencion,
          monto_compra_promedio: x.monto_compra_promedio, frecuencia_compra: x.frecuencia_compra,
          forma_pago: x.forma_pago, dia_visita_preferido: x.dia_visita_preferido,
          cartilla_actualizada_at: x.cartilla_actualizada_at,
        },
      })),
    });
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

router.put('/:id', authMiddleware, soloAdmin, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { nombre, descripcion, clientes } = req.body;
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'UPDATE rutas SET nombre=$1, descripcion=$2 WHERE id=$3 RETURNING *',
      [nombre, descripcion ?? null, id]
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No encontrada' });
    }
    await client.query('DELETE FROM ruta_clientes WHERE ruta_id=$1', [id]);
    if (clientes?.length) {
      for (let i = 0; i < clientes.length; i++) {
        await client.query(
          'INSERT INTO ruta_clientes (ruta_id, cliente_id, orden) VALUES ($1,$2,$3)',
          [id, clientes[i], i + 1]
        );
      }
    }
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Error al actualizar ruta' });
  } finally {
    client.release();
  }
});

export default router;
