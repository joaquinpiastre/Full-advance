export type Rol = 'admin' | 'repartidor' | 'preventista' | 'supervisor';

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
  activo?: boolean;
  horario_preferido?: string | null;
  token?: string;
}

export type CategoriaCliente = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export interface Cliente {
  id: number;
  nombre: string;
  numero_cliente?: string;
  direccion: string;
  lat: number;
  lng: number;
  telefono?: string;
  notas?: string;
  // Cartilla de cliente
  categoria?: CategoriaCliente;
  razon_social?: string;
  cuit?: string;
  rubro?: string;
  email?: string;
  contacto_nombre?: string;
  horario_atencion?: string;
  monto_compra_promedio?: number;
  frecuencia_compra?: string;
  forma_pago?: string;
  dia_visita_preferido?: string;
  cartilla_actualizada_at?: string;
  zona?: string;
  departamento?: string;
  material_exhibicion?: string;
  tipo_comercio?: string;
  marcas?: string[];
  ruta_id?: number;
  ruta_nombre?: string;
  activo?: boolean;
  foto_referencia_uri?: string;
}

export interface Zona {
  id: number;
  nombre: string;
}

export interface Ruta {
  id: number;
  nombre: string;
  descripcion?: string;
  clientes: ClienteRuta[];
}

export interface ClienteRuta {
  id: number;
  cliente_id: number;
  ruta_id: number;
  orden: number;
  cliente: Cliente;
}

export interface Asignacion {
  id: number;
  usuario_id: number;
  ruta_id: number;
  fecha: string;
  usuario?: Usuario;
  ruta?: Ruta;
}

export interface Jornada {
  id: number;
  usuario_id: number;
  fecha_inicio: string;
  fecha_fin?: string;
  activa: boolean;
  usuario?: Usuario;
}

export interface GpsPoint {
  id: number;
  usuario_id: number;
  jornada_id: number;
  lat: number;
  lng: number;
  velocidad?: number;
  timestamp: string;
}

export interface Parada {
  id: number;
  jornada_id: number;
  cliente_id?: number;
  lat: number;
  lng: number;
  timestamp_llegada: string;
  timestamp_salida?: string;
  foto1_uri?: string;
  foto2_uri?: string;
  foto3_uri?: string;
  foto4_uri?: string;
  foto5_uri?: string;
  nota?: string;
  completada: boolean;
  cliente?: Cliente;
  // Campos preventista
  tiene_vencidos?: boolean;
  mercaderia_vencida?: string;
  fecha_vencimiento?: string;
  nota_vencido?: string;
  urgente?: boolean;
  urgencia_descripcion?: string;
  accion_requerida?: string;
  oportunidades?: string;
  respeta_pvp?: boolean;
  motivo_no_pvp?: string;
}

export interface Alerta {
  id: number;
  urgente: boolean;
  urgencia_descripcion?: string;
  tiene_vencidos: boolean;
  mercaderia_vencida?: string;
  fecha_vencimiento?: string;
  nota_vencido?: string;
  accion_requerida?: string;
  timestamp_salida: string;
  nota?: string;
  cliente: { id: number; nombre: string; direccion: string; telefono?: string };
  usuario: { nombre: string; rol: Rol };
}

export interface EliminacionRuta {
  id: number;
  nota: string;
  created_at: string;
  ruta: { id: number; nombre: string };
  cliente: { id: number; nombre: string; direccion?: string };
  usuario: { id: number; nombre: string; rol: Rol };
}

export interface Anuncio {
  id: number;
  titulo?: string;
  mensaje: string;
  tipo: 'info' | 'oferta';
  autor_id: number;
  autor_nombre: string;
  autor_rol: Rol;
  created_at: string;
}

export interface Tarea {
  id: number;
  autor_id: number;
  asignado_id: number;
  mensaje: string;
  completada: boolean;
  completada_at?: string;
  created_at: string;
  autor_nombre?: string;
  autor_rol?: Rol;
  asignado_nombre?: string;
  asignado_rol?: Rol;
}

export interface UbicacionLive {
  usuario_id: number;
  nombre: string;
  rol: Rol;
  lat: number;
  lng: number;
  timestamp: string;
  activo: boolean;
}

export interface JornadaActiva {
  jornada_id: number;
  fecha_inicio: string;
  usuario_id: number;
  usuario_nombre: string;
  usuario_rol: Rol;
  paradas_completadas: number;
  lat?: number;
  lng?: number;
  gps_timestamp?: string;
  gps_activo: boolean;
  ruta: { id: number; nombre: string; total: number } | null;
}

export type Calificacion = 'excelente' | 'bueno' | 'regular' | 'malo' | 'muy_malo';

export const CALIFICACION_LABEL: Record<Calificacion, string> = {
  excelente: 'Excelente',
  bueno: 'Bueno',
  regular: 'Regular',
  malo: 'Malo',
  muy_malo: 'Muy malo',
};

export const CALIFICACION_COLOR: Record<Calificacion, string> = {
  excelente: '#16A34A',
  bueno: '#65A30D',
  regular: '#F59E0B',
  malo: '#EA580C',
  muy_malo: '#DC2626',
};

export interface CalificacionVisita {
  id: number;
  supervisor_id: number;
  evaluado_id: number;
  cliente_id: number | null;
  ruta_id: number | null;
  calificacion: Calificacion;
  comentario?: string | null;
  created_at: string;
  supervisor_nombre?: string;
  evaluado_nombre?: string;
  evaluado_rol?: Rol;
  cliente_nombre?: string;
  cliente_dir?: string;
  ruta_nombre?: string;
}
