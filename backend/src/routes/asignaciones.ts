import { Router, Response } from 'express';
import { pool } from '../db/client';
import { authMiddleware, soloAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// Helper: arma el objeto completo de asignación (ruta + clientes)
async function fetchAsignacionCompleta(asig: any) {
  const { rows: rc } = await pool.query(
    `SELECT rc.*,
      c.nombre as cliente_nombre, c.direccion, c.lat, c.lng, c.telefono, c.notas,
      c.categoria, c.razon_social, c.cuit, c.rubro, c.email, c.contacto_nombre, c.horario_atencion,
      c.monto_compra_promedio, c.frecuencia_compra, c.forma_pago, c.dia_visita_preferido,
      c.cartilla_actualizada_at, c.zona, c.departamento
     FROM ruta_clientes rc JOIN clientes c ON c.id=rc.cliente_id
     WHERE rc.ruta_id=$1 ORDER BY rc.orden`,
    [asig.ruta_id]
  );
  return {
    ...asig,
    ruta: {
      id: asig.ruta_id,
      nombre: asig.ruta_nombre,
      descripcion: asig.ruta_desc,
      clientes: rc.map((x) => ({
        id: x.id,
        cliente_id: x.cliente_id,
        orden: x.orden,
        cliente: {
          id: x.cliente_id, nombre: x.cliente_nombre, direccion: x.direccion,
          lat: x.lat, lng: x.lng, telefono: x.telefono, notas: x.notas,
          categoria: x.categoria, razon_social: x.razon_social, cuit: x.cuit, rubro: x.rubro,
          email: x.email, contacto_nombre: x.contacto_nombre, horario_atencion: x.horario_atencion,
          monto_compra_promedio: x.monto_compra_promedio, frecuencia_compra: x.frecuencia_compra,
          forma_pago: x.forma_pago, dia_visita_preferido: x.dia_visita_preferido,
          cartilla_actualizada_at: x.cartilla_actualizada_at,
          zona: x.zona, departamento: x.departamento,
        },
      })),
    },
  };
}

// Asignación del día para el usuario autenticado.
// Si no hay asignación manual, aplica automáticamente la ruta fija.
router.get('/hoy', authMiddleware, async (req: AuthRequest, res: Response) => {
  const usuario_id = req.usuario!.id;
  const hoy = new Date().toISOString().split('T')[0];
  try {
    let { rows } = await pool.query(
      `SELECT a.*, r.nombre as ruta_nombre, r.descripcion as ruta_desc
       FROM asignaciones a JOIN rutas r ON r.id=a.ruta_id
       WHERE a.usuario_id=$1 AND a.fecha=$2 LIMIT 1`,
      [usuario_id, hoy]
    );

    // Sin asignación manual → aplicar ruta fija si existe
    if (!rows.length) {
      const { rows: fija } = await pool.query(
        `SELECT af.ruta_id, r.nombre as ruta_nombre, r.descripcion as ruta_desc
         FROM asignaciones_fijas af JOIN rutas r ON r.id=af.ruta_id
         WHERE af.usuario_id=$1 AND af.activo=true`,
        [usuario_id]
      );
      if (fija.length) {
        const { rows: nueva } = await pool.query(
          `INSERT INTO asignaciones (usuario_id, ruta_id, fecha) VALUES ($1,$2,$3)
           ON CONFLICT (usuario_id, fecha) DO UPDATE SET ruta_id=$2 RETURNING *`,
          [usuario_id, fija[0].ruta_id, hoy]
        );
        rows = [{ ...nueva[0], ruta_nombre: fija[0].ruta_nombre, ruta_desc: fija[0].ruta_desc }];
      }
    }

    if (!rows.length) return res.json(null);
    res.json(await fetchAsignacionCompleta(rows[0]));
  } catch {
    res.status(500).json({ error: 'Error' });
  }
});

// Todas las asignaciones fijas (admin)
router.get('/fijas', authMiddleware, soloAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT af.id, af.usuario_id, af.ruta_id, af.activo,
             u.nombre as usuario_nombre, u.rol as usuario_rol,
             r.nombre as ruta_nombre
      FROM asignaciones_fijas af
      JOIN usuarios u ON u.id=af.usuario_id
      JOIN rutas r ON r.id=af.ruta_id
      WHERE af.activo=true
      ORDER BY u.nombre
    `);
    res.json(rows.map((r) => ({
      id: r.id,
      usuario_id: r.usuario_id,
      ruta_id: r.ruta_id,
      usuario: { id: r.usuario_id, nombre: r.usuario_nombre, rol: r.usuario_rol },
      ruta: { id: r.ruta_id, nombre: r.ruta_nombre },
    })));
  } catch {
    res.status(500).json({ error: 'Error' });
  }
});

// Asignar o cambiar ruta fija de un usuario (upsert)
router.put('/fijas/:usuario_id', authMiddleware, soloAdmin, async (req: AuthRequest, res: Response) => {
  const { usuario_id } = req.params;
  const { ruta_id } = req.body;
  if (!ruta_id) return res.status(400).json({ error: 'ruta_id requerido' });
  try {
    await pool.query(
      `INSERT INTO asignaciones_fijas (usuario_id, ruta_id, activo) VALUES ($1,$2,true)
       ON CONFLICT (usuario_id) DO UPDATE SET ruta_id=$2, activo=true`,
      [usuario_id, ruta_id]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Error al guardar ruta fija' });
  }
});

// Quitar ruta fija de un usuario
router.delete('/fijas/:usuario_id', authMiddleware, soloAdmin, async (req: AuthRequest, res: Response) => {
  const { usuario_id } = req.params;
  try {
    await pool.query('UPDATE asignaciones_fijas SET activo=false WHERE usuario_id=$1', [usuario_id]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Error' });
  }
});

// Todas las asignaciones recientes + lista de usuarios (admin)
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

// Crear / actualizar asignación manual para una fecha
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
