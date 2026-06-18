import { Router, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import { pool } from '../db/client';
import { authMiddleware, adminOSupervisor, AuthRequest } from '../middleware/auth';

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

const METODOS_VALIDOS = ['efectivo', 'transferencia_hecha', 'transferencia_por_hacer', 'cuenta_corriente', 'cheque'];

// Pagos cargados por el usuario actual, más recientes primero.
router.get('/mios', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, c.nombre as cliente_nombre
       FROM pagos p JOIN clientes c ON c.id = p.cliente_id
       WHERE p.usuario_id = $1 AND p.created_at >= NOW() - INTERVAL '90 days'
       ORDER BY p.fecha_pago DESC, p.created_at DESC`,
      [req.usuario!.id]
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Error' });
  }
});

// Listado completo, para el panel de admin/supervisor.
router.get('/', authMiddleware, adminOSupervisor, async (_req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, c.nombre as cliente_nombre,
        u.nombre as autor_nombre, u.rol as autor_rol
       FROM pagos p
       JOIN clientes c ON c.id = p.cliente_id
       JOIN usuarios u ON u.id = p.usuario_id
       ORDER BY p.fecha_pago DESC, p.created_at DESC`
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Error' });
  }
});

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const {
    cliente_id, fecha_pago, fecha_emision_factura, numero_factura,
    monto_a_cobrar, monto_pagado, metodo_pago, numero_cheque, nota,
  } = req.body;

  if (!cliente_id || !fecha_pago || monto_a_cobrar == null || monto_pagado == null || !metodo_pago) {
    return res.status(400).json({ error: 'Cliente, fecha de pago, montos y método de pago son obligatorios' });
  }
  if (!METODOS_VALIDOS.includes(metodo_pago)) {
    return res.status(400).json({ error: 'Método de pago inválido' });
  }
  if (metodo_pago === 'cheque' && !numero_cheque?.trim()) {
    return res.status(400).json({ error: 'El número de cheque es obligatorio para ese método de pago' });
  }

  try {
    const { rows: clienteRows } = await pool.query('SELECT numero_cliente FROM clientes WHERE id=$1', [cliente_id]);
    if (!clienteRows.length) return res.status(404).json({ error: 'Cliente no encontrado' });

    const { rows } = await pool.query(
      `INSERT INTO pagos (
        usuario_id, cliente_id, numero_cliente, fecha_pago, fecha_emision_factura,
        numero_factura, monto_a_cobrar, monto_pagado, metodo_pago, numero_cheque, nota
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        req.usuario!.id, cliente_id, clienteRows[0].numero_cliente ?? null, fecha_pago,
        fecha_emision_factura ?? null, numero_factura?.trim() || null,
        monto_a_cobrar, monto_pagado, metodo_pago,
        metodo_pago === 'cheque' ? numero_cheque.trim() : null,
        nota?.trim() || null,
      ]
    );
    res.status(201).json(rows[0]);
  } catch {
    res.status(500).json({ error: 'Error al registrar el pago' });
  }
});

router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const {
    cliente_id, fecha_pago, fecha_emision_factura, numero_factura,
    monto_a_cobrar, monto_pagado, metodo_pago, numero_cheque, nota,
  } = req.body;

  if (!cliente_id || !fecha_pago || monto_a_cobrar == null || monto_pagado == null || !metodo_pago) {
    return res.status(400).json({ error: 'Cliente, fecha de pago, montos y método de pago son obligatorios' });
  }
  if (!METODOS_VALIDOS.includes(metodo_pago)) {
    return res.status(400).json({ error: 'Método de pago inválido' });
  }
  if (metodo_pago === 'cheque' && !numero_cheque?.trim()) {
    return res.status(400).json({ error: 'El número de cheque es obligatorio para ese método de pago' });
  }

  try {
    const { rows: clienteRows } = await pool.query('SELECT numero_cliente FROM clientes WHERE id=$1', [cliente_id]);
    if (!clienteRows.length) return res.status(404).json({ error: 'Cliente no encontrado' });

    const esAdmin = req.usuario?.rol === 'admin';
    const { rows } = await pool.query(
      `UPDATE pagos SET
        cliente_id=$1, numero_cliente=$2, fecha_pago=$3, fecha_emision_factura=$4,
        numero_factura=$5, monto_a_cobrar=$6, monto_pagado=$7, metodo_pago=$8,
        numero_cheque=$9, nota=$10
       WHERE id=$11 AND (usuario_id=$12 OR $13=true)
       RETURNING *`,
      [
        cliente_id, clienteRows[0].numero_cliente ?? null, fecha_pago,
        fecha_emision_factura ?? null, numero_factura?.trim() || null,
        monto_a_cobrar, monto_pagado, metodo_pago,
        metodo_pago === 'cheque' ? numero_cheque.trim() : null,
        nota?.trim() || null,
        id, req.usuario!.id, esAdmin,
      ]
    );
    if (!rows.length) return res.status(404).json({ error: 'Pago no encontrado o no te pertenece' });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: 'Error al editar el pago' });
  }
});

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const esAdmin = req.usuario?.rol === 'admin';
    const { rows } = await pool.query(
      `DELETE FROM pagos WHERE id=$1 AND (usuario_id=$2 OR $3=true) RETURNING id`,
      [id, req.usuario!.id, esAdmin]
    );
    if (!rows.length) return res.status(404).json({ error: 'Pago no encontrado o no te pertenece' });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Error al eliminar el pago' });
  }
});

// Sube (o reemplaza) el comprobante de transferencia/pago de un pago propio (o cualquiera si admin).
router.post('/:id/comprobante', authMiddleware, upload.single('comprobante'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  if (!req.file) return res.status(400).json({ error: 'Falta el archivo del comprobante' });
  const comprobante_uri = `/uploads/${req.file.filename}`;
  try {
    const esAdmin = req.usuario?.rol === 'admin';
    const { rows } = await pool.query(
      `UPDATE pagos SET comprobante_uri=$1 WHERE id=$2 AND (usuario_id=$3 OR $4=true) RETURNING *`,
      [comprobante_uri, id, req.usuario!.id, esAdmin]
    );
    if (!rows.length) return res.status(404).json({ error: 'Pago no encontrado o no te pertenece' });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ error: 'Error al subir el comprobante' });
  }
});

export default router;
