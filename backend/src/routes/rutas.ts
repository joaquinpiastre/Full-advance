import { Router, Request, Response } from 'express';
import { pool } from '../db/client';
import { authMiddleware, soloAdmin, adminOSupervisor, gestionRutas, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const { rows: rutas } = await pool.query('SELECT * FROM rutas WHERE activa=true ORDER BY nombre');
    // row_to_json(c) devuelve el cliente COMPLETO. Antes se listaban las
    // columnas a mano y las que faltaban (marcas, tipo_comercio,
    // material_exhibicion, numero_cliente, foto_referencia_uri) llegaban vacías
    // a la app: al guardar la cartilla desde la ruta, esos datos se borraban.
    const { rows: rc } = await pool.query(
      `SELECT rc.id, rc.ruta_id, rc.cliente_id, rc.orden, row_to_json(c) as cliente
       FROM ruta_clientes rc JOIN clientes c ON c.id=rc.cliente_id ORDER BY rc.ruta_id, rc.orden`
    );
    const result = rutas.map((r) => ({
      ...r,
      clientes: rc.filter((x) => x.ruta_id === r.id).map((x) => ({
        id: x.id,
        ruta_id: x.ruta_id,
        cliente_id: x.cliente_id,
        orden: x.orden,
        cliente: x.cliente,
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
    // Cliente completo (ver comentario en GET /): listar columnas a mano hacía
    // que las que faltaban llegaran vacías y se borraran al guardar la cartilla.
    const { rows: rc } = await pool.query(
      `SELECT rc.id, rc.ruta_id, rc.cliente_id, rc.orden, row_to_json(c) as cliente
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
        cliente: x.cliente,
      })),
    });
  } catch {
    res.status(500).json({ error: 'Error' });
  }
});

router.post('/', authMiddleware, gestionRutas, async (req: AuthRequest, res: Response) => {
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

router.put('/:id', authMiddleware, gestionRutas, async (req: AuthRequest, res: Response) => {
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

// Agregar un cliente YA EXISTENTE a la ruta (a diferencia de POST /clientes,
// que crea un cliente nuevo). Queda guardado en ruta_clientes sin fecha, así
// que va a reaparecer cada vez que se cargue esta ruta, cualquier día.
router.post('/:id/clientes', authMiddleware, gestionRutas, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { cliente_id } = req.body;
  if (!cliente_id) return res.status(400).json({ error: 'cliente_id requerido' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: clienteRows } = await client.query(
      'SELECT id FROM clientes WHERE id=$1 AND activo=true',
      [cliente_id]
    );
    if (!clienteRows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    const { rows: existente } = await client.query(
      'SELECT id FROM ruta_clientes WHERE ruta_id=$1 AND cliente_id=$2',
      [id, cliente_id]
    );
    if (existente.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'El cliente ya está en esta ruta' });
    }
    const { rows: ordenRows } = await client.query(
      'SELECT COALESCE(MAX(orden),0)+1 as siguiente FROM ruta_clientes WHERE ruta_id=$1',
      [id]
    );
    const { rows } = await client.query(
      'INSERT INTO ruta_clientes (ruta_id, cliente_id, orden) VALUES ($1,$2,$3) RETURNING *',
      [id, cliente_id, ordenRows[0].siguiente]
    );
    await client.query('COMMIT');
    const { rows: clienteCompleto } = await pool.query('SELECT * FROM clientes WHERE id=$1', [cliente_id]);
    res.status(201).json({ ...rows[0], cliente: clienteCompleto[0] });
  } catch {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Error al agregar el cliente a la ruta' });
  } finally {
    client.release();
  }
});

// Quitar un cliente de la ruta (no lo elimina de la base de clientes).
// Requiere una nota explicando el motivo, que queda registrada como alerta.
router.delete('/:id/clientes/:clienteId', authMiddleware, gestionRutas, async (req: AuthRequest, res: Response) => {
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

router.delete('/:id', authMiddleware, gestionRutas, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('UPDATE rutas SET activa=false WHERE id=$1 RETURNING id', [id]);
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No encontrada' });
    }
    // Limpiamos toda referencia vigente a esta ruta para que deje de aparecer
    // como asignada a cualquier repartidor/preventista (queda solo el historial).
    await client.query('DELETE FROM asignaciones WHERE ruta_id=$1', [id]);
    await client.query('DELETE FROM asignaciones_fijas WHERE ruta_id=$1', [id]);
    await client.query('DELETE FROM selecciones_ruta WHERE ruta_id=$1', [id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Error al eliminar ruta' });
  } finally {
    client.release();
  }
});

export default router;
