import { Router, Response } from 'express';
import { pool } from '../db/client';
import { authMiddleware, soloAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

function generarCodigo(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O/I/1 para evitar confusiones
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function getVCConDetalles(id: number) {
  const { rows } = await pool.query(
    `SELECT vc.*,
       u1.nombre as creador_nombre, u1.rol as creador_rol,
       u2.nombre as socio_nombre, u2.rol as socio_rol,
       r.nombre as ruta_nombre
     FROM ventas_calientes vc
     JOIN usuarios u1 ON u1.id = vc.creador_id
     LEFT JOIN usuarios u2 ON u2.id = vc.socio_id
     LEFT JOIN rutas r ON r.id = vc.ruta_id
     WHERE vc.id = $1`,
    [id]
  );
  if (!rows.length) return null;
  const vc = rows[0];

  const { rows: clientes } = await pool.query(
    `SELECT rc.orden, c.id, c.nombre, c.direccion, c.telefono, c.lat, c.lng,
       c.categoria, c.zona, c.departamento, c.rubro
     FROM ruta_clientes rc
     JOIN clientes c ON c.id = rc.cliente_id
     WHERE rc.ruta_id = $1 AND c.activo = true
     ORDER BY rc.orden`,
    [vc.ruta_id]
  );

  const { rows: visitas } = await pool.query(
    `SELECT p.id, p.cliente_id, p.completada, p.timestamp_llegada, p.timestamp_salida,
       p.foto1_uri, p.foto2_uri, p.nota,
       p.tiene_vencidos, p.mercaderia_vencida, p.fecha_vencimiento,
       p.urgente, p.urgencia_descripcion
     FROM paradas p
     WHERE p.venta_caliente_id = $1
     ORDER BY p.timestamp_llegada`,
    [id]
  );

  return {
    id: vc.id,
    codigo: vc.codigo,
    activa: vc.activa,
    fecha: vc.fecha,
    creador: { id: vc.creador_id, nombre: vc.creador_nombre, rol: vc.creador_rol },
    socio: vc.socio_id ? { id: vc.socio_id, nombre: vc.socio_nombre, rol: vc.socio_rol } : null,
    ruta: { id: vc.ruta_id, nombre: vc.ruta_nombre, clientes },
    visitas,
  };
}

// Sesión activa del usuario para hoy
router.get('/activa', authMiddleware, async (req: AuthRequest, res: Response) => {
  const uid = req.usuario!.id;
  const hoy = new Date().toISOString().split('T')[0];
  try {
    const { rows } = await pool.query(
      `SELECT id FROM ventas_calientes WHERE (creador_id=$1 OR socio_id=$1) AND fecha=$2 AND activa=true LIMIT 1`,
      [uid, hoy]
    );
    if (!rows.length) return res.json(null);
    res.json(await getVCConDetalles(rows[0].id));
  } catch {
    res.status(500).json({ error: 'Error' });
  }
});

// Crear nueva sesión
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const uid = req.usuario!.id;
  const { ruta_id } = req.body;
  if (!ruta_id) return res.status(400).json({ error: 'ruta_id requerido' });
  const hoy = new Date().toISOString().split('T')[0];
  try {
    const { rows: existing } = await pool.query(
      `SELECT id FROM ventas_calientes WHERE (creador_id=$1 OR socio_id=$1) AND fecha=$2 AND activa=true`,
      [uid, hoy]
    );
    if (existing.length) return res.status(400).json({ error: 'Ya tenés una sesión activa hoy. Finalizala antes de crear una nueva.' });

    // Código único para el día
    let codigo = generarCodigo();
    for (let i = 0; i < 10; i++) {
      const { rows: dup } = await pool.query(
        `SELECT id FROM ventas_calientes WHERE codigo=$1 AND fecha=$2`, [codigo, hoy]
      );
      if (!dup.length) break;
      codigo = generarCodigo();
    }

    const { rows } = await pool.query(
      `INSERT INTO ventas_calientes (codigo, creador_id, ruta_id, fecha) VALUES ($1,$2,$3,$4) RETURNING id`,
      [codigo, uid, ruta_id, hoy]
    );
    res.status(201).json(await getVCConDetalles(rows[0].id));
  } catch {
    res.status(500).json({ error: 'Error al crear sesión' });
  }
});

// Unirse con código
router.post('/unirse', authMiddleware, async (req: AuthRequest, res: Response) => {
  const uid = req.usuario!.id;
  const { codigo } = req.body;
  if (!codigo) return res.status(400).json({ error: 'codigo requerido' });
  const hoy = new Date().toISOString().split('T')[0];
  try {
    const { rows } = await pool.query(
      `SELECT * FROM ventas_calientes WHERE codigo=$1 AND fecha=$2 AND activa=true`,
      [String(codigo).toUpperCase().trim(), hoy]
    );
    if (!rows.length) return res.status(404).json({ error: 'Código no encontrado. Verificá que el código sea de hoy.' });
    const vc = rows[0];
    if (vc.creador_id === uid) return res.status(400).json({ error: 'Sos el creador de esta sesión.' });
    if (vc.socio_id && vc.socio_id !== uid) return res.status(400).json({ error: 'Esta sesión ya tiene otro socio.' });
    if (!vc.socio_id) {
      await pool.query('UPDATE ventas_calientes SET socio_id=$1 WHERE id=$2', [uid, vc.id]);
    }
    res.json(await getVCConDetalles(vc.id));
  } catch {
    res.status(500).json({ error: 'Error al unirse' });
  }
});

