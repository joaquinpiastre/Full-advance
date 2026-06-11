export type Rol = 'admin' | 'repartidor' | 'preventista';

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
  ruta_id?: number;
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
  urgente?: boolean;
  urgencia_descripcion?: string;
}

export interface Alerta {
  id: number;
  urgente: boolean;
  urgencia_descripcion?: string;
  tiene_vencidos: boolean;
  mercaderia_vencida?: string;
  fecha_vencimiento?: string;
  timestamp_salida: string;
  nota?: string;
  cliente: { id: number; nombre: string; direccion: string; telefono?: string };
  usuario: { nombre: string; rol: Rol };
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
