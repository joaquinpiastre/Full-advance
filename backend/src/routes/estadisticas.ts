import { Router, Response } from 'express';
import { pool } from '../db/client';
import { authMiddleware, soloAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// Estadísticas de visitas a clientes: ranking, evolución diaria y distribución
// por categoría. Solo el admin necesita esta vista global.
router.get('/clientes', authMiddleware, soloAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const [resumenRes, topRes, porDiaRes, porCategoriaRes] = await Promise.all([
      pool.query(`
        SELECT
          (SELECT COUNT(*) FROM paradas
            WHERE completada=true AND timestamp_llegada >= NOW() - INTERVAL '30 days')::int AS total_visitas_30d,
          (SELECT COUNT(DISTINCT cliente_id) FROM paradas
            WHERE completada=true AND cliente_id IS NOT NULL AND timestamp_llegada >= NOW() - INTERVAL '30 days')::int AS clientes_visitados_30d,
          (SELECT COUNT(*) FROM clientes WHERE activo=true)::int AS total_clientes
      `),
      pool.query(`
        SELECT c.id, c.nombre, c.direccion, c.categoria,
               COUNT(p.id)::int AS total_visitas,
               MAX(p.timestamp_llegada) AS ultima_visita
        FROM paradas p
        JOIN clientes c ON c.id = p.cliente_id
        WHERE p.completada = true
        GROUP BY c.id
        ORDER BY total_visitas DESC, ultima_visita DESC
        LIMIT 10
      `),
      pool.query(`
        SELECT to_char(d, 'YYYY-MM-DD') AS fecha, COALESCE(COUNT(p.id), 0)::int AS total
        FROM generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, INTERVAL '1 day') AS d
        LEFT JOIN paradas p ON DATE(p.timestamp_llegada) = d::date AND p.completada = true
        GROUP BY d
        ORDER BY d
      `),
      pool.query(`
        SELECT COALESCE(c.categoria, '—') AS categoria, COUNT(p.id)::int AS total
        FROM paradas p
        JOIN clientes c ON c.id = p.cliente_id
        WHERE p.completada = true
        GROUP BY c.categoria
        ORDER BY c.categoria NULLS LAST
      `),
    ]);

    const totalVisitas30d = resumenRes.rows[0].total_visitas_30d;

    res.json({
      resumen: {
        totalVisitas30d,
        promedioDiario: Math.round((totalVisitas30d / 30) * 10) / 10,
        clientesVisitados30d: resumenRes.rows[0].clientes_visitados_30d,
        totalClientes: resumenRes.rows[0].total_clientes,
      },
      topClientes: topRes.rows,
      visitasPorDia: porDiaRes.rows,
      visitasPorCategoria: porCategoriaRes.rows,
    });
  } catch {
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

// Resultados de cada encuesta configurada: última respuesta por cliente
// (sí/no/sin dato), acotado al universo de clientes de las zonas a las
// que aplica la encuesta (o todos los clientes activos si no tiene zonas).
router.get('/encuestas', authMiddleware, soloAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const { rows: encuestas } = await pool.query('SELECT * FROM encuestas ORDER BY created_at DESC');

    const resultados = await Promise.all(encuestas.map(async (encuesta) => {
      const tieneZonas = Array.isArray(encuesta.zonas) && encuesta.zonas.length > 0;

      const [respuestasRes, totalRes] = await Promise.all([
        pool.query(`
          SELECT respuesta, COUNT(*)::int AS total
          FROM (
            SELECT DISTINCT ON (cliente_id) cliente_id, respuesta
            FROM encuesta_respuestas
            WHERE encuesta_id = $1 AND cliente_id IS NOT NULL
            ORDER BY cliente_id, created_at DESC
          ) ultimas
          GROUP BY respuesta
        `, [encuesta.id]),
        tieneZonas
          ? pool.query('SELECT COUNT(*)::int AS total FROM clientes WHERE activo=true AND departamento = ANY($1)', [encuesta.zonas])
          : pool.query('SELECT COUNT(*)::int AS total FROM clientes WHERE activo=true'),
      ]);

      const si = respuestasRes.rows.find((r) => r.respuesta === true)?.total ?? 0;
      const no = respuestasRes.rows.find((r) => r.respuesta === false)?.total ?? 0;
      const total = totalRes.rows[0].total;

      return {
        id: encuesta.id,
        pregunta: encuesta.pregunta,
        activa: encuesta.activa,
        zonas: encuesta.zonas,
        si,
        no,
        sinDato: Math.max(0, total - si - no),
      };
    }));

    res.json(resultados);
  } catch {
    res.status(500).json({ error: 'Error al obtener estadísticas de encuestas' });
  }
});

export default router;
