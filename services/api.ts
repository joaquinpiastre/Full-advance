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

export const crearUsuario = (data: { nombre: string; email: string; password: string; rol: string }) =>
  api.post('/auth/usuarios', data);

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

export const finalizarParada = (parada_id: number, nota?: string) =>
  api.post(`/paradas/${parada_id}/finalizar`, { nota });

export const obtenerParadas = (jornada_id: number) =>
  api.get(`/paradas?jornada_id=${jornada_id}`);

// Clientes
export const obtenerClientes = () =>
  api.get('/clientes');

export const crearCliente = (data: any) =>
  api.post('/clientes', data);

export const actualizarCliente = (id: number, data: any) =>
  api.put(`/clientes/${id}`, data);

export const actualizarCartillaCliente = (id: number, data: any) =>
  api.put(`/clientes/${id}/cartilla`, data);

// Rutas
export const obtenerRutas = () =>
  api.get('/rutas');

export const obtenerRuta = (id: number) =>
  api.get(`/rutas/${id}`);

export const crearRuta = (data: any) =>
  api.post('/rutas', data);

// Asignaciones
export const obtenerAsignacionHoy = () =>
  api.get('/asignaciones/hoy');

export const asignarRuta = (data: { usuario_id: number; ruta_id: number; fecha: string }) =>
  api.post('/asignaciones', data);

export const obtenerAsignaciones = () =>
  api.get('/asignaciones');

// Estadísticas
export const obtenerEstadisticasClientes = () =>
  api.get('/estadisticas/clientes');

// Historial
export const obtenerHistorialJornadas = (usuario_id?: number) =>
  api.get('/jornadas/historial', { params: { usuario_id } });

export const obtenerDetalleJornada = (jornada_id: number) =>
  api.get(`/jornadas/${jornada_id}/detalle`);
