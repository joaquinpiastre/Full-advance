import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { useJornadaStore } from '../../store/jornadaStore';
import {
  obtenerJornadasActivas, obtenerAlertas, iniciarJornada, finalizarJornada,
  obtenerJornadaActiva, obtenerAsignacionHoy, obtenerRutasDisponibles, elegirRuta,
} from '../../services/api';
import { iniciarGps, detenerGps } from '../../services/gps';
import EleccionRutaModal, { OpcionRuta } from '../../components/EleccionRutaModal';
import { COLORS } from '../../constants';
import { JornadaActiva, Alerta } from '../../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function InicioSupervisor() {
  const { usuario, logout } = useAuthStore();
  const { jornada, setJornada } = useJornadaStore();
  const [cargando, setCargando] = useState(true);
  const [equipo, setEquipo] = useState<JornadaActiva[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [asignacion, setAsignacion] = useState<any>(null);
  const [rutasDisponibles, setRutasDisponibles] = useState<{ opciones: OpcionRuta[]; seleccion_actual: number | null }>({ opciones: [], seleccion_actual: null });
  const [modalEleccionVisible, setModalEleccionVisible] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [equipoRes, alertasRes, jornadaRes, asigRes, rutasRes] = await Promise.allSettled([
        obtenerJornadasActivas(),
        obtenerAlertas(),
        obtenerJornadaActiva(),
        obtenerAsignacionHoy(),
        obtenerRutasDisponibles(),
      ]);
      if (equipoRes.status === 'fulfilled') setEquipo(equipoRes.value.data);
      if (alertasRes.status === 'fulfilled') setAlertas(alertasRes.value.data);
      if (jornadaRes.status === 'fulfilled') setJornada(jornadaRes.value.data);
      if (asigRes.status === 'fulfilled') setAsignacion(asigRes.value.data);
      if (rutasRes.status === 'fulfilled') setRutasDisponibles(rutasRes.value.data);
    } catch {}
    setCargando(false);
  }, [setJornada]);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const handleElegirRuta = async (ruta_id: number) => {
    try {
      await elegirRuta(ruta_id);
      setModalEleccionVisible(false);
      await cargar();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? 'No se pudo elegir la ruta');
    }
  };

  const handleIniciar = async () => {
    if (asignacion?.necesita_eleccion) {
      setModalEleccionVisible(true);
      return;
    }
    Alert.alert('Iniciar visita de control', '¿Empezar el seguimiento GPS para tu visita de control?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Iniciar', onPress: async () => {
          try {
            const res = await iniciarJornada();
            setJornada(res.data);
            await iniciarGps(res.data.id);
            router.push('/(supervisor)/mivisita');
          } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.error ?? 'No se pudo iniciar');
          }
        }
      }
    ]);
  };

  const handleFinalizar = async () => {
    if (!jornada) return;
    Alert.alert('Finalizar visita', '¿Terminaste el recorrido de control?', [
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
  const repartidores = equipo.filter((e) => e.usuario_rol === 'repartidor');
  const preventistas = equipo.filter((e) => e.usuario_rol === 'preventista');
  const urgentes = alertas.filter((a) => a.urgente).length;
  const puedeCambiarRuta = !jornada && rutasDisponibles.opciones.length > 0;
  const puedeElegirSinAsignacion = !asignacion && rutasDisponibles.opciones.length > 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.bienvenida}>Hola, {usuario?.nombre} 👋</Text>
      <Text style={styles.fecha}>{hoy}</Text>

      {asignacion?.necesita_eleccion ? (
        <View style={[styles.card, styles.cardAviso]}>
          <Text style={styles.cardLabel}>Elegí una ruta para visitar</Text>
          <Text style={styles.cardDesc}>
            Tenés {asignacion.opciones?.length ?? 0} rutas disponibles. Elegí cuál vas a recorrer.
          </Text>
          <TouchableOpacity style={styles.btnEleccion} onPress={() => setModalEleccionVisible(true)}>
            <Text style={styles.btnEleccionTexto}>Elegir ruta</Text>
          </TouchableOpacity>
        </View>
      ) : asignacion ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Ruta a visitar hoy</Text>
          <Text style={styles.cardTitulo}>{asignacion.ruta?.nombre}</Text>
          <Text style={styles.cardDesc}>
            {asignacion.ruta?.clientes?.length ?? 0} clientes en la ruta
          </Text>
          {puedeCambiarRuta && (
            <TouchableOpacity style={styles.btnCambiar} onPress={() => setModalEleccionVisible(true)}>
              <Text style={styles.btnCambiarTexto}>Cambiar ruta a visitar</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={[styles.card, styles.cardAviso]}>
          <Text style={styles.cardLabel}>Sin ruta elegida</Text>
          <Text style={styles.cardDesc}>
            {puedeElegirSinAsignacion ? 'Elegí qué ruta vas a visitar hoy.' : 'No hay rutas disponibles.'}
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
            <Text style={styles.cardLabel}>Visita de control en curso</Text>
            <Text style={styles.cardTitulo}>
              Iniciada: {format(new Date(jornada.fecha_inicio), 'HH:mm')}
            </Text>
            <Text style={styles.cardDesc}>GPS activo</Text>
          </View>

          <TouchableOpacity style={styles.btnPrimario} onPress={() => router.push('/(supervisor)/mivisita')}>
            <Text style={styles.btnTexto}>Ver mi visita</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnDanger} onPress={handleFinalizar}>
            <Text style={styles.btnTexto}>Finalizar visita</Text>
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity style={styles.btnPrimario} onPress={handleIniciar}>
          <Text style={styles.btnTexto}>Iniciar visita de control</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.card} onPress={() => router.push('/(supervisor)/ruta')}>
        <Text style={styles.cardLabel}>Equipo en ruta ahora</Text>
        <Text style={styles.cardTitulo}>{equipo.length} jornada{equipo.length === 1 ? '' : 's'} activa{equipo.length === 1 ? '' : 's'}</Text>
        <Text style={styles.cardDesc}>
          🚚 {repartidores.length} repartidor{repartidores.length === 1 ? '' : 'es'} · 👔 {preventistas.length} preventista{preventistas.length === 1 ? '' : 's'}
        </Text>
        <Text style={styles.cardLink}>Ver seguimiento en vivo →</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.card, urgentes > 0 && styles.cardAlerta]}
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

      <EleccionRutaModal
        visible={modalEleccionVisible}
        opciones={asignacion?.necesita_eleccion ? asignacion.opciones : rutasDisponibles.opciones}
        seleccionActual={rutasDisponibles.seleccion_actual}
        color={COLORS.supervisor}
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
    borderLeftColor: COLORS.supervisor,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    gap: 4,
  },
  cardAlerta: { borderLeftColor: COLORS.danger },
  cardAviso: { borderLeftColor: COLORS.warning },
  cardSuccess: { borderLeftColor: COLORS.success },
  cardLabel: { fontSize: 12, color: COLORS.textLight, fontWeight: '600', marginBottom: 4 },
  cardTitulo: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  cardDesc: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
  cardLink: { fontSize: 13, fontWeight: '700', color: COLORS.supervisor, marginTop: 6 },
  btnEleccion: {
    backgroundColor: COLORS.supervisor,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  btnEleccionTexto: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnCambiar: {
    borderWidth: 1.5,
    borderColor: COLORS.supervisor,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  btnCambiarTexto: { color: COLORS.supervisor, fontWeight: '700', fontSize: 13 },
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
