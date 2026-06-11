import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { useJornadaStore } from '../../store/jornadaStore';
import { iniciarJornada, finalizarJornada, obtenerJornadaActiva, obtenerAsignacionHoy } from '../../services/api';
import { iniciarGps, detenerGps } from '../../services/gps';
import { COLORS } from '../../constants';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function InicioSupervisor() {
  const { usuario, logout } = useAuthStore();
  const { jornada, setJornada } = useJornadaStore();
  const [cargando, setCargando] = useState(true);
  const [asignacion, setAsignacion] = useState<any>(null);

  useEffect(() => {
    cargarEstado();
  }, []);

  const cargarEstado = async () => {
    setCargando(true);
    try {
      const [jornadaRes, asigRes] = await Promise.allSettled([
        obtenerJornadaActiva(),
        obtenerAsignacionHoy(),
      ]);
      if (jornadaRes.status === 'fulfilled') setJornada(jornadaRes.value.data);
      if (asigRes.status === 'fulfilled') setAsignacion(asigRes.value.data);
    } catch {}
    setCargando(false);
  };

  const handleIniciar = async () => {
    Alert.alert('Iniciar jornada', '¿Empezar el seguimiento GPS?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Iniciar', onPress: async () => {
          try {
            const res = await iniciarJornada();
            setJornada(res.data);
            await iniciarGps(res.data.id);
            router.push('/(supervisor)/ruta');
          } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.error ?? 'No se pudo iniciar');
          }
        }
      }
    ]);
  };

  const handleFinalizar = async () => {
    if (!jornada) return;
    Alert.alert('Finalizar jornada', '¿Terminaste el recorrido del día?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Finalizar', style: 'destructive', onPress: async () => {
          try {
            await finalizarJornada(jornada.id);
            await detenerGps();
            setJornada(null);
          } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.error ?? 'No se pudo finalizar');
          }
        }
      }
    ]);
  };

  if (cargando) return <View style={styles.center}><ActivityIndicator color={COLORS.supervisor} size="large" /></View>;

  const hoy = format(new Date(), "EEEE d 'de' MMMM", { locale: es });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.bienvenida}>Hola, {usuario?.nombre} 👋</Text>
      <Text style={styles.fecha}>{hoy}</Text>

      {asignacion ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Ruta asignada hoy</Text>
          <Text style={styles.cardTitulo}>{asignacion.ruta?.nombre}</Text>
          <Text style={styles.cardDesc}>
            {asignacion.ruta?.clientes?.length ?? 0} clientes en la ruta
          </Text>
        </View>
      ) : (
        <View style={[styles.card, styles.cardWarning]}>
          <Text style={styles.cardLabel}>Sin asignación hoy</Text>
          <Text style={styles.cardDesc}>El admin aún no asignó una ruta para hoy.</Text>
        </View>
      )}

      {jornada ? (
        <>
          <View style={[styles.card, styles.cardSuccess]}>
            <Text style={styles.cardLabel}>Jornada en curso</Text>
            <Text style={styles.cardTitulo}>
              Iniciada: {format(new Date(jornada.fecha_inicio), 'HH:mm')}
            </Text>
            <Text style={styles.cardDesc}>GPS activo</Text>
          </View>

          <TouchableOpacity style={styles.btnPrimario} onPress={() => router.push('/(supervisor)/ruta')}>
            <Text style={styles.btnTexto}>Ver mi ruta</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnDanger} onPress={handleFinalizar}>
            <Text style={styles.btnTexto}>Finalizar jornada</Text>
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity style={styles.btnPrimario} onPress={handleIniciar}>
          <Text style={styles.btnTexto}>Iniciar jornada</Text>
        </TouchableOpacity>
      )}

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
  },
  cardWarning: { borderLeftColor: COLORS.warning },
  cardSuccess: { borderLeftColor: COLORS.success },
  cardLabel: { fontSize: 12, color: COLORS.textLight, fontWeight: '600', marginBottom: 4 },
  cardTitulo: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  cardDesc: { fontSize: 13, color: COLORS.textLight, marginTop: 4 },
  btnPrimario: {
    backgroundColor: COLORS.supervisor,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  btnDanger: {
    backgroundColor: COLORS.danger,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  btnLogout: { alignItems: 'center', padding: 12, marginTop: 8 },
  btnLogoutTexto: { color: COLORS.textLight, fontSize: 14 },
  btnTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
