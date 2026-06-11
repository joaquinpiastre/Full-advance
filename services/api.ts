import axios from 'axios';
import { API_URL } from '../constants';
import { useAuthStore } from '../store/authStore';

const api = axios.create({ baseURL: API_URL, timeout: 8000 });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;

// Auth
export const login = (email: string, password: string) =>
  api.post('/auth/login', { email, password });

export const obtenerUsuarios = () =>
  api.get('/auth/usuarios');

export const crearUsuario = (data: { nombre: string; email: string; password: string; rol: string; horario_preferido?: string }) =>
  api.post('/auth/usuarios', data);

export const actualizarUsuario = (id: number, data: { nombre: string; email: string; rol: string; horario_preferido?: string; password?: string }) =>
  api.put(`/auth/usuarios/${id}`, data);

export const eliminarUsuario = (id: number) =>
  api.delete(`/auth/usuarios/${id}`);

// GPS
export const enviarGps = (data: { lat: number; lng: number; jornada_id: number; velocidad?: number }) =>
  api.post('/gps/update', data);

export const obtenerUbicacionesLive = () =>
  api.get('/gps/live');

// Jornadas
export const iniciarJornada = () =>
  api.post('/jornadas/iniciar');

export const finalizarJornada = (jornada_id: number) =>
  api.post(`/jornadas/${jornada_id}/finalizar`);

export const obtenerJornadaActiva = () =>
  api.get('/jornadas/activa');

// Paradas
export const registrarParada = (data: {
  jornada_id: number;
  lat: number;
  lng: number;
  cliente_id?: number;
}) => api.post('/paradas', data);

export const subirFoto = (parada_id: number, foto: FormData) =>
  api.post(`/paradas/${parada_id}/foto`, foto, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const finalizarParada = (parada_id: number, data?: {
  nota?: string;
  tiene_vencidos?: boolean;
  mercaderia_vencida?: string | null;
  fecha_vencimiento?: string | null;
  urgente?: boolean;
  urgencia_descripcion?: string | null;
  producto_informe?: string | null;
  precio_informe?: string | null;
}) => api.post(`/paradas/${parada_id}/finalizar`, data ?? {});

export const obtenerParadas = (jornada_id: number) =>
  api.get(`/paradas?jornada_id=${jornada_id}`);

// Clientes
export const obtenerClientes = () =>
  api.get('/clientes');

export const crearCliente = (data: any) =>
  api.post('/clientes', data);

export const actualizarCliente = (id: number, data: any) =>
  api.put(`/clientes/${id}`, data);

export const actualizarCoordenadas = (id: number, lat: number, lng: number) =>
  api.patch(`/clientes/${id}/coords`, { lat, lng });

// Rutas
export const obtenerRutas = () =>
  api.get('/rutas');

export const obtenerRuta = (id: number) =>
  api.get(`/rutas/${id}`);

export const crearRuta = (data: any) =>
  api.post('/rutas', data);

export const actualizarRuta = (id: number, data: any) =>
  api.put(`/rutas/${id}`, data);

// Asignaciones
export const obtenerAsignacionHoy = () =>
  api.get('/asignaciones/hoy');

export const asignarRuta = (data: { usuario_id: number; ruta_id: number; fecha: string }) =>
  api.post('/asignaciones', data);

export const obtenerAsignaciones = () =>
  api.get('/asignaciones');

// Rutas fijas (asignación permanente que se aplica automáticamente cada día)
export const obtenerAsignacionesFijas = () =>
  api.get('/asignaciones/fijas');

export const guardarAsignacionFija = (usuario_id: number, ruta_id: number) =>
  api.put(`/asignaciones/fijas/${usuario_id}`, { ruta_id });

export const eliminarAsignacionFija = (usuario_id: number) =>
  api.delete(`/asignaciones/fijas/${usuario_id}`);

// Alertas admin (paradas con urgente o vencidos, últimos 7 días)
export const obtenerAlertas = () =>
  api.get('/paradas/alertas');

// Ventas Calientes
export const obtenerVentaCalienteActiva = () =>
  api.get('/ventas-calientes/activa');

export const crearVentaCaliente = (ruta_id: number) =>
  api.post('/ventas-calientes', { ruta_id });

export const unirseVentaCaliente = (codigo: string) =>
  api.post('/ventas-calientes/unirse', { codigo });

export const obtenerVentaCaliente = (id: number) =>
  api.get(`/ventas-calientes/${id}`);

export const iniciarVisitaVC = (vc_id: number, data: { cliente_id: number; lat: number; lng: number }) =>
  api.post(`/ventas-calientes/${vc_id}/visitas`, data);

export const finalizarVentaCaliente = (id: number) =>
  api.patch(`/ventas-calientes/${id}/finalizar`);

export const obtenerVentasCalientesAdmin = (usuario_id?: number) =>
  api.get('/ventas-calientes', { params: usuario_id ? { usuario_id } : {} });

// Estadísticas
export const obtenerEstadisticasClientes = () =>
  api.get('/estadisticas/clientes');

// Historial
export const obtenerHistorialJornadas = (usuario_id?: number) =>
  api.get('/jornadas/historial', { params: { usuario_id } });

export const obtenerDetalleJornada = (jornada_id: number) =>
  api.get(`/jornadas/${jornada_id}/detalle`);
