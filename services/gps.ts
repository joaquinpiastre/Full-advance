import { Platform } from 'react-native';
import { enviarGps } from './api';
import { TASK_GPS, GPS_INTERVAL_MS } from '../constants';

// expo-task-manager and expo-location background tasks are native-only
if (Platform.OS !== 'web') {
  const Location = require('expo-location');
  const TaskManager = require('expo-task-manager');

  TaskManager.defineTask(TASK_GPS, async ({ data, error }: any) => {
    if (error || !data?.locations?.length) return;
    const { latitude, longitude, speed } = data.locations[0].coords;
    const jornada_id = (global as any).__jornadaId;
    if (!jornada_id) return;
    try {
      await enviarGps({ lat: latitude, lng: longitude, jornada_id, velocidad: speed ?? 0 });
    } catch {}
  });
}

export const iniciarGps = async (jornada_id: number) => {
  if (Platform.OS === 'web') return;

  const Location = require('expo-location');
  (global as any).__jornadaId = jornada_id;

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new Error('Permiso de ubicación denegado');

  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== 'granted') throw new Error('Permiso de ubicación en segundo plano denegado');

  const running = await Location.hasStartedLocationUpdatesAsync(TASK_GPS).catch(() => false);
  if (!running) {
    await Location.startLocationUpdatesAsync(TASK_GPS, {
      accuracy: Location.Accuracy.High,
      timeInterval: GPS_INTERVAL_MS,
      distanceInterval: 10,
      foregroundService: {
        notificationTitle: 'Full Advance',
        notificationBody: 'Seguimiento de ruta activo',
        notificationColor: '#1A3A5C',
      },
      showsBackgroundLocationIndicator: true,
    });
  }
};

export const detenerGps = async () => {
  if (Platform.OS === 'web') return;

  const Location = require('expo-location');
  (global as any).__jornadaId = null;
  const running = await Location.hasStartedLocationUpdatesAsync(TASK_GPS).catch(() => false);
  if (running) await Location.stopLocationUpdatesAsync(TASK_GPS);
};
