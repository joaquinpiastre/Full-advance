import { Platform } from 'react-native';

// Web e iOS Simulator acceden al backend por localhost.
// El emulador de Android mapea 10.0.2.2 al localhost de la PC.
// En un dispositivo físico, cambiá esto por la IP local de tu PC en la red (ej: http://192.168.1.X:3001).
export const API_URL = Platform.select({
  web: 'http://localhost:3001',
  android: 'http://10.0.2.2:3001',
  default: 'http://localhost:3001',
});

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
};

export const GPS_INTERVAL_MS = 5000;
export const GPS_FEED_INTERVAL_MS = 3000;
export const STOP_RADIUS_M = 40;
export const STOP_MIN_SECONDS = 30;

export const TASK_GPS = 'background-gps-fulladvance';
