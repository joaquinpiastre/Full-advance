import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Jornada, Parada } from '../types';
import { sessionStorage } from './sessionStorage';

// 'iniciando' | 'finalizando': hay una llamada al servidor reintentándose en
// segundo plano (mala señal al iniciar/finalizar jornada). Se persiste para
// poder retomar el reintento si se cierra la app mientras esperaba conexión.
type Sincronizando = 'iniciando' | 'finalizando' | null;

interface JornadaState {
  jornada: Jornada | null;
  paradaActual: Parada | null;
  sincronizando: Sincronizando;
  setJornada: (jornada: Jornada | null) => void;
  setParadaActual: (parada: Parada | null) => void;
  setSincronizando: (estado: Sincronizando) => void;
}

export const useJornadaStore = create<JornadaState>()(
  persist(
    (set) => ({
      jornada: null,
      paradaActual: null,
      sincronizando: null,
      setJornada: (jornada) => set({ jornada }),
      setParadaActual: (parada) => set({ paradaActual: parada }),
      setSincronizando: (estado) => set({ sincronizando: estado }),
    }),
    {
      name: 'jornada-session',
      storage: sessionStorage,
      // paradaActual es volátil (fotos en curso con URIs locales) — no se
      // persiste, solo la jornada y el estado de sincronización pendiente.
      partialize: (state) => ({ jornada: state.jornada, sincronizando: state.sincronizando }),
    }
  )
);
