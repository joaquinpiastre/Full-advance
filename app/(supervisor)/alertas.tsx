import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, ScrollView,
  ActivityIndicator, TouchableOpacity, RefreshControl, LayoutAnimation,
} from 'react-native';
import { obtenerAlertas, obtenerEliminacionesRuta } from '../../services/api';
import { Alerta, EliminacionRuta } from '../../types';
import { COLORS } from '../../constants';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const AUTO_REFRESH_MS = 15000;
type Filtro = 'todas' | 'urgentes' | 'vencimientos' | 'acciones' | 'bajas';

function CardBaja({ item }: { item: EliminacionRuta }) {
  const hora = format(new Date(item.created_at), "d MMM, HH:mm", { locale: es });
  return (
    <View style={[styles.card, styles.cardBaja]}>
      <View style={styles.cardRow}>
        <View style={[styles.tipoPill, styles.pillBaja]}>
          <Text style={styles.pillTexto}>🚫 BAJA DE RUTA</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardCliente} numberOfLines={1}>{item.cliente?.nombre}</Text>
          <Text style={styles.cardDir} numberOfLines={1}>Ruta: {item.ruta?.nombre}</Text>
        </View>
        <View style={styles.cardDerecha}>
          <Text style={styles.cardHora}>{hora}</Text>
        </View>
      </View>
      <View style={styles.detalle}>
        <View style={styles.detalleSep} />
        <View style={styles.detalleRow}>
          <Text style={styles.detalleLabel}>QUITADO POR</Text>
          <Text style={styles.detalleValor}>
            {item.usuario?.nombre}
            <Text style={styles.detalleRol}> · {item.usuario?.rol}</Text>
          </Text>
        </View>
        <View style={[styles.detalleCaja, styles.cajaBaja]}>
          <Text style={styles.cajaBajaTexto}>📝 {item.nota}</Text>
        </View>
      </View>
    </View>
  );
}

