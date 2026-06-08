import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/authStore';

export default function Index() {
  const { usuario } = useAuthStore();

  if (!usuario) return <Redirect href="/(auth)/login" />;
  if (usuario.rol === 'admin') return <Redirect href="/(admin)" />;
  if (usuario.rol === 'repartidor') return <Redirect href="/(repartidor)" />;
  if (usuario.rol === 'preventista') return <Redirect href="/(preventista)" />;

  return <Redirect href="/(auth)/login" />;
}
