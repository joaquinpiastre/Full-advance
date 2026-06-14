import { Router, Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import { pool } from '../db/client';
import { authMiddleware, soloAdmin, AuthRequest } from '../middleware/auth';

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

router.get('/', authMiddleware, async (req: Request, res: Response) => {
  const { estado } = req.query;
  let where = 'c.activo=true';
  if (estado === 'inactivos') where = 'c.activo=false';
  else if (estado === 'todos') where = '1=1';
  try {
    const { rows } = await pool.query(
      `SELECT c.*,
        (SELECT rc.ruta_id FROM ruta_clientes rc WHERE rc.cliente_id=c.id LIMIT 1) as ruta_id,
        (SELECT r.nombre FROM ruta_clientes rc JOIN rutas r ON r.id=rc.ruta_id WHERE rc.cliente_id=c.id LIMIT 1) as ruta_nombre
       FROM clientes c WHERE ${where} ORDER BY c.nombre`
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Error' });
  }
});

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const {
    nombre, direccion, lat, lng, telefono, notas, numero_cliente,
    categoria, razon_social, cuit, rubro, email, contacto_nombre, horario_atencion,
    monto_compra_promedio, frecuencia_compra, forma_pago, dia_visita_preferido,
    zona, departamento, marcas,
  } = req.body;
  let { ruta_id } = req.body;
  const esAdmin = req.usuario?.rol === 'admin';
  if (!nombre || !direccion) return res.status(400).json({ error: 'Nombre y dirección requeridos' });
  const client = await pool.connect();
  try {
    if (!esAdmin) {
      // Repartidores/preventistas asignan el cliente automáticamente a su ruta del día.
      const hoy = new Date().toISOString().split('T')[0];
      const { rows: asigRows } = await client.query(
        'SELECT ruta_id FROM asignaciones WHERE usuario_id=$1 AND fecha=$2 LIMIT 1',
        [req.usuario!.id, hoy]
      );
      if (!asigRows.length) return res.status(400).json({ error: 'No tenés una ruta asignada hoy' });
      ruta_id = asigRows[0].ruta_id;
    }
    if (!ruta_id) return res.status(400).json({ error: 'Debés asignar una ruta' });

    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO clientes (
        nombre, direccion, lat, lng, telefono, notas,
        categoria, razon_social, cuit, rubro, email, contacto_nombre, horario_atencion,
        monto_compra_promedio, frecuencia_compra, forma_pago, dia_visita_preferido,
        zona, departamento, marcas, numero_cliente
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) RETURNING *`,
      [
        nombre, direccion, lat ?? 0, lng ?? 0, telefono ?? null, notas ?? null,
        esAdmin ? (categoria ?? null) : null, razon_social ?? null, cuit ?? null, rubro ?? null, email ?? null,
        contacto_nombre ?? null, horario_atencion ?? null,
        monto_compra_promedio ?? null, frecuencia_compra ?? null, forma_pago ?? null, dia_visita_preferido ?? null,
        zona ?? null, departamento ?? null, marcas ?? null, numero_cliente?.trim() || null,
      ]
    );
    const cliente = rows[0];
    const { rows: ordenRows } = await client.query(
      'SELECT COALESCE(MAX(orden), 0) + 1 as siguiente FROM ruta_clientes WHERE ruta_id=$1',
      [ruta_id]
    );
    await client.query(
      'INSERT INTO ruta_clientes (ruta_id, cliente_id, orden) VALUES ($1,$2,$3)',
      [ruta_id, cliente.id, ordenRows[0].siguiente]
    );
    await client.query('COMMIT');
    res.status(201).json({ ...cliente, ruta_id: Number(ruta_id) });
  } catch {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Error al crear cliente' });
  } finally {
    client.release();
  }
});

router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const esAdmin = req.usuario?.rol === 'admin';
  const {
    nombre, direccion, lat, lng, telefono, notas, numero_cliente,
    categoria, razon_social, cuit, rubro, email, contacto_nombre, horario_atencion,
    monto_compra_promedio, frecuencia_compra, forma_pago, dia_visita_preferido,
    zona, departamento, marcas, ruta_id,
  } = req.body;
  if (!nombre || !direccion) return res.status(400).json({ error: 'Nombre y dirección requeridos' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const sets = [
      'nombre=$1', 'direccion=$2', 'lat=$3', 'lng=$4', 'telefono=$5', 'notas=$6',
      'razon_social=$7', 'cuit=$8', 'rubro=$9', 'email=$10', 'contacto_nombre=$11', 'horario_atencion=$12',
      'monto_compra_promedio=$13', 'frecuencia_compra=$14', 'forma_pago=$15', 'dia_visita_preferido=$16',
      'zona=$17', 'departamento=$18', 'marcas=$19', 'numero_cliente=$20', 'cartilla_actualizada_at=NOW()',
    ];
    const valores: any[] = [
      nombre, direccion, lat ?? 0, lng ?? 0, telefono ?? null, notas ?? null,
      razon_social ?? null, cuit ?? null, rubro ?? null, email ?? null,
      contacto_nombre ?? null, horario_atencion ?? null,
      monto_compra_promedio ?? null, frecuencia_compra ?? null, forma_pago ?? null, dia_visita_preferido ?? null,
      zona ?? null, departamento ?? null, marcas ?? null, numero_cliente?.trim() || null,
    ];
    let i = valores.length + 1;
    // Solo el admin puede cambiar la categoría (A-F).
    if (esAdmin) {
      sets.push(`categoria=$${i++}`);
      valores.push(categoria ?? null);
    }
    valores.push(id);
    const { rows } = await client.query(
      `UPDATE clientes SET ${sets.join(', ')} WHERE id=$${i} AND activo=true RETURNING *`,
      valores
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    // Solo el admin puede reasignar la ruta del cliente.
    if (esAdmin && ruta_id) {
      await client.query('DELETE FROM ruta_clientes WHERE cliente_id=$1', [id]);
      const { rows: ordenRows } = await client.query(
        'SELECT COALESCE(MAX(orden), 0) + 1 as siguiente FROM ruta_clientes WHERE ruta_id=$1',
        [ruta_id]
      );
      await client.query(
        'INSERT INTO ruta_clientes (ruta_id, cliente_id, orden) VALUES ($1,$2,$3)',
        [ruta_id, id, ordenRows[0].siguiente]
      );
    }
    await client.query('COMMIT');
    res.json({ ...rows[0], ruta_id: esAdmin && ruta_id ? Number(ruta_id) : undefined });
  } catch {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Error al actualizar' });
  } finally {
    client.release();
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

// Eliminar definitivamente un cliente (solo si ya está inactivo)
router.delete('/:id', authMiddleware, soloAdmin, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT activo FROM clientes WHERE id=$1', [id]);
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    if (rows[0].activo) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Solo se pueden eliminar clientes inactivos' });
    }
    await client.query('UPDATE paradas SET cliente_id=NULL WHERE cliente_id=$1', [id]);
    await client.query('DELETE FROM clientes WHERE id=$1', [id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Error al eliminar el cliente' });
  } finally {
    client.release();
  }
});

// Foto de referencia del local (para guiar a quien visite al cliente)
router.post('/:id/foto-referencia', authMiddleware, upload.single('foto'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  if (!req.file) return res.status(400).json({ error: 'Foto requerida' });
  const uri = `/uploads/${req.file.filename}`;
  try {
    const { rows } = await pool.query(
      'UPDATE clientes SET foto_referencia_uri=$1 WHERE id=$2 RETURNING id',
      [uri, id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json({ uri });
  } catch {
    res.status(500).json({ error: 'Error al guardar la foto' });
  }
});

// Activar / desactivar un cliente (todos los roles)
router.patch('/:id/estado', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { activo } = req.body;
  if (typeof activo !== 'boolean') return res.status(400).json({ error: 'activo (boolean) requerido' });
  try {
    const { rows } = await pool.query('UPDATE clientes SET activo=$1 WHERE id=$2 RETURNING *', [activo, id]);
    if (!rows.length) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: 'Error' });
  }
});

export default router;
