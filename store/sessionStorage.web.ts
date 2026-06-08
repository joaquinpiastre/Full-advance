import { createJSONStorage } from 'zustand/middleware';

// En web usamos localStorage (síncrono, sin dependencias nativas).
export const sessionStorage = createJSONStorage(() => localStorage);
