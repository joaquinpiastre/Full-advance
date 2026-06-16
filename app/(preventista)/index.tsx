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

export default function InicioPreventsita() {
  const { usuario, logout } = useAuthStore();
  const { jornada, setJornada } = useJornadaStore();
  const [cargando, setCargando] = useState(true);
  const [asignacion, setAsignacion] = useState<any>(null);
  const [rutasDisponibles, setRutasDisponibles] = useState<{ opciones: OpcionRuta[]; selecciones_actuales: number[] }>({ opciones: [], selecciones_actuales: [] });
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
      if (rutasRes.status === 'fulfilled') {
        const d = rutasRes.value.data;
        setRutasDisponibles({
          opciones: d.opciones ?? [],
          selecciones_actuales: d.selecciones_actuales ?? [],
        });
      }
    } catch {}
    setCargando(false);
  };

  // Togglea una ruta: el backend la agrega si no estaba o la quita si ya estaba.
  const handleToggleRuta = async (ruta_id: number) => {
    try {
      const res = await elegirRuta(ruta_id);
      const seleccionadas: number[] = res.data?.seleccionadas ?? [];
      setRutasDisponibles((prev) => ({ ...prev, selecciones_actuales: seleccionadas }));
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? 'No se pudo elegir la ruta');
    }
  };

  const handleConfirmarRutas = () => {
    setModalEleccionVisible(false);
    cargarEstado();
  };

  const handleIniciar = async () => {
    const rutasSeleccionadas = asignacion?.rutas ?? [];
    if (asignacion?.necesita_eleccion || rutasSeleccionadas.length === 0) {
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
            await iniciarGps(res.data.id);
            router.push('/(preventista)/ruta');
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

  if (cargando) return <View style={styles.center}><ActivityIndicator color={COLORS.preventista} size="large" /></View>;

  const hoy = format(new Date(), "EEEE d 'de' MMMM", { locale: es });
  const rutasAsignadas: any[] = asignacion?.rutas ?? [];
  const totalClientes = rutasAsignadas.reduce((sum: number, r: any) => sum + (r.clientes?.length ?? 0), 0);
  const puedeCambiarRuta = !jornada && rutasDisponibles.opciones.length > 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.bienvenida}>Hola, {usuario?.nombre} 👋</Text>
      <Text style={styles.fecha}>{hoy}</Text>

      {asignacion?.necesita_eleccion ? (
        <View style={[styles.card, styles.cardWarning]}>
          <Text style={styles.cardLabel}>Elegí tus rutas de la semana</Text>
          <Text style={styles.cardDesc}>
            Tenés {asignacion.opciones?.length ?? 0} rutas habilitadas. Podés elegir una o más.
          </Text>
          <TouchableOpacity style={styles.btnEleccion} onPress={() => setModalEleccionVisible(true)}>
            <Text style={styles.btnEleccionTexto}>Elegir rutas</Text>
          </TouchableOpacity>
        </View>
      ) : rutasAsignadas.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>
            {rutasAsignadas.length === 1 ? 'Ruta asignada hoy' : `${rutasAsignadas.length} rutas asignadas hoy`}
          </Text>
          {rutasAsignadas.map((r: any) => (
            <Text key={r.id} style={styles.cardTitulo}>• {r.nombre}</Text>
          ))}
          <Text style={styles.cardDesc}>{totalClientes} clientes en total</Text>
          {puedeCambiarRuta && (
            <TouchableOpacity style={styles.btnCambiar} onPress={() => setModalEleccionVisible(true)}>
              <Text style={styles.btnCambiarTexto}>
                {rutasAsignadas.length === 1 ? 'Cambiar ruta del día' : 'Cambiar rutas del día'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={[styles.card, styles.cardWarning]}>
          <Text style={styles.cardLabel}>Sin asignación hoy</Text>
          <Text style={styles.cardDesc}>
            {rutasDisponibles.opciones.length > 0 ? 'Elegí qué ruta/s vas a hacer hoy.' : 'El admin aún no te habilitó una ruta.'}
          </Text>
          {rutasDisponibles.opciones.length > 0 && (
            <TouchableOpacity style={styles.btnEleccion} onPress={() => setModalEleccionVisible(true)}>
              <Text style={styles.btnEleccionTexto}>Elegir rutas</Text>
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

          <TouchableOpacity style={styles.btnPrimario} onPress={() => router.push('/(preventista)/ruta')}>
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

      <EleccionRutaModal
        visible={modalEleccionVisible}
        opciones={asignacion?.necesita_eleccion ? asignacion.opciones : rutasDisponibles.opciones}
        color={COLORS.preventista}
        multiSelect
        seleccionadas={rutasDisponibles.selecciones_actuales}
        onElegir={handleToggleRuta}
        onConfirmar={handleConfirmarRutas}
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
    borderLeftColor: COLORS.preventista,
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
    backgroundColor: COLORS.preventista,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  btnEleccionTexto: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnCambiar: {
    borderWidth: 1.5,
    borderColor: COLORS.preventista,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  btnCambiarTexto: { color: COLORS.preventista, fontWeight: '700', fontSize: 13 },
  btnPrimario: {
    backgroundColor: COLORS.preventista,
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
