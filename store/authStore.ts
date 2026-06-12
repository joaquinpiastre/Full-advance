import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Usuario } from '../types';
import { sessionStorage } from './sessionStorage';

const DURACION_SESION = 8 * 60 * 60 * 1000; // 8 horas

interface AuthState {
  usuario: Usuario | null;
  token: string | null;
  loginAt: number | null;
  setUsuario: (usuario: Usuario, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      usuario: null,
      token: null,
      loginAt: null,
      setUsuario: (usuario, token) => set({ usuario, token, loginAt: Date.now() }),
      logout: () => set({ usuario: null, token: null, loginAt: null }),
    }),
    {
      name: 'auth-session',
      storage: sessionStorage,
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (state.loginAt && Date.now() - state.loginAt > DURACION_SESION) {
          state.logout();
        }
      },
    }
  )
);
