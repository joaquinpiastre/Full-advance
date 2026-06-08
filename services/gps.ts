import { Platform } from 'react-native';
import { enviarGps } from './api';
import { GPS_INTERVAL_MS } from '../constants';

let subscription: { remove: () => void } | null = null;

export const iniciarGps = async (jornada_id: number) => {
  if (Platform.OS === 'web') return;

  const Location = require('expo-location');

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return;

  (global as any).__jornadaId = jornada_id;

  if (subscription) {
    subscription.remove();
    subscription = null;
  }

  subscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: GPS_INTERVAL_MS,
      distanceInterval: 10,
    },
    async (location: any) => {
      const jornadaId = (global as any).__jornadaId;
      if (!jornadaId) return;
      try {
        await enviarGps({
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          jornada_id: jornadaId,
          velocidad: location.coords.speed ?? 0,
        });
      } catch {}
    }
  );
};

export const detenerGps = async () => {
  if (Platform.OS === 'web') return;
  (global as any).__jornadaId = null;
  if (subscription) {
    subscription.remove();
    subscription = null;
  }
};
