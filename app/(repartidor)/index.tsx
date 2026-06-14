import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { useJornadaStore } from '../../store/jornadaStore';
import {
  iniciarJornada, finalizarJornada, obtenerJornadaActiva, obtenerAsignacionHoy,
  obtenerRutasDisponibles, elegirRuta,
} from '../../services/api';
import { iniciarGps, detenerGps } from '../../services/gps';
import EleccionRutaModal, { OpcionRuta } from '../../components/EleccionRutaModal';
import { COLORS } from '../../constants';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function InicioRepartidor() {
  const { usuario, logout } = useAuthStore();
  const { jornada, setJornada } = useJornadaStore();
  const [cargando, setCargando] = useState(true);
  const [asignacion, setAsignacion] = useState<any>(null);
  const [rutasDisponibles, setRutasDisponibles] = useState<{ opciones: OpcionRuta[]; seleccion_actual: number | null }>({ opciones: [], seleccion_actual: null });
  const [modalEleccionVisible, setModalEleccionVisible] = useState(false);

  useEffect(() => {
    cargarEstado();
  }, []);

  const cargarEstado = async () => {
    setCargando(true);
    try {
      const [jornadaRes, asigRes, rutasRes] = await Promise.allSettled([
        obtenerJornadaActiva(),
        obtenerAsignacionHoy(),
        obtenerRutasDisponibles(),
      ]);
      if (jornadaRes.status === 'fulfilled') setJornada(jornadaRes.value.data);
      if (asigRes.status === 'fulfilled') setAsignacion(asigRes.value.data);
      if (rutasRes.status === 'fulfilled') setRutasDisponibles(rutasRes.value.data);
    } catch {}
    setCargando(false);
  };

  const handleElegirRuta = async (ruta_id: number) => {
    try {
      await elegirRuta(ruta_id);
      setModalEleccionVisible(false);
      await cargarEstado();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? 'No se pudo elegir la ruta');
    }
  };

  const handleIniciar = async () => {
    if (asignacion?.necesita_eleccion) {
      setModalEleccionVisible(true);
      return;
    }
    Alert.alert('Iniciar jornada', '¿Empezar el seguimiento GPS?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Iniciar', onPress: async () => {
          try {
            const res = await iniciarJornada();
            setJornada(res.data);
            try { await iniciarGps(res.data.id); } catch {}
            router.push('/(repartidor)/jornada');
          } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.error ?? 'No se pudo iniciar');
          }
        }
      }
    ]);
  };

  const handleFinalizar = async () => {
    if (!jornada) return;
    Alert.alert('Finalizar jornada', '¿Terminaste el reparto del día?', [
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

  if (cargando) return <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;

  const hoy = format(new Date(), "EEEE d 'de' MMMM", { locale: es });
  const puedeCambiarRuta = !jornada && rutasDisponibles.opciones.length > 0;
  const puedeElegirSinAsignacion = !asignacion && rutasDisponibles.opciones.length > 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.bienvenida}>Hola, {usuario?.nombre} 👋</Text>
      <Text style={styles.fecha}>{hoy}</Text>

      {asignacion?.necesita_eleccion ? (
        <View style={[styles.card, styles.cardWarning]}>
          <Text style={styles.cardLabel}>Elegí tu ruta de la semana</Text>
          <Text style={styles.cardDesc}>
            Tenés {asignacion.opciones?.length ?? 0} rutas habilitadas. Elegí cuál vas a hacer esta semana.
          </Text>
          <TouchableOpacity style={styles.btnEleccion} onPress={() => setModalEleccionVisible(true)}>
            <Text style={styles.btnEleccionTexto}>Elegir ruta</Text>
          </TouchableOpacity>
        </View>
      ) : asignacion ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Ruta asignada hoy</Text>
          <Text style={styles.cardTitulo}>{asignacion.ruta?.nombre}</Text>
          {asignacion.ruta?.descripcion && (
            <Text style={styles.cardDesc}>{asignacion.ruta.descripcion}</Text>
          )}
          {puedeCambiarRuta && (
            <TouchableOpacity style={styles.btnCambiar} onPress={() => setModalEleccionVisible(true)}>
              <Text style={styles.btnCambiarTexto}>Cambiar ruta del día</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={[styles.card, styles.cardWarning]}>
          <Text style={styles.cardLabel}>Sin asignación hoy</Text>
          <Text style={styles.cardDesc}>
            {puedeElegirSinAsignacion ? 'Elegí qué ruta vas a hacer hoy.' : 'El admin aún no te habilitó una ruta.'}
          </Text>
          {puedeElegirSinAsignacion && (
            <TouchableOpacity style={styles.btnEleccion} onPress={() => setModalEleccionVisible(true)}>
              <Text style={styles.btnEleccionTexto}>Elegir ruta</Text>
            </TouchableOpacity>
          )}
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

          <TouchableOpacity style={styles.btnPrimario} onPress={() => router.push('/(repartidor)/jornada')}>
            <Text style={styles.btnTexto}>Ver jornada activa</Text>
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

      <EleccionRutaModal
        visible={modalEleccionVisible}
        opciones={asignacion?.necesita_eleccion ? asignacion.opciones : rutasDisponibles.opciones}
        seleccionActual={rutasDisponibles.seleccion_actual}
        color={COLORS.primary}
        onElegir={handleElegirRuta}
        onClose={!asignacion?.necesita_eleccion ? () => setModalEleccionVisible(false) : undefined}
      />
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
    borderLeftColor: COLORS.primary,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    gap: 4,
  },
  cardWarning: { borderLeftColor: COLORS.warning },
  cardSuccess: { borderLeftColor: COLORS.success },
  cardLabel: { fontSize: 12, color: COLORS.textLight, fontWeight: '600', marginBottom: 4 },
  cardTitulo: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  cardDesc: { fontSize: 13, color: COLORS.textLight, marginTop: 4 },
  btnEleccion: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  btnEleccionTexto: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnCambiar: {
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  btnCambiarTexto: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
  btnPrimario: {
    backgroundColor: COLORS.primary,
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
