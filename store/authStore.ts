import { create } from 'zustand';
import { Usuario } from '../types';

interface AuthState {
  usuario: Usuario | null;
  token: string | null;
  setUsuario: (usuario: Usuario, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  usuario: null,
  token: null,
  setUsuario: (usuario, token) => set({ usuario, token }),
  logout: () => set({ usuario: null, token: null }),
}));
