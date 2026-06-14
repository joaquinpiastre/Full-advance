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
import tareasRouter from './routes/tareas';
import calificacionesRouter from './routes/calificaciones';

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
app.use('/tareas', tareasRouter);
app.use('/calificaciones', calificacionesRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok', app: 'Full Advance' }));

// Crea la tabla de rutas fijas si no existe (migración automática al arrancar)
pool.query(`
  CREATE TABLE IF NOT EXISTS asignaciones_fijas (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    ruta_id INTEGER NOT NULL REFERENCES rutas(id),
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(usuario_id, ruta_id)
  )
`).catch(() => {});

// Un usuario puede tener varias rutas habilitadas: reemplaza la restricción
// vieja (una sola ruta por usuario) por una de (usuario_id, ruta_id).
pool.query(`ALTER TABLE asignaciones_fijas DROP CONSTRAINT IF EXISTS asignaciones_fijas_usuario_id_key`)
  .then(() => pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'asignaciones_fijas_usuario_id_ruta_id_key'
      ) THEN
        ALTER TABLE asignaciones_fijas ADD CONSTRAINT asignaciones_fijas_usuario_id_ruta_id_key UNIQUE (usuario_id, ruta_id);
      END IF;
    END $$;
  `))
  .catch(() => {});

// Ruta elegida por el usuario para la semana en curso (se resetea cada semana).
pool.query(`
  CREATE TABLE IF NOT EXISTS selecciones_ruta (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    ruta_id INTEGER NOT NULL REFERENCES rutas(id),
    semana_inicio DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(usuario_id, semana_inicio)
  )
`).catch(() => {});

// Historial de clientes quitados de una ruta (para alertas del admin).
pool.query(`
  CREATE TABLE IF NOT EXISTS eliminaciones_ruta_cliente (
    id SERIAL PRIMARY KEY,
    ruta_id INTEGER REFERENCES rutas(id) ON DELETE CASCADE,
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
    usuario_id INTEGER REFERENCES usuarios(id),
    nota TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`).catch(() => {});

// Marcas que distribuye el cliente (BIMBO, CITRIC, SANAS, ARRABAL)
pool.query(`
  ALTER TABLE clientes ADD COLUMN IF NOT EXISTS marcas TEXT[]
`).catch(() => {});

// Número de cliente (opcional, asignado por el admin/empresa)
pool.query(`
  ALTER TABLE clientes ADD COLUMN IF NOT EXISTS numero_cliente VARCHAR(50)
`).catch(() => {});

// Columnas del flujo preventista en paradas
pool.query(`
  ALTER TABLE clientes
    ADD COLUMN IF NOT EXISTS material_exhibicion TEXT,
    ADD COLUMN IF NOT EXISTS tipo_comercio VARCHAR(100)
`).catch(() => {});

// Activar/desactivar clientes (soft delete)
pool.query(`
  ALTER TABLE clientes ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT true
`).catch(() => {});

// Foto de referencia del local, para guiar a quien visite al cliente
pool.query(`
  ALTER TABLE clientes ADD COLUMN IF NOT EXISTS foto_referencia_uri VARCHAR(500)
`).catch(() => {});

// Nota adicional sobre la mercadería vencida / por vencer
pool.query(`
  ALTER TABLE paradas ADD COLUMN IF NOT EXISTS nota_vencido TEXT
`).catch(() => {});

// Oportunidades detectadas durante la visita (reemplaza al informe de precio)
pool.query(`
  ALTER TABLE paradas ADD COLUMN IF NOT EXISTS oportunidades TEXT
`).catch(() => {});

// Si el cliente respeta el PVP (precio de venta público) y, si no, por qué
pool.query(`
  ALTER TABLE paradas ADD COLUMN IF NOT EXISTS respeta_pvp BOOLEAN
`).catch(() => {});
pool.query(`
  ALTER TABLE paradas ADD COLUMN IF NOT EXISTS motivo_no_pvp TEXT
`).catch(() => {});

// Encuesta: si el cliente le compra a COMERCO (la pregunta el preventista al visitar).
pool.query(`
  ALTER TABLE paradas ADD COLUMN IF NOT EXISTS compra_comerco BOOLEAN
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

// Listas de departamentos y distritos seleccionables, ampliables por admin/supervisor.
// Los distritos pertenecen a un departamento: al elegir un departamento en la app
// se muestran solo los distritos de ese departamento.
const DEPARTAMENTOS_INICIALES: { nombre: string; distritos: string[] }[] = [
  {
    nombre: 'San Rafael',
    distritos: [
      '9 de Julio / Los Sauces', 'Alvear', 'Av. Moreno', 'Ballofet', 'Centro',
      'El Cerrito', 'H. Yrigoyen de Este a Oeste', 'Malargüe', 'Mitre',
      'Rama Caída y Cuadro Benegas', 'Rama Caída y Valle Grande',
      'Sarmiento, Alberdi, P. Vargas', 'Yrigoyen, Rivadavia, Iselin', 'Zapata',
    ],
  },
  {
    nombre: 'Alvear',
    distritos: ['Alvear', 'Ballofet'],
  },
  {
    nombre: 'Malargüe',
    distritos: ['Av. Moreno', 'Malargüe', 'Yrigoyen, Rivadavia, Iselin'],
  },
];

pool.query(`
  CREATE TABLE IF NOT EXISTS departamentos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) UNIQUE NOT NULL
  )
`)
  .then(() => pool.query(`
    CREATE TABLE IF NOT EXISTS distritos (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL,
      departamento_id INTEGER REFERENCES departamentos(id),
      UNIQUE(nombre, departamento_id)
    )
  `))
  // Migración para bases existentes: agregar departamento_id y ajustar el UNIQUE.
  .then(() => pool.query(`
    ALTER TABLE distritos ADD COLUMN IF NOT EXISTS departamento_id INTEGER REFERENCES departamentos(id)
  `))
  .then(() => pool.query(`
    ALTER TABLE distritos DROP CONSTRAINT IF EXISTS distritos_nombre_key
  `))
  .then(() => pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'distritos_nombre_departamento_id_key'
      ) THEN
        ALTER TABLE distritos ADD CONSTRAINT distritos_nombre_departamento_id_key UNIQUE (nombre, departamento_id);
      END IF;
    END $$;
  `))
  // Reemplazo único de la lista de departamentos/distritos por San Rafael, Alvear y Malargüe
  // (con sus distritos), basado en los datos de clientes existentes. Solo corre una vez.
  .then(() => pool.query(`SELECT COUNT(*)::int AS c FROM distritos WHERE departamento_id IS NOT NULL`))
  .then(async ({ rows }) => {
    if (rows[0].c > 0) return;
    await pool.query('DELETE FROM distritos');
    await pool.query('DELETE FROM departamentos');
    for (const dep of DEPARTAMENTOS_INICIALES) {
      const { rows: depRows } = await pool.query(
        `INSERT INTO departamentos (nombre) VALUES ($1)
         ON CONFLICT (nombre) DO UPDATE SET nombre=EXCLUDED.nombre
         RETURNING id`,
        [dep.nombre]
      );
      for (const distrito of dep.distritos) {
        await pool.query(
          `INSERT INTO distritos (nombre, departamento_id) VALUES ($1, $2)
           ON CONFLICT (nombre, departamento_id) DO NOTHING`,
          [distrito, depRows[0].id]
        );
      }
    }
  })
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

// Tareas asignadas entre usuarios (preventista/supervisor/admin -> repartidor/preventista)
pool.query(`
  CREATE TABLE IF NOT EXISTS tareas (
    id SERIAL PRIMARY KEY,
    autor_id INTEGER NOT NULL REFERENCES usuarios(id),
    asignado_id INTEGER NOT NULL REFERENCES usuarios(id),
    mensaje TEXT NOT NULL,
    completada BOOLEAN DEFAULT false,
    completada_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`).catch(() => {});

// Calificaciones que el supervisor hace, al final de una visita de control,
// sobre cómo el repartidor/preventista atiende a un cliente de su ruta.
pool.query(`
  CREATE TABLE IF NOT EXISTS calificaciones_visita (
    id SERIAL PRIMARY KEY,
    supervisor_id INTEGER NOT NULL REFERENCES usuarios(id),
    evaluado_id INTEGER NOT NULL REFERENCES usuarios(id),
    cliente_id INTEGER REFERENCES clientes(id),
    ruta_id INTEGER REFERENCES rutas(id),
    calificacion VARCHAR(20) NOT NULL CHECK (calificacion IN ('excelente','bueno','regular','malo','muy_malo')),
    comentario TEXT,
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
