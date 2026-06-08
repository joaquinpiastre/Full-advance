import { obtenerUbicacionesLive } from './api';
import { UbicacionLive } from '../types';
import { GPS_FEED_INTERVAL_MS } from '../constants';

type Listener = (ubicaciones: UbicacionLive[]) => void;

let intervalo: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<Listener>();

const fetchYNotificar = async () => {
  try {
    const res = await obtenerUbicacionesLive();
    listeners.forEach((l) => l(res.data));
  } catch {}
};

export const suscribirUbicaciones = (listener: Listener) => {
  listeners.add(listener);
  if (!intervalo) {
    fetchYNotificar();
    intervalo = setInterval(fetchYNotificar, GPS_FEED_INTERVAL_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && intervalo) {
      clearInterval(intervalo);
      intervalo = null;
    }
  };
};
