import axios from 'axios';
import { API_URL } from '../constants';
import { useAuthStore } from '../store/authStore';

const api = axios.create({ baseURL: API_URL, timeout: 15000 });

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

// Jornadas activas del equipo (repartidores/preventistas), para el panel
// de seguimiento en vivo del supervisor
export const obtenerJornadasActivas = () =>
  api.get('/jornadas/activas');

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
    timeout: 30000,
  });

export const subirFotoReferenciaCliente = (cliente_id: number, foto: FormData) =>
  api.post(`/clientes/${cliente_id}/foto-referencia`, foto, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000,
  });

export const finalizarParada = (parada_id: number, data?: {
  nota?: string;
  tiene_vencidos?: boolean;
  mercaderia_vencida?: string | null;
  fecha_vencimiento?: string | null;
  nota_vencido?: string | null;
  urgente?: boolean;
  urgencia_descripcion?: string | null;
  oportunidades?: string | null;
  accion_requerida?: string | null;
  respeta_pvp?: boolean | null;
  motivo_no_pvp?: string | null;
}) => api.post(`/paradas/${parada_id}/finalizar`, data ?? {});

export const obtenerParadas = (jornada_id: number) =>
  api.get(`/paradas?jornada_id=${jornada_id}`);

// Clientes
export const obtenerClientes = (estado?: 'activos' | 'inactivos' | 'todos') =>
  api.get('/clientes', { params: estado ? { estado } : undefined });

export const crearCliente = (data: any) =>
  api.post('/clientes', data);

export const actualizarCliente = (id: number, data: any) =>
  api.put(`/clientes/${id}`, data);

export const cambiarEstadoCliente = (id: number, activo: boolean) =>
  api.patch(`/clientes/${id}/estado`, { activo });

export const actualizarCoordenadas = (id: number, lat: number, lng: number) =>
  api.patch(`/clientes/${id}/coords`, { lat, lng });

// Zonas (departamentos y distritos seleccionables)
export const obtenerDepartamentos = () =>
  api.get('/zonas/departamentos');

export const crearDepartamento = (nombre: string) =>
  api.post('/zonas/departamentos', { nombre });

export const obtenerDistritos = (departamento_id?: number) =>
  api.get('/zonas/distritos', { params: departamento_id ? { departamento_id } : undefined });

export const crearDistrito = (nombre: string, departamento_id?: number | null) =>
  api.post('/zonas/distritos', { nombre, departamento_id: departamento_id ?? null });

// Rutas
export const obtenerRutas = () =>
  api.get('/rutas');

export const obtenerRuta = (id: number) =>
  api.get(`/rutas/${id}`);

export const crearRuta = (data: any) =>
  api.post('/rutas', data);

export const actualizarRuta = (id: number, data: any) =>
  api.put(`/rutas/${id}`, data);

export const actualizarOrdenRuta = (id: number, clientes: number[]) =>
  api.put(`/rutas/${id}/orden`, { clientes });

export const eliminarRuta = (id: number) =>
  api.delete(`/rutas/${id}`);

export const quitarClienteDeRuta = (rutaId: number, clienteId: number, nota: string) =>
  api.delete(`/rutas/${rutaId}/clientes/${clienteId}`, { data: { nota } });

export const obtenerEliminacionesRuta = () =>
  api.get('/rutas/eliminaciones');

// Asignaciones
export const obtenerAsignacionHoy = () =>
  api.get('/asignaciones/hoy');

export const asignarRuta = (data: { usuario_id: number; ruta_id: number; fecha: string }) =>
  api.post('/asignaciones', data);

export const obtenerAsignaciones = () =>
  api.get('/asignaciones');

export const eliminarAsignacion = (id: number) =>
  api.delete(`/asignaciones/${id}`);

// Rutas fijas (rutas habilitadas para un usuario, puede tener varias)
export const obtenerAsignacionesFijas = () =>
  api.get('/asignaciones/fijas');

export const guardarAsignacionFija = (usuario_id: number, ruta_id: number) =>
  api.put(`/asignaciones/fijas/${usuario_id}`, { ruta_id });

export const eliminarAsignacionFija = (usuario_id: number, ruta_id: number) =>
  api.delete(`/asignaciones/fijas/${usuario_id}/${ruta_id}`);

// Rutas habilitadas para el usuario autenticado + cuál eligió esta semana
export const obtenerRutasDisponibles = () =>
  api.get('/asignaciones/rutas-disponibles');

export const elegirRuta = (ruta_id: number) =>
  api.post('/asignaciones/elegir', { ruta_id });

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

// Noticias / anuncios (admin y supervisor publican, todos pueden ver)
export const obtenerAnuncios = () =>
  api.get('/anuncios');

export const crearAnuncio = (data: { titulo?: string; mensaje: string; tipo: 'info' | 'oferta' }) =>
  api.post('/anuncios', data);

export const eliminarAnuncio = (id: number) =>
  api.delete(`/anuncios/${id}`);

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
