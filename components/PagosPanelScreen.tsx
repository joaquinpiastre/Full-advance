import { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, FlatList, Alert } from 'react-native';
import { obtenerPagos, obtenerEstadisticasPagos, eliminarPago } from '../services/api';
import { COLORS } from '../constants';
import { Pago, MetodoPago, Rol } from '../types';
import { formatMoney } from '../utils/dinero';
import { isoADDMMAAAA } from '../utils/fechas';
import { METODOS_PAGO, METODO_LABEL, METODO_COLOR } from '../utils/pagos';
import { coincideBusqueda } from '../utils/busqueda';
import Buscador from './Buscador';
import { format, parse } from 'date-fns';
import { es } from 'date-fns/locale';

interface Resumen {
  totalCobrado30d: number;
  cantidadPagos30d: number;
  promedioPorPago: number;
  pendienteTotal: number;
}
interface PorDia { fecha: string; total: number; }
interface PorUsuario { usuario_id: number; nombre: string; rol: Rol; total_cobrado: number; cantidad_pagos: number; }
interface PorMetodo { metodo_pago: MetodoPago; total: number; cantidad: number; }

const ROL_LABEL: Record<string, string> = {
  repartidor: 'Repartidor',
  preventista: 'Preventista',
  supervisor: 'Supervisor',
  admin: 'Admin',
};

type Props = { puedeEliminar?: boolean };

