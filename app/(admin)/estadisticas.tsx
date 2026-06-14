import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { obtenerEstadisticasClientes, obtenerEstadisticasEncuestas } from '../../services/api';
import { COLORS, COLOR_CATEGORIA } from '../../constants';
import { CategoriaCliente, EncuestaStats } from '../../types';
import { format, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import EncuestasModal from '../../components/EncuestasModal';

interface Resumen {
  totalVisitas30d: number;
  promedioDiario: number;
  clientesVisitados30d: number;
  totalClientes: number;
}
interface TopCliente {
  id: number;
  nombre: string;
  direccion: string;
  categoria?: CategoriaCliente | null;
  total_visitas: number;
  ultima_visita: string;
}
interface VisitaPorDia { fecha: string; total: number; }
interface VisitaPorCategoria { categoria: string; total: number; }

export default function EstadisticasAdmin() {
  const [cargando, setCargando] = useState(true);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [topClientes, setTopClientes] = useState<TopCliente[]>([]);
  const [visitasPorDia, setVisitasPorDia] = useState<VisitaPorDia[]>([]);
  const [visitasPorCategoria, setVisitasPorCategoria] = useState<VisitaPorCategoria[]>([]);
  const [encuestasStats, setEncuestasStats] = useState<EncuestaStats[]>([]);
  const [modalEncuestasVisible, setModalEncuestasVisible] = useState(false);

  useEffect(() => {
    cargar();
  }, []);

  const cargar = async () => {
    setCargando(true);
    try {
      const [res, encuestasRes] = await Promise.all([
        obtenerEstadisticasClientes(),
        obtenerEstadisticasEncuestas(),
      ]);
      setResumen(res.data.resumen);
      setTopClientes(res.data.topClientes ?? []);
      setVisitasPorDia(res.data.visitasPorDia ?? []);
      setVisitasPorCategoria(res.data.visitasPorCategoria ?? []);
      setEncuestasStats(encuestasRes.data ?? []);
    } catch {}
    setCargando(false);
  };

  if (cargando) return <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;

  const maxDia = Math.max(1, ...visitasPorDia.map((d) => d.total));
  const maxTop = Math.max(1, ...topClientes.map((c) => c.total_visitas));
  const maxCategoria = Math.max(1, ...visitasPorCategoria.map((c) => c.total));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contenido}>
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValor}>{resumen?.totalVisitas30d ?? 0}</Text>
          <Text style={styles.statLabel}>Visitas{'\n'}(últimos 30 días)</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValor}>{resumen?.promedioDiario ?? 0}</Text>
          <Text style={styles.statLabel}>Promedio{'\n'}de visitas/día</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValor}>{resumen?.clientesVisitados30d ?? 0}</Text>
          <Text style={styles.statLabel}>Clientes{'\n'}visitados (30d)</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValor}>{resumen?.totalClientes ?? 0}</Text>
          <Text style={styles.statLabel}>Clientes{'\n'}activos</Text>
        </View>
      </View>

      <View style={styles.seccion}>
        <Text style={styles.seccionTitulo}>Visitas por día (últimos 14 días)</Text>
        {visitasPorDia.every((d) => d.total === 0) && (
          <Text style={styles.vacio}>No se registraron visitas en este período</Text>
        )}
        <View style={styles.grafico}>
          {visitasPorDia.map((d) => {
            const fecha = parse(d.fecha, 'yyyy-MM-dd', new Date());
            return (
              <View key={d.fecha} style={styles.barraCol}>
                <Text style={styles.barraValor}>{d.total > 0 ? d.total : ''}</Text>
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
        <Text style={styles.seccionTitulo}>Clientes más visitados</Text>
        {topClientes.length === 0 && <Text style={styles.vacio}>Todavía no hay visitas completadas registradas</Text>}
        {topClientes.map((c, i) => (
          <View key={c.id} style={styles.rankingItem}>
            <View style={styles.rankingPos}>
              <Text style={styles.rankingPosTexto}>{i + 1}</Text>
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <View style={styles.rankingHeader}>
                <Text style={styles.rankingNombre} numberOfLines={1}>{c.nombre}</Text>
                {c.categoria && (
                  <View style={[styles.badge, { backgroundColor: COLOR_CATEGORIA[c.categoria] }]}>
                    <Text style={styles.badgeTexto}>{c.categoria}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.rankingDireccion} numberOfLines={1}>{c.direccion}</Text>
              <View style={styles.rankingBarraTrack}>
                <View style={[styles.rankingBarraFill, { width: `${(c.total_visitas / maxTop) * 100}%` }]} />
              </View>
              <Text style={styles.rankingDato}>
                {c.total_visitas} {c.total_visitas === 1 ? 'visita' : 'visitas'} · última el{' '}
                {format(new Date(c.ultima_visita), "d 'de' MMMM", { locale: es })}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.seccion}>
        <Text style={styles.seccionTitulo}>Visitas por categoría</Text>
        {visitasPorCategoria.length === 0 && <Text style={styles.vacio}>Sin datos todavía</Text>}
        {visitasPorCategoria.map((c) => {
          const color = COLOR_CATEGORIA[c.categoria as CategoriaCliente] ?? COLORS.textLight;
          return (
            <View key={c.categoria} style={styles.categoriaRow}>
              <View style={[styles.categoriaBadge, { backgroundColor: color }]}>
                <Text style={styles.categoriaBadgeTexto}>{c.categoria}</Text>
              </View>
              <View style={styles.categoriaBarraTrack}>
                <View style={[styles.categoriaBarraFill, { width: `${(c.total / maxCategoria) * 100}%`, backgroundColor: color }]} />
              </View>
              <Text style={styles.categoriaTotal}>{c.total}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.seccion}>
        <View style={styles.encuestasHeader}>
          <Text style={styles.seccionTitulo}>Encuestas</Text>
          <TouchableOpacity style={styles.btnGestionar} onPress={() => setModalEncuestasVisible(true)}>
            <Text style={styles.btnGestionarTexto}>⚙️ Gestionar encuestas</Text>
          </TouchableOpacity>
        </View>

        {encuestasStats.length === 0 && (
          <Text style={styles.vacio}>No hay encuestas configuradas</Text>
        )}

        {encuestasStats.map((encuesta) => {
          const total = Math.max(1, encuesta.si + encuesta.no + encuesta.sinDato);
          return (
            <View key={encuesta.id} style={styles.encuestaStatsBox}>
              <Text style={styles.encuestaStatsTitulo}>{encuesta.pregunta}</Text>
              <Text style={styles.encuestaStatsZonas}>
                {encuesta.zonas && encuesta.zonas.length ? encuesta.zonas.join(', ') : 'Todas las zonas'}
                {!encuesta.activa ? ' · Inactiva' : ''}
              </Text>
              {[
                { label: 'Sí', total: encuesta.si, color: COLORS.success },
                { label: 'No', total: encuesta.no, color: COLORS.danger },
                { label: 'Sin dato', total: encuesta.sinDato, color: COLORS.textLight },
              ].map((c) => (
                <View key={c.label} style={styles.categoriaRow}>
                  <View style={[styles.categoriaBadge, { backgroundColor: c.color }]}>
                    <Text style={styles.categoriaBadgeTexto}>{c.label}</Text>
                  </View>
                  <View style={styles.categoriaBarraTrack}>
                    <View style={[styles.categoriaBarraFill, { width: `${(c.total / total) * 100}%`, backgroundColor: c.color }]} />
                  </View>
                  <Text style={styles.categoriaTotal}>{c.total}</Text>
                </View>
              ))}
            </View>
          );
        })}
      </View>

      <EncuestasModal
        visible={modalEncuestasVisible}
        onClose={() => setModalEncuestasVisible(false)}
        onCambios={cargar}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  contenido: { padding: 16, gap: 16, paddingBottom: 40 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  statValor: { fontSize: 28, fontWeight: '800', color: COLORS.primary },
  statLabel: { fontSize: 12, color: COLORS.textLight, fontWeight: '600', lineHeight: 16 },

  seccion: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  seccionTitulo: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  vacio: { fontSize: 13, color: COLORS.textLight, textAlign: 'center', paddingVertical: 12 },

  grafico: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 3 },
  barraCol: { flex: 1, alignItems: 'center', gap: 3 },
  barraValor: { fontSize: 10, color: COLORS.text, fontWeight: '800', minHeight: 13 },
  barraTrack: {
    width: '100%',
    height: 90,
    backgroundColor: COLORS.background,
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barraFill: { width: '100%', backgroundColor: COLORS.primary, borderRadius: 6 },
  barraVacia: { backgroundColor: COLORS.border },
  barraDia: { fontSize: 10, color: COLORS.text, fontWeight: '700', textTransform: 'uppercase' },
  barraFecha: { fontSize: 9, color: COLORS.textLight },

  rankingItem: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  rankingPos: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.background,
    justifyContent: 'center', alignItems: 'center',
  },
  rankingPosTexto: { fontWeight: '800', fontSize: 13, color: COLORS.primary },
  rankingHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rankingNombre: { fontSize: 14, fontWeight: '700', color: COLORS.text, flexShrink: 1 },
  rankingDireccion: { fontSize: 12, color: COLORS.textLight },
  rankingBarraTrack: { height: 6, backgroundColor: COLORS.background, borderRadius: 3, overflow: 'hidden' },
  rankingBarraFill: { height: 6, backgroundColor: COLORS.primary, borderRadius: 3 },
  rankingDato: { fontSize: 11, color: COLORS.textLight },
  badge: { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 2 },
  badgeTexto: { color: '#fff', fontWeight: '800', fontSize: 12 },

  encuestasHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  btnGestionar: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  btnGestionarTexto: { fontSize: 12, fontWeight: '700', color: COLORS.text },
  encuestaStatsBox: { gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.background },
  encuestaStatsTitulo: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  encuestaStatsZonas: { fontSize: 12, color: COLORS.textLight, marginBottom: 2 },

  categoriaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  categoriaBadge: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  categoriaBadgeTexto: { color: '#fff', fontWeight: '800', fontSize: 13 },
  categoriaBarraTrack: { flex: 1, height: 14, backgroundColor: COLORS.background, borderRadius: 7, overflow: 'hidden' },
  categoriaBarraFill: { height: 14, borderRadius: 7 },
  categoriaTotal: { fontSize: 13, fontWeight: '700', color: COLORS.text, minWidth: 28, textAlign: 'right' },
});
