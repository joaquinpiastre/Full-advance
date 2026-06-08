import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

// En nativo usamos AsyncStorage (persistencia en el dispositivo).
export const sessionStorage = createJSONStorage(() => AsyncStorage);
