import { Stack } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { Redirect } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(admin)" />
      <Stack.Screen name="(repartidor)" />
      <Stack.Screen name="(preventista)" />
    </Stack>
  );
}
