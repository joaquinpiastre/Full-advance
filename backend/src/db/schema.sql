-- Full Advance - Schema

CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rol VARCHAR(20) NOT NULL CHECK (rol IN ('admin', 'repartidor', 'preventista', 'supervisor')),
  activo BOOLEAN DEFAULT true,
  horario_preferido VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clientes (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  direccion VARCHAR(255) NOT NULL,
  lat DOUBLE PRECISION DEFAULT 0,
  lng DOUBLE PRECISION DEFAULT 0,
  telefono VARCHAR(50),
  notas TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Cartilla de cliente: clasificación e información comercial completa.
  -- La categoría es de uso interno (la define el admin para priorizar la atención).
  categoria VARCHAR(1) CHECK (categoria IN ('A', 'B', 'C', 'D', 'E', 'F')),
  razon_social VARCHAR(150),
  cuit VARCHAR(50),
  rubro VARCHAR(100),
  email VARCHAR(150),
  contacto_nombre VARCHAR(100),
  horario_atencion VARCHAR(150),
  monto_compra_promedio DOUBLE PRECISION,
  frecuencia_compra VARCHAR(30),
  forma_pago VARCHAR(30),
  dia_visita_preferido VARCHAR(20),
  cartilla_actualizada_at TIMESTAMPTZ,
  zona VARCHAR(100),
  departamento VARCHAR(100),
  marcas TEXT[],
  numero_cliente VARCHAR(50)
);

-- Si la tabla ya existía de antes, sumamos las columnas de la cartilla.
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS categoria VARCHAR(1) CHECK (categoria IN ('A', 'B', 'C', 'D', 'E', 'F'));
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS razon_social VARCHAR(150);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cuit VARCHAR(50);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS rubro VARCHAR(100);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS email VARCHAR(150);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS contacto_nombre VARCHAR(100);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS horario_atencion VARCHAR(150);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS monto_compra_promedio DOUBLE PRECISION;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS frecuencia_compra VARCHAR(30);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS forma_pago VARCHAR(30);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS dia_visita_preferido VARCHAR(20);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cartilla_actualizada_at TIMESTAMPTZ;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS zona VARCHAR(100);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS departamento VARCHAR(100);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS marcas TEXT[];
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS numero_cliente VARCHAR(50);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS horario_preferido VARCHAR(100);

-- Listas de departamentos y distritos seleccionables para clasificar clientes.
-- Admin y supervisor pueden agregar nuevos valores desde la app.
CREATE TABLE IF NOT EXISTS departamentos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS distritos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  departamento_id INTEGER REFERENCES departamentos(id),
  UNIQUE(nombre, departamento_id)
);

