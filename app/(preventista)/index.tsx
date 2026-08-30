import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { useJornadaStore } from '../../store/jornadaStore';
import {
  iniciarJornada, finalizarJornada, obtenerJornadaActiva, obtenerAsignacionHoy,
  obtenerRutasDisponibles, elegirRuta,
} from '../../services/api';
import { iniciarGps, detenerGps } from '../../services/gps';
import { encolarAccion } from '../../services/offlineAcciones';
import EleccionRutaModal, { OpcionRuta } from '../../components/EleccionRutaModal';
import { COLORS } from '../../constants';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function InicioPreventsita() {
  const { usuario, logout } = useAuthStore();
  const { jornada, setJornada, sincronizando, setSincronizando } = useJornadaStore();
  const [cargando, setCargando] = useState(true);
  const [asignacion, setAsignacion] = useState<any>(null);
  const [rutasDisponibles, setRutasDisponibles] = useState<{ opciones: OpcionRuta[]; seleccion_actual: number | null }>({ opciones: [], seleccion_actual: null });
  const [modalEleccionVisible, setModalEleccionVisible] = useState(false);
  const reintentoIniciar = useRef<ReturnType<typeof setInterval> | null>(null);
  const reintentoFinalizar = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    cargarEstado();
    // Si se cerró la app mientras reintentaba iniciar/finalizar por mala
    // señal, retomamos el reintento apenas se vuelve a abrir la pantalla.
    if (sincronizando === 'iniciando' && !jornada) {
      intentarIniciarJornada();
      reintentoIniciar.current = setInterval(intentarIniciarJornada, 5000);
    } else if (sincronizando === 'finalizando' && jornada) {
      intentarFinalizarJornada(jornada.id);
      reintentoFinalizar.current = setInterval(() => intentarFinalizarJornada(jornada.id), 5000);
    }
    return () => {
      if (reintentoIniciar.current) clearInterval(reintentoIniciar.current);
      if (reintentoFinalizar.current) clearInterval(reintentoFinalizar.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          seleccion_actual: d.seleccion_actual ?? null,
        });
      }
    } catch {}
    setCargando(false);
  };

  const handleElegirRuta = async (ruta_id: number) => {
    try {
      await elegirRuta(ruta_id);
      setModalEleccionVisible(false);
      await cargarEstado();
    } catch (e: any) {
      if (e?.response) {
        Alert.alert('Error', e.response.data?.error ?? 'No se pudo elegir la ruta');
      } else {
        // Sin conexión: se guarda igual y se sincroniza cuando vuelva la señal.
        await encolarAccion({ tipo: 'elegir_ruta', payload: { ruta_id } });
        setModalEleccionVisible(false);
        setRutasDisponibles((prev) => ({ ...prev, seleccion_actual: ruta_id }));
        const opcion = rutasDisponibles.opciones.find((o) => o.id === ruta_id);
        if (opcion) setAsignacion((prev: any) => ({ ...prev, necesita_eleccion: false, ruta: opcion, rutas: [opcion] }));
      }
    }
  };

  const intentarIniciarJornada = async () => {
    try {
      const res = await iniciarJornada();
      if (reintentoIniciar.current) { clearInterval(reintentoIniciar.current); reintentoIniciar.current = null; }
      setSincronizando(null);
      setJornada(res.data);
      try { await iniciarGps(res.data.id); } catch {}
      router.push('/(preventista)/ruta');
    } catch (e: any) {
      if (e?.response) {
        if (reintentoIniciar.current) { clearInterval(reintentoIniciar.current); reintentoIniciar.current = null; }
        // Puede que el POST anterior sí haya llegado al servidor y solo se
        // haya perdido la respuesta (mala señal): antes de avisar error,
        // confirmamos si ya existe una jornada activa nuestra.
        try {
          const activa = await obtenerJornadaActiva();
          if (activa.data) {
            setSincronizando(null);
            setJornada(activa.data);
            try { await iniciarGps(activa.data.id); } catch {}
            router.push('/(preventista)/ruta');
            return;
          }
        } catch {}
        setSincronizando(null);
        Alert.alert('Error', e.response.data?.error ?? 'No se pudo iniciar');
      }
      // Si es error de red no hacemos nada: el intervalo reintenta solo.
    }
  };

  const handleIniciar = () => {
    const ruta = asignacion?.ruta;
    if (asignacion?.necesita_eleccion || !ruta) {
      setModalEleccionVisible(true);
      return;
    }
    Alert.alert('Iniciar jornada', '¿Empezar el seguimiento GPS?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Iniciar', onPress: () => {
          setSincronizando('iniciando');
          intentarIniciarJornada();
          reintentoIniciar.current = setInterval(intentarIniciarJornada, 5000);
        }
      }
    ]);
  };

  const intentarFinalizarJornada = async (jornadaId: number) => {
    try {
      await finalizarJornada(jornadaId);
      if (reintentoFinalizar.current) { clearInterval(reintentoFinalizar.current); reintentoFinalizar.current = null; }
      setSincronizando(null);
      await detenerGps();
      setJornada(null);
    } catch (e: any) {
      if (e?.response) {
        if (reintentoFinalizar.current) { clearInterval(reintentoFinalizar.current); reintentoFinalizar.current = null; }
        // Puede que el POST anterior sí haya llegado al servidor y solo se
        // haya perdido la respuesta: si ya no hay jornada activa, ya se
        // finalizó bien y esto no es un error de verdad.
        try {
          const activa = await obtenerJornadaActiva();
          if (!activa.data) {
            setSincronizando(null);
            await detenerGps();
            setJornada(null);
            return;
          }
        } catch {}
        setSincronizando(null);
        Alert.alert('Error', e.response.data?.error ?? 'No se pudo finalizar');
      }
      // Error de red: se sigue reintentando en segundo plano.
    }
  };

  const handleFinalizar = () => {
    if (!jornada) return;
    Alert.alert('Finalizar jornada', '¿Terminaste el recorrido del día?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Finalizar', style: 'destructive', onPress: () => {
          setSincronizando('finalizando');
          intentarFinalizarJornada(jornada.id);
          reintentoFinalizar.current = setInterval(() => intentarFinalizarJornada(jornada.id), 5000);
        }
      }
    ]);
  };

  if (cargando) return <View style={styles.center}><ActivityIndicator color={COLORS.preventista} size="large" /></View>;

  const hoy = format(new Date(), "EEEE d 'de' MMMM", { locale: es });
  const ruta: any = asignacion?.ruta ?? null;
  const totalClientes = ruta?.clientes?.length ?? 0;
  const puedeCambiarRuta = !jornada && sincronizando === null && rutasDisponibles.opciones.length > 0;

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
      ) : ruta ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Ruta asignada hoy</Text>
          <Text style={styles.cardTitulo}>• {ruta.nombre}</Text>
          <Text style={styles.cardDesc}>{totalClientes} clientes en total</Text>
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
            {rutasDisponibles.opciones.length > 0 ? 'Elegí qué ruta vas a hacer hoy.' : 'El admin aún no te habilitó una ruta.'}
          </Text>
          {rutasDisponibles.opciones.length > 0 && (
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
            <Text style={styles.cardDesc}>{sincronizando === 'finalizando' ? 'Cerrando jornada...' : 'GPS activo'}</Text>
          </View>

          <TouchableOpacity style={styles.btnPrimario} onPress={() => router.push('/(preventista)/ruta')}>
            <Text style={styles.btnTexto}>Ver mi ruta</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnDanger, sincronizando === 'finalizando' && { opacity: 0.6 }]}
            onPress={handleFinalizar}
            disabled={sincronizando === 'finalizando'}
          >
            {sincronizando === 'finalizando'
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnTexto}>Finalizar jornada</Text>}
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity
          style={[styles.btnPrimario, sincronizando === 'iniciando' && { opacity: 0.6 }]}
          onPress={handleIniciar}
          disabled={sincronizando === 'iniciando'}
        >
          {sincronizando === 'iniciando'
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnTexto}>Iniciar jornada</Text>}
        </TouchableOpacity>
      )}
      {sincronizando === 'iniciando' && (
        <Text style={styles.textoConectando}>Conectando... la jornada se va a iniciar sola apenas haya señal.</Text>
      )}

      <TouchableOpacity style={styles.btnLogout} onPress={() => { logout(); router.replace('/(auth)/login'); }}>
        <Text style={styles.btnLogoutTexto}>Cerrar sesión</Text>
      </TouchableOpacity>

      <EleccionRutaModal
        visible={modalEleccionVisible}
        opciones={asignacion?.necesita_eleccion ? asignacion.opciones : rutasDisponibles.opciones}
        color={COLORS.preventista}
        seleccionActual={ruta?.id ?? rutasDisponibles.seleccion_actual}
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
  textoConectando: { textAlign: 'center', color: COLORS.textLight, fontSize: 12, marginTop: -6 },
  btnLogout: { alignItems: 'center', padding: 12, marginTop: 8 },
  btnLogoutTexto: { color: COLORS.textLight, fontSize: 14 },
  btnTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
