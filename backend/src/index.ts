import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

import { pool } from './db/client';
import authRouter from './routes/auth';
import gpsRouter from './routes/gps';
import jornadasRouter from './routes/jornadas';
import paradasRouter from './routes/paradas';
import clientesRouter from './routes/clientes';
import rutasRouter from './routes/rutas';
import asignacionesRouter from './routes/asignaciones';
import estadisticasRouter from './routes/estadisticas';
import ventasCalientesRouter from './routes/ventas-calientes';
import zonasRouter from './routes/zonas';
import anunciosRouter from './routes/anuncios';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.resolve(process.env.UPLOADS_DIR ?? './uploads')));

app.use('/auth', authRouter);
app.use('/gps', gpsRouter);
app.use('/jornadas', jornadasRouter);
app.use('/paradas', paradasRouter);
app.use('/clientes', clientesRouter);
app.use('/rutas', rutasRouter);
app.use('/asignaciones', asignacionesRouter);
app.use('/estadisticas', estadisticasRouter);
app.use('/ventas-calientes', ventasCalientesRouter);
app.use('/zonas', zonasRouter);
app.use('/anuncios', anunciosRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok', app: 'Full Advance' }));

// Crea la tabla de rutas fijas si no existe (migración automática al arrancar)
pool.query(`
  CREATE TABLE IF NOT EXISTS asignaciones_fijas (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    ruta_id INTEGER NOT NULL REFERENCES rutas(id),
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(usuario_id)
  )
`).catch(() => {});

// Marcas que distribuye el cliente (BIMBO, CITRIC, SANAS, ARRABAL)
pool.query(`
  ALTER TABLE clientes ADD COLUMN IF NOT EXISTS marcas TEXT[]
`).catch(() => {});

// Columnas del flujo preventista en paradas
pool.query(`
  ALTER TABLE clientes
    ADD COLUMN IF NOT EXISTS material_exhibicion TEXT,
    ADD COLUMN IF NOT EXISTS tipo_comercio VARCHAR(100)
`).catch(() => {});

pool.query(`
  ALTER TABLE paradas
    ADD COLUMN IF NOT EXISTS tiene_vencidos BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS mercaderia_vencida TEXT,
    ADD COLUMN IF NOT EXISTS fecha_vencimiento VARCHAR(50),
    ADD COLUMN IF NOT EXISTS urgente BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS urgencia_descripcion TEXT,
    ADD COLUMN IF NOT EXISTS producto_informe VARCHAR(200),
    ADD COLUMN IF NOT EXISTS precio_informe VARCHAR(100)
`).catch(() => {});

// Tabla y columna para Ventas Calientes
pool.query(`
  CREATE TABLE IF NOT EXISTS ventas_calientes (
    id SERIAL PRIMARY KEY,
    codigo CHAR(6) UNIQUE NOT NULL,
    creador_id INTEGER NOT NULL REFERENCES usuarios(id),
    socio_id INTEGER REFERENCES usuarios(id),
    ruta_id INTEGER NOT NULL REFERENCES rutas(id),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    activa BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`).then(() => pool.query(`
  ALTER TABLE paradas ADD COLUMN IF NOT EXISTS venta_caliente_id INTEGER REFERENCES ventas_calientes(id)
`)).catch(() => {});

// Nota de acciones que debe revisar el administrador o supervisor
pool.query(`
  ALTER TABLE paradas ADD COLUMN IF NOT EXISTS accion_requerida TEXT
`).catch(() => {});

// Hasta 5 fotos por parada (antes solo 2)
pool.query(`
  ALTER TABLE paradas
    ADD COLUMN IF NOT EXISTS foto3_uri VARCHAR(500),
    ADD COLUMN IF NOT EXISTS foto4_uri VARCHAR(500),
    ADD COLUMN IF NOT EXISTS foto5_uri VARCHAR(500)
`).catch(() => {});

// Listas de departamentos y distritos seleccionables, ampliables por admin/supervisor
pool.query(`
  CREATE TABLE IF NOT EXISTS departamentos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) UNIQUE NOT NULL
  )
`)
  .then(() => pool.query(`
    CREATE TABLE IF NOT EXISTS distritos (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(100) UNIQUE NOT NULL
    )
  `))
  .then(() => pool.query(`
    INSERT INTO departamentos (nombre)
    SELECT DISTINCT TRIM(departamento) FROM clientes
    WHERE departamento IS NOT NULL AND TRIM(departamento) <> ''
    ON CONFLICT (nombre) DO NOTHING
  `))
  .then(() => pool.query(`
    INSERT INTO distritos (nombre)
    SELECT DISTINCT TRIM(zona) FROM clientes
    WHERE zona IS NOT NULL AND TRIM(zona) <> ''
    ON CONFLICT (nombre) DO NOTHING
  `))
  .catch(() => {});

// Noticias/anuncios de admin y supervisor para repartidores y preventistas
pool.query(`
  CREATE TABLE IF NOT EXISTS anuncios (
    id SERIAL PRIMARY KEY,
    autor_id INTEGER NOT NULL REFERENCES usuarios(id),
    titulo VARCHAR(150),
    mensaje TEXT NOT NULL,
    tipo VARCHAR(20) NOT NULL DEFAULT 'info' CHECK (tipo IN ('info', 'oferta')),
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`).catch(() => {});

// Nuevo rol "supervisor": permite ese valor en el CHECK de usuarios.rol
pool.query(`ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check`)
  .then(() => pool.query(`
    ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check
      CHECK (rol IN ('admin', 'repartidor', 'preventista', 'supervisor'))
  `))
  .catch(() => {});

app.listen(PORT, () => {
  console.log(`Full Advance backend corriendo en http://localhost:${PORT}`);
});
