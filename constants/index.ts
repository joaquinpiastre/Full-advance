import { Platform } from 'react-native';
import { CategoriaCliente } from '../types';

// Web accede al backend por localhost.
// Un dispositivo físico (Expo Go en el celular) necesita la IP local de tu PC en la red Wi-Fi.
// Si en algún momento usás el emulador de Android, cambiá esa entrada por http://10.0.2.2:3001.
export const API_URL = Platform.select({
  web: 'http://localhost:3001',
  default: 'http://192.168.1.157:3001',});

// El backend devuelve las fotos como rutas relativas (ej: "/uploads/123-foto.jpg").
// Hay que anteponerles la URL del backend para que <Image> pueda cargarlas.
export const urlFoto = (uri?: string | null) =>
  !uri ? undefined : uri.startsWith('http') ? uri : `${API_URL}${uri}`;

export const COLORS = {
  primary: '#1A3A5C',
  secondary: '#2E7D32',
  accent: '#F57C00',
  background: '#F5F7FA',
  card: '#FFFFFF',
  text: '#1A1A2E',
  textLight: '#6B7280',
  border: '#E5E7EB',
  danger: '#DC2626',
  success: '#16A34A',
  warning: '#D97706',
  repartidor: '#2196F3',
  preventista: '#9C27B0',
  ventaCaliente: '#EA580C',
};

// Color por categoría de cliente (A = mayor importancia ... F = menor)
export const COLOR_CATEGORIA: Record<CategoriaCliente, string> = {
  A: '#16A34A', B: '#65A30D', C: '#D97706', D: '#F57C00', E: '#DC2626', F: '#6B7280',
};

export const GPS_INTERVAL_MS = 5000;
export const GPS_FEED_INTERVAL_MS = 3000;
export const STOP_RADIUS_M = 40;
export const STOP_MIN_SECONDS = 30;

export const TASK_GPS = 'background-gps-fulladvance';
