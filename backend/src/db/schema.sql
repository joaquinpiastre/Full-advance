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
  departamento VARCHAR(100)
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
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS horario_preferido VARCHAR(100);

-- Listas de departamentos y distritos seleccionables para clasificar clientes.
-- Admin y supervisor pueden agregar nuevos valores desde la app.
CREATE TABLE IF NOT EXISTS departamentos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS distritos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS rutas (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  descripcion TEXT,
  activa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ruta_clientes (
  id SERIAL PRIMARY KEY,
  ruta_id INTEGER REFERENCES rutas(id) ON DELETE CASCADE,
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
  orden INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS asignaciones (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER REFERENCES usuarios(id),
  ruta_id INTEGER REFERENCES rutas(id),
  fecha DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(usuario_id, fecha)
);

-- Ruta permanente de cada repartidor/preventista, se aplica automáticamente cada día
-- si no hay una asignación manual para esa fecha.
CREATE TABLE IF NOT EXISTS asignaciones_fijas (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  ruta_id INTEGER NOT NULL REFERENCES rutas(id),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(usuario_id)
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

-- Admin por defecto (password: admin1234)
INSERT INTO usuarios (nombre, email, password_hash, rol)
VALUES ('Administrador', 'admin@fulladvance.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin')
ON CONFLICT (email) DO NOTHING;
