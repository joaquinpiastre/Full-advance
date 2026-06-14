import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { obtenerJornadasActivas, obtenerAlertas } from '../../services/api';
import { COLORS } from '../../constants';
import { JornadaActiva, Alerta } from '../../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function InicioSupervisor() {
  const { usuario, logout } = useAuthStore();
  const [cargando, setCargando] = useState(true);
  const [equipo, setEquipo] = useState<JornadaActiva[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [equipoRes, alertasRes] = await Promise.allSettled([
        obtenerJornadasActivas(),
        obtenerAlertas(),
      ]);
      if (equipoRes.status === 'fulfilled') setEquipo(equipoRes.value.data);
      if (alertasRes.status === 'fulfilled') setAlertas(alertasRes.value.data);
    } catch {}
    setCargando(false);
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  if (cargando) return <View style={styles.center}><ActivityIndicator color={COLORS.supervisor} size="large" /></View>;

  const hoy = format(new Date(), "EEEE d 'de' MMMM", { locale: es });
  const repartidores = equipo.filter((e) => e.usuario_rol === 'repartidor');
  const preventistas = equipo.filter((e) => e.usuario_rol === 'preventista');
  const urgentes = alertas.filter((a) => a.urgente).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.bienvenida}>Hola, {usuario?.nombre} 👋</Text>
      <Text style={styles.fecha}>{hoy}</Text>

      <TouchableOpacity style={styles.card} onPress={() => router.push('/(supervisor)/ruta')}>
        <Text style={styles.cardLabel}>Equipo en ruta ahora</Text>
        <Text style={styles.cardTitulo}>{equipo.length} jornada{equipo.length === 1 ? '' : 's'} activa{equipo.length === 1 ? '' : 's'}</Text>
        <Text style={styles.cardDesc}>
          🚚 {repartidores.length} repartidor{repartidores.length === 1 ? '' : 'es'} · 👔 {preventistas.length} preventista{preventistas.length === 1 ? '' : 's'}
        </Text>
        <Text style={styles.cardLink}>Ver seguimiento en vivo →</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.card, urgentes > 0 && styles.cardWarning]}
        onPress={() => router.push('/(supervisor)/alertas')}
      >
        <Text style={styles.cardLabel}>Alertas y novedades</Text>
        <Text style={styles.cardTitulo}>
          {urgentes > 0 ? `🚨 ${urgentes} urgente${urgentes === 1 ? '' : 's'}` : 'Sin urgencias'}
        </Text>
        <Text style={styles.cardDesc}>{alertas.length} novedades en los últimos 7 días</Text>
        <Text style={styles.cardLink}>Ver alertas →</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.card} onPress={() => router.push('/(supervisor)/noticias')}>
        <Text style={styles.cardLabel}>Comunicación al equipo</Text>
        <Text style={styles.cardTitulo}>Noticias y anuncios</Text>
        <Text style={styles.cardLink}>Publicar o ver noticias →</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.btnLogout} onPress={() => { logout(); router.replace('/(auth)/login'); }}>
        <Text style={styles.btnLogoutTexto}>Cerrar sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, gap: 14 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  bienvenida: { fontSize: 22, fontWeight: '700', color: COLORS.text },
  fecha: { fontSize: 14, color: COLORS.textLight, textTransform: 'capitalize', marginBottom: 6 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 18,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.supervisor,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    gap: 4,
  },
  cardWarning: { borderLeftColor: COLORS.danger },
  cardLabel: { fontSize: 12, color: COLORS.textLight, fontWeight: '600' },
  cardTitulo: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  cardDesc: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
  cardLink: { fontSize: 13, fontWeight: '700', color: COLORS.supervisor, marginTop: 6 },
  btnLogout: { alignItems: 'center', padding: 12, marginTop: 8 },
  btnLogoutTexto: { color: COLORS.textLight, fontSize: 14 },
});
