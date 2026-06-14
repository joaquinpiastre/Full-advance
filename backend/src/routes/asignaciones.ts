import { Router, Response } from 'express';
import { pool } from '../db/client';
import { authMiddleware, soloAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// El servidor corre en UTC, pero "el día de hoy" para esta app es el día en
// Argentina (UTC-3, sin horario de verano). Sin este ajuste, cerca de la
// medianoche el backend calcula "hoy" o "esta semana" un día distinto al que
// ve el usuario en su celular, y las asignaciones manuales/elegidas no matchean.
const TZ_OFFSET_MS = 3 * 60 * 60 * 1000;

function hoyArgentina(): string {
  return new Date(Date.now() - TZ_OFFSET_MS).toISOString().split('T')[0];
}

// Lunes (00:00) de la semana que contiene `fecha`. Las semanas van de lunes a
// domingo, por lo que el reseteo ocurre el domingo a la noche al pasar a una
// nueva semana_inicio.
function inicioSemana(fecha: Date): string {
  const d = new Date(fecha.getTime() - TZ_OFFSET_MS);
  const dia = d.getUTCDay(); // 0=domingo ... 6=sábado
  const diff = dia === 0 ? -6 : 1 - dia;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().split('T')[0];
}

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

// Todas las rutas activas, en formato de "opción" (para cuando el usuario no
// tiene rutas habilitadas por el admin y puede elegir entre todas).
async function obtenerTodasLasRutas() {
  const { rows } = await pool.query(
    `SELECT r.id as ruta_id, r.nombre as ruta_nombre, r.descripcion as ruta_desc,
            (SELECT COUNT(*) FROM ruta_clientes WHERE ruta_id=r.id)::int as clientes_count
     FROM rutas r WHERE r.activa=true ORDER BY r.nombre`
  );
  return rows;
}

// Asignación del día para el usuario autenticado.
// Orden de prioridad:
//   1. Asignación manual del admin para hoy.
//   2. Ruta ya elegida por el usuario para la semana en curso.
//   3. Si tiene una sola ruta habilitada, se elige automáticamente.
//   4. Si tiene varias, se informa que debe elegir (necesita_eleccion).
router.get('/hoy', authMiddleware, async (req: AuthRequest, res: Response) => {
  const usuario_id = req.usuario!.id;
  const ahora = new Date();
  const hoy = hoyArgentina();
  const semana = inicioSemana(ahora);
  try {
    const { rows: manual } = await pool.query(
      `SELECT a.*, r.nombre as ruta_nombre, r.descripcion as ruta_desc
       FROM asignaciones a JOIN rutas r ON r.id=a.ruta_id
       WHERE a.usuario_id=$1 AND a.fecha=$2 LIMIT 1`,
      [usuario_id, hoy]
    );
    if (manual.length) return res.json(await fetchAsignacionCompleta(manual[0]));

    const { rows: fijas } = await pool.query(
      `SELECT af.ruta_id, r.nombre as ruta_nombre, r.descripcion as ruta_desc,
              (SELECT COUNT(*) FROM ruta_clientes WHERE ruta_id=af.ruta_id)::int as clientes_count
       FROM asignaciones_fijas af JOIN rutas r ON r.id=af.ruta_id
       WHERE af.usuario_id=$1 AND af.activo=true ORDER BY r.nombre`,
      [usuario_id]
    );

    const { rows: seleccion } = await pool.query(
      `SELECT sr.ruta_id, r.nombre as ruta_nombre, r.descripcion as ruta_desc
       FROM selecciones_ruta sr JOIN rutas r ON r.id=sr.ruta_id
       WHERE sr.usuario_id=$1 AND sr.semana_inicio=$2`,
      [usuario_id, semana]
    );
    // Solo se respeta la elección guardada si sigue siendo válida: o el admin
    // no restringió rutas, o la ruta elegida sigue entre las habilitadas.
    // Así, si el admin habilita una ruta nueva, no queda "tapada" por una
    // elección vieja de cuando el usuario no tenía ninguna ruta habilitada.
    if (seleccion.length && (fijas.length === 0 || fijas.some((f) => f.ruta_id === seleccion[0].ruta_id))) {
      return res.json(await fetchAsignacionCompleta({
        usuario_id, ruta_id: seleccion[0].ruta_id, fecha: hoy,
        ruta_nombre: seleccion[0].ruta_nombre, ruta_desc: seleccion[0].ruta_desc,
      }));
    }

    if (fijas.length === 1) {
      await pool.query(
        `INSERT INTO selecciones_ruta (usuario_id, ruta_id, semana_inicio) VALUES ($1,$2,$3)
         ON CONFLICT (usuario_id, semana_inicio) DO UPDATE SET ruta_id=$2`,
        [usuario_id, fijas[0].ruta_id, semana]
      );
      return res.json(await fetchAsignacionCompleta({
        usuario_id, ruta_id: fijas[0].ruta_id, fecha: hoy,
        ruta_nombre: fijas[0].ruta_nombre, ruta_desc: fijas[0].ruta_desc,
      }));
    }

    // Sin restricción del admin (o con varias rutas habilitadas): elige entre todas las activas.
    const opciones = fijas.length > 1 ? fijas : await obtenerTodasLasRutas();

    res.json({
      necesita_eleccion: true,
      opciones: opciones.map((f) => ({
        id: f.ruta_id, nombre: f.ruta_nombre, descripcion: f.ruta_desc, clientes_count: f.clientes_count,
      })),
    });
  } catch {
    res.status(500).json({ error: 'Error' });
  }
});

// Rutas habilitadas para el usuario autenticado y cuál tiene elegida esta semana.
router.get('/rutas-disponibles', authMiddleware, async (req: AuthRequest, res: Response) => {
  const usuario_id = req.usuario!.id;
  const semana = inicioSemana(new Date());
  try {
    const { rows: fijas } = await pool.query(
      `SELECT af.ruta_id, r.nombre as ruta_nombre, r.descripcion as ruta_desc,
              (SELECT COUNT(*) FROM ruta_clientes WHERE ruta_id=af.ruta_id)::int as clientes_count
       FROM asignaciones_fijas af JOIN rutas r ON r.id=af.ruta_id
       WHERE af.usuario_id=$1 AND af.activo=true ORDER BY r.nombre`,
      [usuario_id]
    );
    const { rows: seleccion } = await pool.query(
      `SELECT ruta_id FROM selecciones_ruta WHERE usuario_id=$1 AND semana_inicio=$2`,
      [usuario_id, semana]
    );
    // Si el admin no le habilitó rutas específicas, puede elegir entre todas las activas.
    const opciones = fijas.length > 0 ? fijas : await obtenerTodasLasRutas();
    res.json({
      opciones: opciones.map((f) => ({
        id: f.ruta_id, nombre: f.ruta_nombre, descripcion: f.ruta_desc, clientes_count: f.clientes_count,
      })),
      seleccion_actual: seleccion[0]?.ruta_id ?? null,
    });
  } catch {
    res.status(500).json({ error: 'Error' });
  }
});

// El usuario elige cuál de sus rutas habilitadas va a hacer esta semana.
router.post('/elegir', authMiddleware, async (req: AuthRequest, res: Response) => {
  const usuario_id = req.usuario!.id;
  const { ruta_id } = req.body;
  if (!ruta_id) return res.status(400).json({ error: 'ruta_id requerido' });
  const semana = inicioSemana(new Date());
  try {
    const { rows: fijas } = await pool.query(
      `SELECT 1 FROM asignaciones_fijas WHERE usuario_id=$1 AND activo=true`,
      [usuario_id]
    );
    if (fijas.length) {
      const { rows: permitida } = await pool.query(
        `SELECT 1 FROM asignaciones_fijas WHERE usuario_id=$1 AND ruta_id=$2 AND activo=true`,
        [usuario_id, ruta_id]
      );
      if (!permitida.length) return res.status(403).json({ error: 'Esa ruta no está habilitada para vos' });
    } else {
      const { rows: activa } = await pool.query('SELECT 1 FROM rutas WHERE id=$1 AND activa=true', [ruta_id]);
      if (!activa.length) return res.status(404).json({ error: 'Ruta no encontrada' });
    }
    await pool.query(
      `INSERT INTO selecciones_ruta (usuario_id, ruta_id, semana_inicio) VALUES ($1,$2,$3)
       ON CONFLICT (usuario_id, semana_inicio) DO UPDATE SET ruta_id=$2`,
      [usuario_id, ruta_id, semana]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Error al elegir ruta' });
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

// Habilitar una ruta más para un usuario (no reemplaza las que ya tiene)
router.put('/fijas/:usuario_id', authMiddleware, soloAdmin, async (req: AuthRequest, res: Response) => {
  const { usuario_id } = req.params;
  const { ruta_id } = req.body;
  if (!ruta_id) return res.status(400).json({ error: 'ruta_id requerido' });
  try {
    await pool.query(
      `INSERT INTO asignaciones_fijas (usuario_id, ruta_id, activo) VALUES ($1,$2,true)
       ON CONFLICT (usuario_id, ruta_id) DO UPDATE SET activo=true`,
      [usuario_id, ruta_id]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Error al guardar ruta fija' });
  }
});

// Quitar una ruta habilitada de un usuario
router.delete('/fijas/:usuario_id/:ruta_id', authMiddleware, soloAdmin, async (req: AuthRequest, res: Response) => {
  const { usuario_id, ruta_id } = req.params;
  try {
    await pool.query('UPDATE asignaciones_fijas SET activo=false WHERE usuario_id=$1 AND ruta_id=$2', [usuario_id, ruta_id]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Error' });
  }
});

// Todas las asignaciones recientes + lista de usuarios (admin)
router.get('/', authMiddleware, soloAdmin, async (_req: AuthRequest, res: Response) => {
  const hoy = hoyArgentina();
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
    // La ruta asignada para ese día queda también habilitada para el resto de
    // la semana, para que el usuario pueda elegirla al iniciar jornada otros días.
    await pool.query(
      `INSERT INTO asignaciones_fijas (usuario_id, ruta_id, activo) VALUES ($1,$2,true)
       ON CONFLICT (usuario_id, ruta_id) DO UPDATE SET activo=true`,
      [usuario_id, ruta_id]
    );
    res.status(201).json(rows[0]);
  } catch {
    res.status(500).json({ error: 'Error al asignar' });
  }
});

// Eliminar una asignación manual de un día
router.delete('/:id', authMiddleware, soloAdmin, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM asignaciones WHERE id=$1', [id]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

export default router;
