import { create } from 'zustand';
import { Jornada, Parada } from '../types';

interface JornadaState {
  jornada: Jornada | null;
  paradaActual: Parada | null;
  setJornada: (jornada: Jornada | null) => void;
  setParadaActual: (parada: Parada | null) => void;
}

export const useJornadaStore = create<JornadaState>((set) => ({
  jornada: null,
  paradaActual: null,
  setJornada: (jornada) => set({ jornada }),
  setParadaActual: (parada) => set({ paradaActual: parada }),
}));