function CardAlerta({ item }: { item: Alerta }) {
  const [expandido, setExpandido] = useState(false);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandido((v) => !v);
  };

  const esUrgente = item.urgente;
  const esVenc = item.tiene_vencidos;
  const esAccion = !!item.accion_requerida;
  const hora = format(new Date(item.timestamp_salida), "d MMM, HH:mm", { locale: es });

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={toggle}
      style={[styles.card, esUrgente ? styles.cardUrgente : esVenc ? styles.cardVenc : styles.cardAccion]}
    >
      {/* Fila principal siempre visible */}
      <View style={styles.cardRow}>
        <View style={[styles.tipoPill, esUrgente ? styles.pillUrgente : esVenc ? styles.pillVenc : styles.pillAccion]}>
          <Text style={styles.pillTexto}>{esUrgente ? '🚨 URGENTE' : esVenc ? '📦 VENC.' : '📋 ACCIÓN'}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardCliente} numberOfLines={1}>{item.cliente?.nombre}</Text>
          <Text style={styles.cardDir} numberOfLines={1}>{item.cliente?.direccion}</Text>
        </View>
        <View style={styles.cardDerecha}>
          <Text style={styles.cardHora}>{hora}</Text>
          <Text style={styles.expandIcon}>{expandido ? '▲' : '▼'}</Text>
        </View>
      </View>

      {/* Detalle expandible */}
      {expandido && (
        <View style={styles.detalle}>
          <View style={styles.detalleSep} />

          <View style={styles.detalleRow}>
            <Text style={styles.detalleLabel}>REPORTADO POR</Text>
            <Text style={styles.detalleValor}>
              {item.usuario?.nombre}
              <Text style={styles.detalleRol}> · {item.usuario?.rol}</Text>
            </Text>
          </View>

          {item.cliente?.telefono ? (
            <View style={styles.detalleRow}>
              <Text style={styles.detalleLabel}>TELÉFONO</Text>
              <Text style={styles.detalleValor}>📞 {item.cliente.telefono}</Text>
            </View>
          ) : null}

          {esUrgente && item.urgencia_descripcion ? (
            <View style={[styles.detalleCaja, styles.cajaUrgente]}>
              <Text style={styles.cajaUrgenteTexto}>⚠️ {item.urgencia_descripcion}</Text>
            </View>
          ) : null}

          {item.tiene_vencidos && (
            <View style={[styles.detalleCaja, styles.cajaVenc]}>
              {item.mercaderia_vencida ? (
                <Text style={styles.cajaVencMercaderia}>{item.mercaderia_vencida}</Text>
              ) : null}
              {item.fecha_vencimiento ? (
                <Text style={[
                  styles.cajaVencFecha,
                  item.fecha_vencimiento === 'Vencida' && { color: COLORS.danger },
                ]}>
                  {item.fecha_vencimiento === 'Vencida' ? '🔴 Ya vencida' : `📅 Vence: ${item.fecha_vencimiento}`}
                </Text>
              ) : null}
              {item.nota_vencido ? (
                <Text style={styles.cajaVencNota}>📝 {item.nota_vencido}</Text>
              ) : null}
            </View>
          )}

          {esAccion ? (
            <View style={[styles.detalleCaja, styles.cajaAccion]}>
              <Text style={styles.cajaAccionTexto}>📋 {item.accion_requerida}</Text>
            </View>
          ) : null}

          {item.nota ? (
            <Text style={styles.detallleNota}>📝 {item.nota}</Text>
          ) : null}
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function SupervisorAlertas() {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [bajas, setBajas] = useState<EliminacionRuta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ultimaAct, setUltimaAct] = useState<Date | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('todas');

  const cargar = useCallback(async (silent = false) => {
    if (!silent) setCargando(true);
    try {
      const [resAlertas, resBajas] = await Promise.all([obtenerAlertas(), obtenerEliminacionesRuta()]);
      setAlertas(resAlertas.data);
      setBajas(resBajas.data);
      setUltimaAct(new Date());
    } catch {}
    setCargando(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    cargar();
    const interval = setInterval(() => cargar(true), AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, [cargar]);

  const urgentes = alertas.filter((a) => a.urgente);
  const vencimientos = alertas.filter((a) => a.tiene_vencidos);
  const acciones = alertas.filter((a) => a.accion_requerida);
  const vencidos = vencimientos.filter((a) => a.fecha_vencimiento === 'Vencida');
  const proximosAVencer = vencimientos.filter((a) => a.fecha_vencimiento && a.fecha_vencimiento !== 'Vencida');
  const byFecha = (a: Alerta, b: Alerta) =>
    new Date(b.timestamp_salida).getTime() - new Date(a.timestamp_salida).getTime();
  const todasSinDup = [
    ...urgentes,
    ...vencimientos.filter((v) => !v.urgente),
    ...acciones.filter((a) => !a.urgente && !a.tiene_vencidos),
  ].sort(byFecha);
  const lista =
    filtro === 'urgentes' ? [...urgentes].sort(byFecha) :
    filtro === 'vencimientos' ? [] : // en vencimientos mostramos secciones, no FlatList simple
    filtro === 'acciones' ? [...acciones].sort(byFecha) :
    todasSinDup;

  if (cargando) return <View style={styles.center}><ActivityIndicator color={COLORS.supervisor} size="large" /></View>;

  return (
    <View style={styles.container}>
      {/* Barra superior */}
      <View style={styles.topBar}>
        <Text style={styles.topBarTexto}>
          {ultimaAct ? `Actualizado ${format(ultimaAct, 'HH:mm:ss')}` : ''}
        </Text>
        <TouchableOpacity onPress={() => cargar()} style={styles.btnRefresh}>
          <Text style={styles.btnRefreshTexto}>↻ Actualizar</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs de filtro */}
      <View style={styles.tabs}>
        {([
          { key: 'todas', label: 'Todas', count: urgentes.length + vencimientos.filter((v) => !v.urgente).length + acciones.filter((a) => !a.urgente && !a.tiene_vencidos).length },
          { key: 'urgentes', label: '🚨 Urgentes', count: urgentes.length },
          { key: 'vencimientos', label: '📦 Vencimientos', count: vencidos.length + proximosAVencer.length },
          { key: 'acciones', label: '📋 Acciones', count: acciones.length },
          { key: 'bajas', label: '🚫 Bajas de ruta', count: bajas.length },
        ] as { key: Filtro; label: string; count: number }[]).map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, filtro === tab.key && styles.tabActivo]}
            onPress={() => setFiltro(tab.key)}
          >
            <Text style={[styles.tabTexto, filtro === tab.key && styles.tabTextoActivo]}>
              {tab.label}
            </Text>
            {tab.count > 0 && (
              <View style={[
                styles.tabBadge,
                tab.key === 'urgentes' && { backgroundColor: COLORS.danger },
                tab.key === 'vencimientos' && { backgroundColor: '#F59E0B' },
                tab.key === 'acciones' && { backgroundColor: COLORS.secondary },
                tab.key === 'bajas' && { backgroundColor: COLORS.danger },
              ]}>
                <Text style={styles.tabBadgeTexto}>{tab.count}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Lista */}
      {filtro === 'vencimientos' ? (
        <ScrollView
          contentContainerStyle={styles.lista}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargar(); }} />}
        >
          {/* Sección: Ya vencidos */}
          <View style={styles.seccionHeader}>
            <Text style={styles.seccionTituloRojo}>🔴 Vencidos</Text>
            {vencidos.length > 0 && (
              <View style={[styles.seccionBadge, { backgroundColor: COLORS.danger }]}>
                <Text style={styles.seccionBadgeTexto}>{vencidos.length}</Text>
              </View>
            )}
          </View>
          {vencidos.length === 0 ? (
            <View style={styles.seccionVacio}><Text style={styles.seccionVacioTexto}>Sin productos vencidos</Text></View>
          ) : (
            vencidos.sort(byFecha).map((item) => (
              <View key={`v-${item.id}`} style={{ marginBottom: 8 }}>
                <CardAlerta item={item} />
              </View>
            ))
          )}

          {/* Sección: Próximos a vencer */}
          <View style={[styles.seccionHeader, { marginTop: 16 }]}>
            <Text style={styles.seccionTituloAmbar}>📅 Próximos a vencer</Text>
            {proximosAVencer.length > 0 && (
              <View style={[styles.seccionBadge, { backgroundColor: '#F59E0B' }]}>
                <Text style={styles.seccionBadgeTexto}>{proximosAVencer.length}</Text>
              </View>
            )}
          </View>
          {proximosAVencer.length === 0 ? (
            <View style={styles.seccionVacio}><Text style={styles.seccionVacioTexto}>Sin próximos vencimientos</Text></View>
          ) : (
            proximosAVencer.sort(byFecha).map((item) => (
              <View key={`p-${item.id}`} style={{ marginBottom: 8 }}>
                <CardAlerta item={item} />
              </View>
            ))
          )}
        </ScrollView>
      ) : filtro === 'bajas' ? (
        <FlatList
          data={bajas}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.lista}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargar(); }} />
          }
          renderItem={({ item }) => <CardBaja item={item} />}
          ListEmptyComponent={
            <View style={styles.vacio}>
              <Text style={styles.vacioEmoji}>✅</Text>
              <Text style={styles.vacioTexto}>Sin clientes quitados de rutas</Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      ) : (
        <FlatList
          data={lista}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.lista}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargar(); }} />
          }
          renderItem={({ item }) => <CardAlerta item={item} />}
          ListEmptyComponent={
            <View style={styles.vacio}>
              <Text style={styles.vacioEmoji}>✅</Text>
              <Text style={styles.vacioTexto}>Sin alertas en los últimos 7 días</Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  topBarTexto: { fontSize: 11, color: COLORS.textLight },
  btnRefresh: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  btnRefreshTexto: { fontSize: 12, fontWeight: '600', color: COLORS.supervisor },

  // Tabs
  tabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 12,
    gap: 4,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActivo: { borderBottomColor: COLORS.supervisor },
  tabTexto: { fontSize: 13, fontWeight: '600', color: COLORS.textLight },
  tabTextoActivo: { color: COLORS.supervisor },
  tabBadge: {
    backgroundColor: COLORS.textLight,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  tabBadgeTexto: { color: '#fff', fontSize: 10, fontWeight: '800' },

  lista: { padding: 12, paddingBottom: 32 },

  // Card compacto
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    overflow: 'hidden',
    borderLeftWidth: 4,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  cardUrgente: { borderLeftColor: COLORS.danger, backgroundColor: '#FEF2F2' },
  cardVenc: { borderLeftColor: '#F59E0B' },
  cardAccion: { borderLeftColor: COLORS.secondary, backgroundColor: '#EFF6FF' },
  cardBaja: { borderLeftColor: COLORS.danger, backgroundColor: '#FEF2F2' },

  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  tipoPill: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  pillUrgente: { backgroundColor: COLORS.danger },
  pillVenc: { backgroundColor: '#F59E0B' },
  pillAccion: { backgroundColor: COLORS.secondary },
  pillBaja: { backgroundColor: COLORS.danger },
  pillTexto: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  cardInfo: { flex: 1 },
  cardCliente: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  cardDir: { fontSize: 11, color: COLORS.textLight, marginTop: 1 },

  cardDerecha: { alignItems: 'flex-end', gap: 4 },
  cardHora: { fontSize: 11, color: COLORS.textLight, textTransform: 'capitalize' },
  expandIcon: { fontSize: 10, color: COLORS.textLight },

  // Detalle expandido
  detalle: { paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  detalleSep: { height: 1, backgroundColor: 'rgba(0,0,0,0.06)', marginBottom: 4 },
  detalleRow: { gap: 1 },
  detalleLabel: { fontSize: 9, fontWeight: '800', color: COLORS.textLight, textTransform: 'uppercase', letterSpacing: 0.5 },
  detalleValor: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  detalleRol: { fontWeight: '400', color: COLORS.textLight },

  detalleCaja: { borderRadius: 8, padding: 10 },
  cajaUrgente: { backgroundColor: 'rgba(220,38,38,0.08)' },
  cajaUrgenteTexto: { fontSize: 13, color: COLORS.danger, fontWeight: '600' },
  cajaVenc: { backgroundColor: '#FFFBEB', gap: 4 },
  cajaVencMercaderia: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  cajaVencFecha: { fontSize: 13, fontWeight: '600', color: COLORS.success },
  cajaVencNota: { fontSize: 13, color: COLORS.text },
  cajaAccion: { backgroundColor: 'rgba(0,48,135,0.07)' },
  cajaAccionTexto: { fontSize: 13, color: COLORS.secondary, fontWeight: '600' },
  cajaBaja: { backgroundColor: 'rgba(220,38,38,0.08)' },
  cajaBajaTexto: { fontSize: 13, color: COLORS.danger, fontWeight: '600' },

  detallleNota: { fontSize: 12, color: COLORS.textLight, fontStyle: 'italic' },

  vacio: { alignItems: 'center', paddingTop: 60, gap: 10 },
  vacioEmoji: { fontSize: 40 },
  vacioTexto: { fontSize: 14, color: COLORS.textLight, textAlign: 'center' },

  seccionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  seccionTituloRojo: { fontSize: 15, fontWeight: '800', color: COLORS.danger },
  seccionTituloAmbar: { fontSize: 15, fontWeight: '800', color: '#D97706' },
  seccionBadge: {
    borderRadius: 10, minWidth: 22, height: 22,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6,
  },
  seccionBadgeTexto: { color: '#fff', fontSize: 11, fontWeight: '800' },
  seccionVacio: {
    backgroundColor: COLORS.card, borderRadius: 10, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: COLORS.border,
  },
  seccionVacioTexto: { color: COLORS.textLight, fontSize: 13, textAlign: 'center' },
});
