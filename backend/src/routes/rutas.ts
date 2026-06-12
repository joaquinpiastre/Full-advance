import { Router, Request, Response } from 'express';
import { pool } from '../db/client';
import { authMiddleware, soloAdmin, adminOSupervisor, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const { rows: rutas } = await pool.query('SELECT * FROM rutas WHERE activa=true ORDER BY nombre');
    const { rows: rc } = await pool.query(
      `SELECT rc.*,
        c.nombre as cliente_nombre, c.direccion, c.lat, c.lng, c.telefono, c.notas,
        c.categoria, c.razon_social, c.cuit, c.rubro, c.email, c.contacto_nombre, c.horario_atencion,
        c.monto_compra_promedio, c.frecuencia_compra, c.forma_pago, c.dia_visita_preferido, c.cartilla_actualizada_at,
        c.zona, c.departamento
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
          zona: x.zona, departamento: x.departamento,
        },
      })),
    }));
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Error' });
  }
});

// Historial de clientes quitados de rutas (alertas para admin/supervisor)
router.get('/eliminaciones', authMiddleware, adminOSupervisor, async (_req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT e.id, e.nota, e.created_at,
        r.id as ruta_id, r.nombre as ruta_nombre,
        c.id as cliente_id, c.nombre as cliente_nombre, c.direccion as cliente_dir,
        u.id as usuario_id, u.nombre as usuario_nombre, u.rol as usuario_rol
      FROM eliminaciones_ruta_cliente e
      LEFT JOIN rutas r ON r.id = e.ruta_id
      LEFT JOIN clientes c ON c.id = e.cliente_id
      LEFT JOIN usuarios u ON u.id = e.usuario_id
      ORDER BY e.created_at DESC
    `);
    res.json(rows.map((r) => ({
      id: r.id,
      nota: r.nota,
      created_at: r.created_at,
      ruta: { id: r.ruta_id, nombre: r.ruta_nombre },
      cliente: { id: r.cliente_id, nombre: r.cliente_nombre, direccion: r.cliente_dir },
      usuario: { id: r.usuario_id, nombre: r.usuario_nombre, rol: r.usuario_rol },
    })));
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
        c.monto_compra_promedio, c.frecuencia_compra, c.forma_pago, c.dia_visita_preferido, c.cartilla_actualizada_at,
        c.zona, c.departamento
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
          zona: x.zona, departamento: x.departamento,
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

// Reordenar los clientes de una ruta (cualquier usuario autenticado: cada
// repartidor/preventista/supervisor elige el orden en que visita su ruta).
router.put('/:id/orden', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { clientes } = req.body;
  if (!Array.isArray(clientes) || !clientes.length) return res.status(400).json({ error: 'clientes requerido' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < clientes.length; i++) {
      await client.query(
        'UPDATE ruta_clientes SET orden=$1 WHERE ruta_id=$2 AND cliente_id=$3',
        [i + 1, id, clientes[i]]
      );
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Error al actualizar el orden' });
  } finally {
    client.release();
  }
});

// Quitar un cliente de la ruta (no lo elimina de la base de clientes).
// Requiere una nota explicando el motivo, que queda registrada como alerta.
router.delete('/:id/clientes/:clienteId', authMiddleware, soloAdmin, async (req: AuthRequest, res: Response) => {
  const { id, clienteId } = req.params;
  const { nota } = req.body;
  if (!nota || !String(nota).trim()) return res.status(400).json({ error: 'La nota es obligatoria' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'DELETE FROM ruta_clientes WHERE ruta_id=$1 AND cliente_id=$2 RETURNING id',
      [id, clienteId]
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'El cliente no está en esa ruta' });
    }
    await client.query(
      'INSERT INTO eliminaciones_ruta_cliente (ruta_id, cliente_id, usuario_id, nota) VALUES ($1,$2,$3,$4)',
      [id, clienteId, req.usuario?.id, String(nota).trim()]
    );
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Error al quitar el cliente de la ruta' });
  } finally {
    client.release();
  }
});

router.delete('/:id', authMiddleware, soloAdmin, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query('UPDATE rutas SET activa=false WHERE id=$1 RETURNING id', [id]);
    if (!rows.length) return res.status(404).json({ error: 'No encontrada' });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Error al eliminar ruta' });
  }
});

export default router;
