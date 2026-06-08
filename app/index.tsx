import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { COLORS } from '../constants';

export default function Index() {
  const { usuario } = useAuthStore();
  const [listo, setListo] = useState(useAuthStore.persist.hasHydrated());

  useEffect(() => {
    if (listo) return;
    // Espera la rehidratación desde AsyncStorage (solo nativo; en web es inmediata).
    const unsub = useAuthStore.persist.onFinishHydration(() => setListo(true));
    // Fallback: si algo falla, no nos quedamos en blanco para siempre.
    const t = setTimeout(() => setListo(true), 800);
    return () => { unsub(); clearTimeout(t); };
  }, []);

  if (!listo) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!usuario) return <Redirect href="/(auth)/login" />;
  if (usuario.rol === 'admin') return <Redirect href="/(admin)" />;
  if (usuario.rol === 'repartidor') return <Redirect href="/(repartidor)" />;
  if (usuario.rol === 'preventista') return <Redirect href="/(preventista)" />;

  return <Redirect href="/(auth)/login" />;
}