// Detalles de sesión (participante o admin)
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const uid = req.usuario!.id;
  try {
    const vc = await getVCConDetalles(Number(req.params.id));
    if (!vc) return res.status(404).json({ error: 'Sesión no encontrada' });
    if (vc.creador.id !== uid && vc.socio?.id !== uid && req.usuario!.rol !== 'admin') {
      return res.status(403).json({ error: 'Sin acceso' });
    }
    res.json(vc);
  } catch {
    res.status(500).json({ error: 'Error' });
  }
});

// Iniciar visita a un cliente (crea parada)
router.post('/:id/visitas', authMiddleware, async (req: AuthRequest, res: Response) => {
  const uid = req.usuario!.id;
  const vc_id = Number(req.params.id);
  const { cliente_id, lat, lng } = req.body;
  try {
    const { rows: [vc] } = await pool.query(
      `SELECT * FROM ventas_calientes WHERE id=$1 AND activa=true`, [vc_id]
    );
    if (!vc) return res.status(404).json({ error: 'Sesión no encontrada o ya finalizada' });
    if (vc.creador_id !== uid && vc.socio_id !== uid) {
      return res.status(403).json({ error: 'No sos participante de esta sesión' });
    }
    if (cliente_id) {
      const { rows: dup } = await pool.query(
        `SELECT id FROM paradas WHERE venta_caliente_id=$1 AND cliente_id=$2`, [vc_id, cliente_id]
      );
      if (dup.length) return res.status(400).json({ error: 'Ya existe una visita a este cliente en la sesión' });
    }
    const { rows } = await pool.query(
      `INSERT INTO paradas (venta_caliente_id, lat, lng, cliente_id) VALUES ($1,$2,$3,$4) RETURNING *`,
      [vc_id, lat ?? 0, lng ?? 0, cliente_id ?? null]
    );
    const parada = rows[0];
    if (cliente_id) {
      const { rows: c } = await pool.query('SELECT nombre, direccion FROM clientes WHERE id=$1', [cliente_id]);
      parada.cliente = c[0] ?? null;
    }
    res.status(201).json(parada);
  } catch {
    res.status(500).json({ error: 'Error al iniciar visita' });
  }
});

// Finalizar sesión
router.patch('/:id/finalizar', authMiddleware, async (req: AuthRequest, res: Response) => {
  const uid = req.usuario!.id;
  const vc_id = Number(req.params.id);
  try {
    const { rows: [vc] } = await pool.query(`SELECT * FROM ventas_calientes WHERE id=$1`, [vc_id]);
    if (!vc) return res.status(404).json({ error: 'No encontrado' });
    if (vc.creador_id !== uid && vc.socio_id !== uid && req.usuario!.rol !== 'admin') {
      return res.status(403).json({ error: 'Sin acceso' });
    }
    await pool.query('UPDATE ventas_calientes SET activa=false WHERE id=$1', [vc_id]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Error' });
  }
});

// Admin: historial de sesiones
router.get('/', authMiddleware, soloAdmin, async (req: AuthRequest, res: Response) => {
  const { usuario_id } = req.query;
  try {
    const params: any[] = [];
    let where = 'WHERE vc.fecha >= CURRENT_DATE - 90';
    if (usuario_id) {
      params.push(Number(usuario_id));
      where += ` AND (vc.creador_id = $${params.length} OR vc.socio_id = $${params.length})`;
    }
    const { rows } = await pool.query(`
      SELECT vc.id, vc.codigo, vc.activa, vc.fecha, vc.created_at,
        u1.nombre as creador_nombre, u1.rol as creador_rol,
        u2.nombre as socio_nombre, u2.rol as socio_rol,
        r.nombre as ruta_nombre,
        COUNT(p.id)::int as visitas_total,
        COUNT(CASE WHEN p.completada THEN 1 END)::int as visitas_completas
      FROM ventas_calientes vc
      JOIN usuarios u1 ON u1.id = vc.creador_id
      LEFT JOIN usuarios u2 ON u2.id = vc.socio_id
      LEFT JOIN rutas r ON r.id = vc.ruta_id
      LEFT JOIN paradas p ON p.venta_caliente_id = vc.id
      ${where}
      GROUP BY vc.id, u1.nombre, u1.rol, u2.nombre, u2.rol, r.nombre
      ORDER BY vc.fecha DESC, vc.created_at DESC
    `, params);
    res.json(rows.map((v) => ({
      id: v.id, codigo: v.codigo, activa: v.activa, fecha: v.fecha,
      creador: { nombre: v.creador_nombre, rol: v.creador_rol },
      socio: v.socio_nombre ? { nombre: v.socio_nombre, rol: v.socio_rol } : null,
      ruta: v.ruta_nombre,
      visitas: { total: v.visitas_total, completas: v.visitas_completas },
    })));
  } catch {
    res.status(500).json({ error: 'Error' });
  }
});

export default router;