-- Noticias/anuncios que admin y supervisor publican para repartidores y preventistas.
CREATE TABLE IF NOT EXISTS anuncios (
  id SERIAL PRIMARY KEY,
  autor_id INTEGER NOT NULL REFERENCES usuarios(id),
  titulo VARCHAR(150),
  mensaje TEXT NOT NULL,
  tipo VARCHAR(20) NOT NULL DEFAULT 'info' CHECK (tipo IN ('info', 'oferta')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tareas asignadas entre usuarios (preventista/supervisor/admin -> repartidor/preventista).
-- El asignado puede marcarla como realizada, lo que queda visible para quien la asignó
-- y para admin/supervisor en la sección de alertas.
CREATE TABLE IF NOT EXISTS tareas (
  id SERIAL PRIMARY KEY,
  autor_id INTEGER NOT NULL REFERENCES usuarios(id),
  asignado_id INTEGER NOT NULL REFERENCES usuarios(id),
  mensaje TEXT NOT NULL,
  completada BOOLEAN DEFAULT false,
  completada_at TIMESTAMPTZ,
  nota_completada TEXT,
  foto_uri VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Encuestas configurables por el admin: pregunta sí/no, opcionalmente
-- limitada a ciertas zonas (clientes.departamento). El preventista o
-- supervisor las responde al finalizar una visita.
CREATE TABLE IF NOT EXISTS encuestas (
  id SERIAL PRIMARY KEY,
  pregunta TEXT NOT NULL,
  activa BOOLEAN DEFAULT true,
  zonas TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS encuesta_respuestas (
  id SERIAL PRIMARY KEY,
  encuesta_id INTEGER NOT NULL REFERENCES encuestas(id) ON DELETE CASCADE,
  parada_id INTEGER NOT NULL REFERENCES paradas(id) ON DELETE CASCADE,
  cliente_id INTEGER REFERENCES clientes(id),
  respuesta BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(encuesta_id, parada_id)
);

CREATE TABLE IF NOT EXISTS rutas (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  descripcion TEXT,
  activa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cobranzas: preventistas/repartidores registran los pagos que reciben de
-- los clientes durante la visita. usuario_id es quien cargó el pago.
CREATE TABLE IF NOT EXISTS pagos (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  numero_cliente VARCHAR(50),
  fecha_pago DATE NOT NULL,
  fecha_emision_factura DATE,
  numero_factura VARCHAR(50),
  monto_a_cobrar DOUBLE PRECISION NOT NULL,
  monto_pagado DOUBLE PRECISION NOT NULL,
  metodo_pago VARCHAR(30) NOT NULL CHECK (metodo_pago IN (
    'efectivo', 'transferencia_hecha', 'transferencia_por_hacer', 'cuenta_corriente', 'cheque'
  )),
  numero_cheque VARCHAR(50),
  nota TEXT,
  comprobante_uri VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS comprobante_uri VARCHAR(255);

CREATE TABLE IF NOT EXISTS ruta_clientes (
  id SERIAL PRIMARY KEY,
  ruta_id INTEGER REFERENCES rutas(id) ON DELETE CASCADE,
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
  orden INTEGER DEFAULT 0
);

-- Registro de clientes quitados de una ruta (no se elimina al cliente de la
-- base, solo se lo saca de la ruta). Sirve como alerta para los admins: quién
-- lo quitó, de qué ruta y por qué motivo.
CREATE TABLE IF NOT EXISTS eliminaciones_ruta_cliente (
  id SERIAL PRIMARY KEY,
  ruta_id INTEGER REFERENCES rutas(id) ON DELETE CASCADE,
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
  usuario_id INTEGER REFERENCES usuarios(id),
  nota TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asignaciones (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER REFERENCES usuarios(id),
  ruta_id INTEGER REFERENCES rutas(id),
  fecha DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(usuario_id, fecha)
);

-- Rutas habilitadas para cada repartidor/preventista. Un usuario puede tener
-- varias rutas posibles; elige cuál hacer al iniciar la jornada (ver
-- selecciones_ruta). Si solo tiene una, se aplica automáticamente.
CREATE TABLE IF NOT EXISTS asignaciones_fijas (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  ruta_id INTEGER NOT NULL REFERENCES rutas(id),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(usuario_id, ruta_id)
);

-- Migración: si la base ya existía con UNIQUE(usuario_id), lo cambiamos a
-- UNIQUE(usuario_id, ruta_id) para permitir varias rutas por usuario.
ALTER TABLE asignaciones_fijas DROP CONSTRAINT IF EXISTS asignaciones_fijas_usuario_id_key;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'asignaciones_fijas_usuario_id_ruta_id_key'
  ) THEN
    ALTER TABLE asignaciones_fijas ADD CONSTRAINT asignaciones_fijas_usuario_id_ruta_id_key UNIQUE (usuario_id, ruta_id);
  END IF;
END $$;

-- Ruta elegida por el usuario para la semana en curso (lunes a domingo).
-- Se resetea automáticamente cada semana: el domingo a la noche cambia la
-- semana_inicio y el usuario debe elegir de nuevo al iniciar jornada.
CREATE TABLE IF NOT EXISTS selecciones_ruta (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  ruta_id INTEGER NOT NULL REFERENCES rutas(id),
  semana_inicio DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(usuario_id, semana_inicio)
);

CREATE TABLE IF NOT EXISTS jornadas (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER REFERENCES usuarios(id),
  fecha_inicio TIMESTAMPTZ DEFAULT NOW(),
  fecha_fin TIMESTAMPTZ,
  activa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gps_points (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER REFERENCES usuarios(id),
  jornada_id INTEGER REFERENCES jornadas(id),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  velocidad DOUBLE PRECISION DEFAULT 0,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gps_usuario ON gps_points(usuario_id);
CREATE INDEX IF NOT EXISTS idx_gps_jornada ON gps_points(jornada_id);
CREATE INDEX IF NOT EXISTS idx_gps_timestamp ON gps_points(timestamp DESC);

CREATE TABLE IF NOT EXISTS gps_live (
  usuario_id INTEGER PRIMARY KEY REFERENCES usuarios(id),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  velocidad DOUBLE PRECISION DEFAULT 0,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS paradas (
  id SERIAL PRIMARY KEY,
  jornada_id INTEGER REFERENCES jornadas(id),
  cliente_id INTEGER REFERENCES clientes(id),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  timestamp_llegada TIMESTAMPTZ DEFAULT NOW(),
  timestamp_salida TIMESTAMPTZ,
  foto1_uri VARCHAR(500),
  foto2_uri VARCHAR(500),
  foto3_uri VARCHAR(500),
  foto4_uri VARCHAR(500),
  foto5_uri VARCHAR(500),
  nota TEXT,
  completada BOOLEAN DEFAULT false
);

-- Calificaciones que el supervisor hace, al final de una visita de control,
-- sobre cómo el repartidor/preventista asignado a esa ruta atiende a ese
-- cliente. Visible para admin y supervisor.
CREATE TABLE IF NOT EXISTS calificaciones_visita (
  id SERIAL PRIMARY KEY,
  supervisor_id INTEGER NOT NULL REFERENCES usuarios(id),
  evaluado_id INTEGER NOT NULL REFERENCES usuarios(id),
  cliente_id INTEGER REFERENCES clientes(id),
  ruta_id INTEGER REFERENCES rutas(id),
  calificacion VARCHAR(20) NOT NULL CHECK (calificacion IN ('excelente','bueno','regular','malo','muy_malo')),
  comentario TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin por defecto (password: admin1234)
INSERT INTO usuarios (nombre, email, password_hash, rol)
VALUES ('Administrador', 'admin@fulladvance.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin')
ON CONFLICT (email) DO NOTHING;
