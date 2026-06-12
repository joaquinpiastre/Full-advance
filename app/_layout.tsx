import '../utils/alertPolyfill';
import { Stack } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { Redirect } from 'expo-router';
import { iniciarSincronizacionAutomatica } from '../services/offlineVisitas';

iniciarSincronizacionAutomatica();

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(admin)" />
      <Stack.Screen name="(repartidor)" />
      <Stack.Screen name="(preventista)" />
      <Stack.Screen name="(supervisor)" />
    </Stack>
  );
}