export default function PagosPanelScreen({ puedeEliminar = false }: Props) {
  const [cargando, setCargando] = useState(true);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [porDia, setPorDia] = useState<PorDia[]>([]);
  const [porUsuario, setPorUsuario] = useState<PorUsuario[]>([]);
  const [porMetodo, setPorMetodo] = useState<PorMetodo[]>([]);

  const [busqueda, setBusqueda] = useState('');
  const [metodoFiltro, setMetodoFiltro] = useState<MetodoPago | null>(null);
  const [usuarioFiltro, setUsuarioFiltro] = useState<number | null>(null);
  const [eliminandoId, setEliminandoId] = useState<number | null>(null);

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setCargando(true);
    try {
      const [resPagos, resStats] = await Promise.all([obtenerPagos(), obtenerEstadisticasPagos()]);
      setPagos(resPagos.data);
      setResumen(resStats.data.resumen);
      setPorDia(resStats.data.porDia ?? []);
      setPorUsuario(resStats.data.porUsuario ?? []);
      setPorMetodo(resStats.data.porMetodo ?? []);
    } catch {}
    setCargando(false);
  };

  const usuariosDisponibles = useMemo(() => {
    const map = new Map<number, string>();
    pagos.forEach((p) => { if (p.autor_nombre) map.set(p.usuario_id, p.autor_nombre); });
    return Array.from(map.entries()).map(([id, nombre]) => ({ id, nombre }));
  }, [pagos]);

  const pagosFiltrados = useMemo(() => {
    return pagos.filter((p) => {
      const coincideTexto = coincideBusqueda(busqueda, p.cliente_nombre, p.numero_cliente, p.numero_factura, p.autor_nombre);
      const coincideMetodo = !metodoFiltro || p.metodo_pago === metodoFiltro;
      const coincideUsuario = !usuarioFiltro || p.usuario_id === usuarioFiltro;
      return coincideTexto && coincideMetodo && coincideUsuario;
    });
  }, [pagos, busqueda, metodoFiltro, usuarioFiltro]);

  const handleEliminar = (pago: Pago) => {
    Alert.alert('Eliminar pago', `¿Eliminar el pago de ${pago.cliente_nombre}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          setEliminandoId(pago.id);
          try {
            await eliminarPago(pago.id);
            setPagos((prev) => prev.filter((p) => p.id !== pago.id));
          } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.error ?? 'No se pudo eliminar el pago');
          }
          setEliminandoId(null);
        },
      },
    ]);
  };

  if (cargando) return <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;

  const maxDia = Math.max(1, ...porDia.map((d) => d.total));
  const maxUsuario = Math.max(1, ...porUsuario.map((u) => u.total_cobrado));
  const maxMetodo = Math.max(1, ...porMetodo.map((m) => m.total));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contenido}>
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValor}>{formatMoney(resumen?.totalCobrado30d)}</Text>
          <Text style={styles.statLabel}>Cobrado{'\n'}(últimos 30 días)</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValor}>{resumen?.cantidadPagos30d ?? 0}</Text>
          <Text style={styles.statLabel}>Pagos{'\n'}registrados (30d)</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValor}>{formatMoney(resumen?.promedioPorPago)}</Text>
          <Text style={styles.statLabel}>Promedio{'\n'}por pago</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValor, { color: COLORS.danger }]}>{formatMoney(resumen?.pendienteTotal)}</Text>
          <Text style={styles.statLabel}>Pendiente{'\n'}de cobro</Text>
        </View>
      </View>

      <View style={styles.seccion}>
        <Text style={styles.seccionTitulo}>Cobros por día (últimos 14 días)</Text>
        {porDia.every((d) => d.total === 0) && (
          <Text style={styles.vacio}>No se registraron cobros en este período</Text>
        )}
        <View style={styles.grafico}>
          {porDia.map((d) => {
            const fecha = parse(d.fecha, 'yyyy-MM-dd', new Date());
            return (
              <View key={d.fecha} style={styles.barraCol}>
                <Text style={styles.barraValor} numberOfLines={1}>{d.total > 0 ? formatMoney(d.total) : ''}</Text>
                <View style={styles.barraTrack}>
                  <View style={[styles.barraFill, { height: `${Math.max(4, (d.total / maxDia) * 100)}%` }, d.total === 0 && styles.barraVacia]} />
                </View>
                <Text style={styles.barraDia}>{format(fecha, 'EEEEE', { locale: es })}</Text>
                <Text style={styles.barraFecha}>{format(fecha, 'd/M')}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.seccion}>
        <Text style={styles.seccionTitulo}>Quién cobró más (últimos 30 días)</Text>
        {porUsuario.length === 0 && <Text style={styles.vacio}>Todavía no hay pagos registrados</Text>}
        {porUsuario.map((u, i) => (
          <View key={u.usuario_id} style={styles.rankingItem}>
            <View style={styles.rankingPos}>
              <Text style={styles.rankingPosTexto}>{i + 1}</Text>
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <View style={styles.rankingHeader}>
                <Text style={styles.rankingNombre} numberOfLines={1}>{u.nombre}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeTexto}>{ROL_LABEL[u.rol] ?? u.rol}</Text>
                </View>
              </View>
              <View style={styles.rankingBarraTrack}>
                <View style={[styles.rankingBarraFill, { width: `${(u.total_cobrado / maxUsuario) * 100}%` }]} />
              </View>
              <Text style={styles.rankingDato}>
                {formatMoney(u.total_cobrado)} · {u.cantidad_pagos} {u.cantidad_pagos === 1 ? 'pago' : 'pagos'}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.seccion}>
        <Text style={styles.seccionTitulo}>Por método de pago (últimos 30 días)</Text>
        {porMetodo.length === 0 && <Text style={styles.vacio}>Sin datos todavía</Text>}
        {porMetodo.map((m) => {
          const color = METODO_COLOR[m.metodo_pago] ?? COLORS.textLight;
          return (
            <View key={m.metodo_pago} style={styles.categoriaRow}>
              <View style={[styles.categoriaBadge, { backgroundColor: color }]}>
                <Text style={styles.categoriaBadgeTexto}>{m.cantidad}</Text>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.metodoLabel}>{METODO_LABEL[m.metodo_pago] ?? m.metodo_pago}</Text>
                <View style={styles.categoriaBarraTrack}>
                  <View style={[styles.categoriaBarraFill, { width: `${(m.total / maxMetodo) * 100}%`, backgroundColor: color }]} />
                </View>
              </View>
              <Text style={styles.categoriaTotal}>{formatMoney(m.total)}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.seccion}>
        <Text style={styles.seccionTitulo}>Historial de pagos</Text>
        <Buscador valor={busqueda} onCambiar={setBusqueda} placeholder="Buscar por cliente, número, factura..." />

        <View style={styles.chipsRow}>
          {METODOS_PAGO.map((m) => {
            const activo = metodoFiltro === m.value;
            const color = METODO_COLOR[m.value];
            return (
              <TouchableOpacity
                key={m.value}
                style={[styles.chip, { borderColor: color }, activo && { backgroundColor: color }]}
                onPress={() => setMetodoFiltro(activo ? null : m.value)}
              >
                <Text style={[styles.chipTexto, { color: activo ? '#fff' : color }]}>{m.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {usuariosDisponibles.length > 1 && (
          <View style={styles.chipsRow}>
            {usuariosDisponibles.map((u) => {
              const activo = usuarioFiltro === u.id;
              return (
                <TouchableOpacity
                  key={u.id}
                  style={[styles.chip, { borderColor: COLORS.primary }, activo && { backgroundColor: COLORS.primary }]}
                  onPress={() => setUsuarioFiltro(activo ? null : u.id)}
                >
                  <Text style={[styles.chipTexto, { color: activo ? '#fff' : COLORS.primary }]}>{u.nombre}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <Text style={styles.total}>{pagosFiltrados.length} de {pagos.length} pagos</Text>

        <FlatList
          data={pagosFiltrados}
          keyExtractor={(item) => String(item.id)}
          scrollEnabled={false}
          contentContainerStyle={{ gap: 10 }}
          renderItem={({ item }) => {
            const saldo = item.monto_a_cobrar - item.monto_pagado;
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardCliente} numberOfLines={1}>
                    {item.cliente_nombre}
                    {item.numero_cliente ? <Text style={styles.cardClienteNumero}> · #{item.numero_cliente}</Text> : null}
                  </Text>
                  <View style={[styles.pill, { backgroundColor: METODO_COLOR[item.metodo_pago] }]}>
                    <Text style={styles.pillTexto}>{METODO_LABEL[item.metodo_pago]}</Text>
                  </View>
                </View>
                <Text style={styles.cardDato}>📅 {isoADDMMAAAA(item.fecha_pago)} · 👤 Cargado por {item.autor_nombre} ({ROL_LABEL[item.autor_rol ?? ''] ?? item.autor_rol})</Text>
                <View style={styles.cardMontos}>
                  <Text style={styles.cardMontoTexto}>A cobrar: <Text style={styles.cardMontoValor}>{formatMoney(item.monto_a_cobrar)}</Text></Text>
                  <Text style={styles.cardMontoTexto}>Pagado: <Text style={[styles.cardMontoValor, { color: COLORS.success }]}>{formatMoney(item.monto_pagado)}</Text></Text>
                  {saldo > 0 && (
                    <Text style={styles.cardMontoTexto}>Saldo: <Text style={[styles.cardMontoValor, { color: COLORS.danger }]}>{formatMoney(saldo)}</Text></Text>
                  )}
                </View>
                {item.numero_factura && <Text style={styles.cardDato}>🧾 Factura #{item.numero_factura}</Text>}
                {item.numero_cheque && <Text style={styles.cardDato}>💵 Cheque #{item.numero_cheque}</Text>}
                {item.nota && <Text style={styles.cardNota}>📝 {item.nota}</Text>}

                {puedeEliminar && (
                  <TouchableOpacity
                    style={styles.btnEliminar}
                    onPress={() => handleEliminar(item)}
                    disabled={eliminandoId === item.id}
                  >
                    {eliminandoId === item.id
                      ? <ActivityIndicator color={COLORS.danger} size="small" />
                      : <Text style={styles.btnEliminarTexto}>🗑️ Eliminar</Text>}
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.vacio}>No se encontraron pagos con ese filtro</Text>}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  contenido: { padding: 16, gap: 16, paddingBottom: 40 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    flexBasis: '47%', flexGrow: 1, backgroundColor: COLORS.card, borderRadius: 14, padding: 16, gap: 4,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  statValor: { fontSize: 20, fontWeight: '800', color: COLORS.primary },
  statLabel: { fontSize: 12, color: COLORS.textLight, fontWeight: '600', lineHeight: 16 },

  seccion: {
    backgroundColor: COLORS.card, borderRadius: 16, padding: 16, gap: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  seccionTitulo: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  vacio: { fontSize: 13, color: COLORS.textLight, textAlign: 'center', paddingVertical: 12 },

  grafico: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 3 },
  barraCol: { flex: 1, alignItems: 'center', gap: 3 },
  barraValor: { fontSize: 8, color: COLORS.text, fontWeight: '800', minHeight: 13 },
  barraTrack: {
    width: '100%', height: 90, backgroundColor: COLORS.background, borderRadius: 6,
    justifyContent: 'flex-end', overflow: 'hidden',
  },
  barraFill: { width: '100%', backgroundColor: COLORS.primary, borderRadius: 6 },
  barraVacia: { backgroundColor: COLORS.border },
  barraDia: { fontSize: 10, color: COLORS.text, fontWeight: '700', textTransform: 'uppercase' },
  barraFecha: { fontSize: 9, color: COLORS.textLight },

  rankingItem: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  rankingPos: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' },
  rankingPosTexto: { fontWeight: '800', fontSize: 13, color: COLORS.primary },
  rankingHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rankingNombre: { fontSize: 14, fontWeight: '700', color: COLORS.text, flexShrink: 1 },
  rankingBarraTrack: { height: 6, backgroundColor: COLORS.background, borderRadius: 3, overflow: 'hidden' },
  rankingBarraFill: { height: 6, backgroundColor: COLORS.primary, borderRadius: 3 },
  rankingDato: { fontSize: 11, color: COLORS.textLight },
  badge: { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: COLORS.textLight },
  badgeTexto: { color: '#fff', fontWeight: '800', fontSize: 11 },

  categoriaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  categoriaBadge: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  categoriaBadgeTexto: { color: '#fff', fontWeight: '800', fontSize: 13 },
  categoriaBarraTrack: { height: 10, backgroundColor: COLORS.background, borderRadius: 5, overflow: 'hidden' },
  categoriaBarraFill: { height: 10, borderRadius: 5 },
  categoriaTotal: { fontSize: 13, fontWeight: '700', color: COLORS.text, minWidth: 70, textAlign: 'right' },
  metodoLabel: { fontSize: 12, fontWeight: '600', color: COLORS.text },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  chipTexto: { fontWeight: '700', fontSize: 12 },
  total: { fontSize: 12, color: COLORS.textLight, fontWeight: '600' },

  card: {
    backgroundColor: COLORS.background, borderRadius: 12, padding: 14, gap: 6,
    borderLeftWidth: 4, borderLeftColor: COLORS.primary,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardCliente: { fontSize: 14, fontWeight: '700', color: COLORS.text, flex: 1 },
  cardClienteNumero: { fontSize: 12, fontWeight: '400', color: COLORS.textLight },
  cardDato: { fontSize: 12, color: COLORS.textLight },
  cardMontos: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 2 },
  cardMontoTexto: { fontSize: 12, color: COLORS.textLight },
  cardMontoValor: { fontWeight: '800', color: COLORS.text },
  cardNota: { fontSize: 12, color: COLORS.text, fontStyle: 'italic' },

  pill: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  pillTexto: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },

  btnEliminar: {
    borderRadius: 10, padding: 8, alignItems: 'center', marginTop: 4,
    borderWidth: 1, borderColor: COLORS.danger, backgroundColor: '#FEF2F2',
  },
  btnEliminarTexto: { color: COLORS.danger, fontWeight: '700', fontSize: 12 },
});
