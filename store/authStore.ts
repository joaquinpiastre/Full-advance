import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Usuario } from '../types';

const DURACION_24H = 24 * 60 * 60 * 1000;

// Web: persiste en localStorage (cierra el navegador y sigue la sesión).
// Nativo: in-memory (la sesión dura mientras la app está abierta).
// AsyncStorage se agrega en una etapa posterior cuando se compile la app nativa definitiva.
const storage = typeof window !== 'undefined' && window.localStorage
  ? createJSONStorage(() => window.localStorage)
  : createJSONStorage(() => ({
      getItem: () => Promise.resolve(null),
      setItem: () => Promise.resolve(),
      removeItem: () => Promise.resolve(),
    }));

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
      storage,
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (state.loginAt && Date.now() - state.loginAt > DURACION_24H) {
          state.logout();
        }
      },
    }
  )
);
