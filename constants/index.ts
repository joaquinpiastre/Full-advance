import { Platform } from 'react-native';
import { CategoriaCliente } from '../types';

// En producción (Vercel/EAS) se define EXPO_PUBLIC_API_URL apuntando al backend de Railway.
// En desarrollo: web accede al backend por localhost, y un dispositivo físico (Expo Go)
// necesita la IP local de tu PC en la red Wi-Fi.
// Si en algún momento usás el emulador de Android, cambiá esa entrada por http://10.0.2.2:3001.
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  Platform.select({
    web: 'http://localhost:3001',
    default: 'http://10.136.100.193:3001',
  });

// El backend devuelve las fotos como rutas relativas (ej: "/uploads/123-foto.jpg").
// Hay que anteponerles la URL del backend para que <Image> pueda cargarlas.
export const urlFoto = (uri?: string | null) =>
  !uri ? undefined : uri.startsWith('http') ? uri : `${API_URL}${uri}`;

export const COLORS = {
  primary: '#E31E24',       // Rojo Bimbo
  primaryDark: '#B0151A',
  secondary: '#003087',     // Azul Bimbo
  secondaryLight: '#1E4FA0',
  accent: '#F57C00',
  background: '#F4F6F9',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  text: '#111827',
  textLight: '#6B7280',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
  divider: '#EEF1F5',
  danger: '#DC2626',
  success: '#16A34A',
  warning: '#D97706',
  repartidor: '#003087',    // Azul Bimbo para repartidor
  preventista: '#7C3AED',
  supervisor: '#0D9488',
  ventaCaliente: '#EA580C',
};

// Tokens compartidos de diseño: radios, sombras y espaciados consistentes
export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const SHADOW = {
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  floating: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
} as const;

// Color por categoría de cliente (A = mayor importancia ... F = menor)
export const COLOR_CATEGORIA: Record<CategoriaCliente, string> = {
  A: '#16A34A', B: '#65A30D', C: '#D97706', D: '#F57C00', E: '#DC2626', F: '#6B7280',
};

export const GPS_INTERVAL_MS = 5000;
export const GPS_FEED_INTERVAL_MS = 3000;
export const STOP_RADIUS_M = 40;
export const STOP_MIN_SECONDS = 30;

export const TASK_GPS = 'background-gps-fulladvance';
