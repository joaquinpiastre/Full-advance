import { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  RefreshControl, TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { obtenerJornadasActivas } from '../../services/api';
import MapaLive from '../../components/MapaLive';
import { COLORS } from '../../constants';
import { JornadaActiva, UbicacionLive } from '../../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const AUTO_REFRESH_MS = 15_000;

type Filtro = 'todos' | 'repartidor' | 'preventista';

function colorRol(rol: string) {
  return rol === 'repartidor' ? COLORS.repartidor : COLORS.preventista;
}

function CardEquipo({ item }: { item: JornadaActiva }) {
  const total = item.ruta?.total ?? 0;
  const progreso = total > 0 ? item.paradas_completadas / total : 0;
  const inicio = format(new Date(item.fecha_inicio), 'HH:mm', { locale: es });
  const color = colorRol(item.usuario_rol);

  return (
    <View style={[styles.card, { borderLeftColor: color }]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardInfo}>
          <Text style={styles.nombre}>{item.usuario_nombre}</Text>
          <Text style={styles.rolTexto}>
            {item.usuario_rol === 'repartidor' ? '🚚 Repartidor' : '👔 Preventista'}
            {' · desde ' + inicio}
          </Text>
          {item.ruta && (
            <Text style={styles.rutaNombre}>{item.ruta.nombre}</Text>
          )}
        </View>
        <View style={[styles.estadoPill, item.gps_activo ? styles.pillOnline : styles.pillOffline]}>
          <Text style={styles.estadoTexto}>
            {item.gps_activo ? '🟢 En línea' : '⚪ Sin señal'}
          </Text>
        </View>
      </View>

      {total > 0 ? (
        <>
          <View style={styles.barraFondo}>
            <View
              style={[
                styles.barraProgreso,
                { width: `${Math.min(progreso * 100, 100)}%` as any, backgroundColor: color },
              ]}
            />
          </View>
          <Text style={styles.progresoTexto}>
            {item.paradas_completadas} / {total} visitas completadas
          </Text>
        </>
      ) : (
        <Text style={styles.progresoTexto}>
          {item.paradas_completadas} visitas completadas
        </Text>
      )}
    </View>
  );
}

export default function SeguimientoAdmin() {
  const [equipo, setEquipo] = useState<JornadaActiva[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null);
  const intervaloRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cargar = useCallback(async (silent = false) => {
    if (!silent) setCargando(true);
    try {
      const res = await obtenerJornadasActivas();
      setEquipo(res.data);
      setUltimaActualizacion(new Date());
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

  const equipoFiltrado = filtro === 'todos'
    ? equipo
    : equipo.filter((e) => e.usuario_rol === filtro);

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

  const onlineCount = equipo.filter((e) => e.gps_activo).length;

  if (cargando) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Mapa */}
      <View style={styles.mapaContainer}>
        {ubicaciones.length ? (
          <MapaLive ubicaciones={ubicaciones} />
        ) : (
          <View style={styles.mapaVacio}>
            <Text style={styles.mapaVacioTexto}>
              Nadie del equipo está en ruta con GPS activo
            </Text>
          </View>
        )}

        {/* Badge con última actualización */}
        {ultimaActualizacion && (
          <View style={styles.updateBadge}>
            <View style={[styles.updateDot, { backgroundColor: onlineCount > 0 ? '#22C55E' : '#9CA3AF' }]} />
            <Text style={styles.updateTexto}>
              {onlineCount} en línea · actualizado {format(ultimaActualizacion, 'HH:mm:ss')}
            </Text>
          </View>
        )}
      </View>

      {/* Lista */}
      <FlatList
        data={equipoFiltrado}
        keyExtractor={(item) => String(item.jornada_id)}
        renderItem={({ item }) => <CardEquipo item={item} />}
        contentContainerStyle={styles.lista}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); cargar(); }}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.listaHeader}>
              <Text style={styles.titulo}>
                Equipo en ruta
                <Text style={styles.tituloCount}> ({equipo.length})</Text>
              </Text>
            </View>
            <View style={styles.chips}>
              {([
                { key: 'todos',       label: 'Todos' },
                { key: 'repartidor',  label: '🚚 Repartidores' },
                { key: 'preventista', label: '👔 Preventistas' },
              ] as { key: Filtro; label: string }[]).map((f) => (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.chip, filtro === f.key && styles.chipActivo]}
                  onPress={() => setFiltro(f.key)}
                >
                  <Text style={[styles.chipTexto, filtro === f.key && styles.chipTextoActivo]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
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
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },

  mapaContainer: {
    height: '45%',
    position: 'relative',
  },
  mapaVacio: {
    flex: 1,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  mapaVacioTexto: {
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
  },
  updateBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(10,10,10,0.72)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  updateDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  updateTexto: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  lista: { paddingBottom: 20 },
  listaHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  titulo: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },
  tituloCount: {
    color: COLORS.textMuted,
    fontWeight: '400',
  },
  chips: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
  },
  chipActivo: {
    backgroundColor: COLORS.primary,
  },
  chipTexto: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  chipTextoActivo: {
    color: '#fff',
  },

  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 10,
    padding: 14,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardInfo: { flex: 1, marginRight: 10 },
  nombre: { fontSize: 15, fontWeight: '700', color: '#111', marginBottom: 2 },
  rolTexto: { fontSize: 12, color: COLORS.textMuted, marginBottom: 2 },
  rutaNombre: { fontSize: 12, color: COLORS.textMuted, fontStyle: 'italic' },

  estadoPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pillOnline: { backgroundColor: '#D1FAE5' },
  pillOffline: { backgroundColor: '#F3F4F6' },
  estadoTexto: { fontSize: 11, fontWeight: '600' },

  barraFondo: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 5,
  },
  barraProgreso: {
    height: 4,
    borderRadius: 2,
  },
  progresoTexto: {
    fontSize: 11,
    color: COLORS.textMuted,
  },

  vacioTexto: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
});
