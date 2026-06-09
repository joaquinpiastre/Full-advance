import { Router, Request, Response } from 'express';
import { pool } from '../db/client';
import { authMiddleware, soloAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// Campos de la "cartilla" que puede completar cualquier rol autenticado
// (repartidores y preventistas en el campo, además del admin).
const CAMPOS_CARTILLA = [
  'razon_social', 'cuit', 'rubro', 'email', 'contacto_nombre', 'horario_atencion',
  'monto_compra_promedio', 'frecuencia_compra', 'forma_pago', 'dia_visita_preferido',
  'telefono', 'notas', 'zona', 'departamento', 'material_exhibicion',
] as const;

router.get('/', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT * FROM clientes WHERE activo=true ORDER BY nombre');
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Error' });
  }
});

router.post('/', authMiddleware, soloAdmin, async (req: AuthRequest, res: Response) => {
  const {
    nombre, direccion, lat, lng, telefono, notas,
    categoria, razon_social, cuit, rubro, email, contacto_nombre, horario_atencion,
    monto_compra_promedio, frecuencia_compra, forma_pago, dia_visita_preferido,
    zona, departamento,
  } = req.body;
  if (!nombre || !direccion) return res.status(400).json({ error: 'Nombre y dirección requeridos' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO clientes (
        nombre, direccion, lat, lng, telefono, notas,
        categoria, razon_social, cuit, rubro, email, contacto_nombre, horario_atencion,
        monto_compra_promedio, frecuencia_compra, forma_pago, dia_visita_preferido,
        zona, departamento
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
      [
        nombre, direccion, lat ?? 0, lng ?? 0, telefono ?? null, notas ?? null,
        categoria ?? null, razon_social ?? null, cuit ?? null, rubro ?? null, email ?? null,
        contacto_nombre ?? null, horario_atencion ?? null,
        monto_compra_promedio ?? null, frecuencia_compra ?? null, forma_pago ?? null, dia_visita_preferido ?? null,
        zona ?? null, departamento ?? null,
      ]
    );
    res.status(201).json(rows[0]);
  } catch {
    res.status(500).json({ error: 'Error al crear cliente' });
  }
});

router.put('/:id', authMiddleware, soloAdmin, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const {
    nombre, direccion, lat, lng, telefono, notas,
    categoria, razon_social, cuit, rubro, email, contacto_nombre, horario_atencion,
    monto_compra_promedio, frecuencia_compra, forma_pago, dia_visita_preferido,
    zona, departamento,
  } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE clientes SET
        nombre=$1, direccion=$2, lat=$3, lng=$4, telefono=$5, notas=$6,
        categoria=$7, razon_social=$8, cuit=$9, rubro=$10, email=$11, contacto_nombre=$12, horario_atencion=$13,
        monto_compra_promedio=$14, frecuencia_compra=$15, forma_pago=$16, dia_visita_preferido=$17,
        zona=$18, departamento=$19,
        cartilla_actualizada_at=NOW()
       WHERE id=$20 AND activo=true RETURNING *`,
      [
        nombre, direccion, lat ?? 0, lng ?? 0, telefono ?? null, notas ?? null,
        categoria ?? null, razon_social ?? null, cuit ?? null, rubro ?? null, email ?? null,
        contacto_nombre ?? null, horario_atencion ?? null,
        monto_compra_promedio ?? null, frecuencia_compra ?? null, forma_pago ?? null, dia_visita_preferido ?? null,
        zona ?? null, departamento ?? null,
        id,
      ]
    );
    if (!rows.length) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: 'Error al actualizar' });
  }
});

router.patch('/:id/coords', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { lat, lng } = req.body;
  if (lat == null || lng == null) return res.status(400).json({ error: 'lat y lng requeridos' });
  try {
    await pool.query('UPDATE clientes SET lat=$1, lng=$2 WHERE id=$3', [lat, lng, id]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Error al actualizar coordenadas' });
  }
});

// Cartilla: la pueden completar repartidores y preventistas durante su recorrido,
// además del admin. Solo el admin puede definir/cambiar la categoría (A-F).
router.put('/:id/cartilla', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const sets: string[] = [];
  const valores: any[] = [];
  let i = 1;

  for (const campo of CAMPOS_CARTILLA) {
    if (campo in req.body) {
      sets.push(`${campo}=$${i++}`);
      valores.push(req.body[campo] === '' ? null : req.body[campo]);
    }
  }

  if (req.usuario?.rol === 'admin' && 'categoria' in req.body) {
    sets.push(`categoria=$${i++}`);
    valores.push(req.body.categoria || null);
  }

  if (!sets.length) return res.status(400).json({ error: 'No hay datos para actualizar' });

  sets.push('cartilla_actualizada_at=NOW()');
  valores.push(id);

  try {
    const { rows } = await pool.query(
      `UPDATE clientes SET ${sets.join(', ')} WHERE id=$${i} AND activo=true RETURNING *`,
      valores
    );
    if (!rows.length) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: 'Error al actualizar la cartilla' });
  }
});

router.delete('/:id', authMiddleware, soloAdmin, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    await pool.query('UPDATE clientes SET activo=false WHERE id=$1', [id]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Error' });
  }
});

export default router;
