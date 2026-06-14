import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { obtenerJornadasActivas } from '../../services/api';
import MapaLive from '../../components/MapaLive';
import { COLORS } from '../../constants';
import { JornadaActiva, UbicacionLive } from '../../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const AUTO_REFRESH_MS = 15000;

function colorRol(rol: string) {
  return rol === 'repartidor' ? COLORS.repartidor : COLORS.preventista;
}

function CardEquipo({ item }: { item: JornadaActiva }) {
  const total = item.ruta?.total ?? 0;
  const progreso = total > 0 ? item.paradas_completadas / total : 0;
  const inicio = format(new Date(item.fecha_inicio), 'HH:mm');

  return (
    <View style={[styles.card, { borderLeftColor: colorRol(item.usuario_rol) }]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardInfo}>
          <Text style={styles.nombre}>{item.usuario_nombre}</Text>
          <Text style={styles.rol}>
            {item.usuario_rol === 'repartidor' ? '🚚 Repartidor' : '👔 Preventista'}
            {' · desde ' + inicio}
          </Text>
        </View>
        <View style={[styles.estadoPill, item.gps_activo ? styles.pillOnline : styles.pillOffline]}>
          <Text style={styles.estadoTexto}>{item.gps_activo ? '🟢 En línea' : '⚪ Sin señal'}</Text>
        </View>
      </View>

      <Text style={styles.rutaNombre}>{item.ruta?.nombre ?? 'Sin ruta asignada'}</Text>

      {total > 0 ? (
        <>
          <View style={styles.barraFondo}>
            <View style={[styles.barraProgreso, { width: `${Math.min(progreso * 100, 100)}%`, backgroundColor: colorRol(item.usuario_rol) }]} />
          </View>
          <Text style={styles.progresoTexto}>
            {item.paradas_completadas} / {total} visitas completadas
          </Text>
        </>
      ) : (
        <Text style={styles.progresoTexto}>{item.paradas_completadas} visitas completadas</Text>
      )}
    </View>
  );
}

export default function EquipoSupervisor() {
  const [equipo, setEquipo] = useState<JornadaActiva[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const intervaloRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cargar = useCallback(async (silent = false) => {
    if (!silent) setCargando(true);
    try {
      const res = await obtenerJornadasActivas();
      setEquipo(res.data);
    } catch {}
    setCargando(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => {
    cargar();
    intervaloRef.current = setInterval(() => cargar(true), AUTO_REFRESH_MS);
    return () => {
      if (intervaloRef.current) clearInterval(intervaloRef.current);
    };
  }, [cargar]));

  const ubicaciones: UbicacionLive[] = equipo
    .filter((e) => e.gps_activo && e.lat != null && e.lng != null)
    .map((e) => ({
      usuario_id: e.usuario_id,
      nombre: e.usuario_nombre,
      rol: e.usuario_rol,
      lat: e.lat!,
      lng: e.lng!,
      timestamp: e.gps_timestamp!,
      activo: true,
    }));

  if (cargando) return <View style={styles.center}><ActivityIndicator color={COLORS.supervisor} size="large" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.mapaContainer}>
        {ubicaciones.length ? (
          <MapaLive ubicaciones={ubicaciones} />
        ) : (
          <View style={styles.mapaVacio}>
            <Text style={styles.vacioTexto}>Nadie del equipo está en ruta con GPS activo</Text>
          </View>
        )}
      </View>

      <FlatList
        data={equipo}
        keyExtractor={(item) => String(item.jornada_id)}
        renderItem={({ item }) => <CardEquipo item={item} />}
        contentContainerStyle={styles.lista}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargar(); }} />}
        ListHeaderComponent={
          <Text style={styles.titulo}>Equipo en ruta ({equipo.length})</Text>
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.vacioTexto}>No hay jornadas activas en este momento</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  mapaContainer: { height: 260, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  mapaVacio: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.card, padding: 16 },
  vacioTexto: { textAlign: 'center', color: COLORS.textLight, fontSize: 14 },
  lista: { padding: 16, gap: 12, flexGrow: 1 },
  titulo: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    gap: 8,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardInfo: { flex: 1, gap: 2 },
  nombre: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  rol: { fontSize: 12, color: COLORS.textLight },
  estadoPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  pillOnline: { backgroundColor: '#DCFCE7' },
  pillOffline: { backgroundColor: COLORS.border },
  estadoTexto: { fontSize: 11, fontWeight: '700', color: COLORS.text },
  rutaNombre: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  barraFondo: { height: 8, borderRadius: 4, backgroundColor: COLORS.border, overflow: 'hidden' },
  barraProgreso: { height: 8, borderRadius: 4 },
  progresoTexto: { fontSize: 12, color: COLORS.textLight },
});
