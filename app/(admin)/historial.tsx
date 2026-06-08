import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Modal, ScrollView, Image,
} from 'react-native';
import { obtenerHistorialJornadas, obtenerDetalleJornada, obtenerUsuarios } from '../../services/api';
import { descargarFoto, descargarReporteJornada } from '../../services/descargas';
import { COLORS, urlFoto } from '../../constants';
import SelectorPersonas from '../../components/SelectorPersonas';
import { format, differenceInMinutes, isToday, isThisWeek, isThisMonth } from 'date-fns';
import { es } from 'date-fns/locale';

const RANGOS = [
  { key: 'todo', label: 'Todo' },
  { key: 'hoy', label: 'Hoy' },
  { key: 'semana', label: 'Esta semana' },
  { key: 'mes', label: 'Este mes' },
] as const;
type RangoKey = typeof RANGOS[number]['key'];

const enRango = (fecha: string, rango: RangoKey) => {
  if (rango === 'todo') return true;
  const d = new Date(fecha);
  if (rango === 'hoy') return isToday(d);
  if (rango === 'semana') return isThisWeek(d, { weekStartsOn: 1 });
  return isThisMonth(d);
};

export default function HistorialAdmin() {
  const [jornadas, setJornadas] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [detalle, setDetalle] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [usuarioFiltro, setUsuarioFiltro] = useState<number | null>(null);
  const [rango, setRango] = useState<RangoKey>('todo');

  useEffect(() => {
    obtenerUsuarios().then((res) => setUsuarios(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setCargando(true);
    obtenerHistorialJornadas(usuarioFiltro ?? undefined)
      .then((res) => setJornadas(res.data))
      .catch(() => {})
      .finally(() => setCargando(false));
  }, [usuarioFiltro]);

  const verDetalle = async (jornadaId: number) => {
    try {
      const res = await obtenerDetalleJornada(jornadaId);
      setDetalle(res.data);
      setModalVisible(true);
    } catch {}
  };

  const jornadasFiltradas = useMemo(
    () => jornadas.filter((j) => enRango(j.fecha_inicio, rango)),
    [jornadas, rango]
  );

  const personasNoAdmin = usuarios.filter((u) => u.rol !== 'admin');

  return (
    <View style={styles.container}>
      {personasNoAdmin.length > 0 && (
        <View style={styles.filtroBar}>
          <SelectorPersonas personas={personasNoAdmin} seleccionado={usuarioFiltro} onSeleccionar={setUsuarioFiltro} />
        </View>
      )}
      <View style={styles.rangoBar}>
        {RANGOS.map((r) => {
          const activo = rango === r.key;
          return (
            <TouchableOpacity
              key={r.key}
              style={[styles.rangoChip, activo && styles.rangoChipActivo]}
              onPress={() => setRango(r.key)}
            >
              <Text style={[styles.rangoTexto, activo && styles.rangoTextoActivo]}>{r.label}</Text>
            </TouchableOpacity>
          );
        })}
        <Text style={styles.total}>{jornadasFiltradas.length} jornada(s)</Text>
      </View>

      {cargando ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>
      ) : (
      <FlatList
        data={jornadasFiltradas}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        renderItem={({ item }) => {
          const duracion = item.fecha_fin
            ? differenceInMinutes(new Date(item.fecha_fin), new Date(item.fecha_inicio))
            : null;
          const esRepartidor = item.usuario?.rol === 'repartidor';
          return (
            <TouchableOpacity
              style={[styles.card, { borderLeftColor: esRepartidor ? COLORS.repartidor : COLORS.preventista }]}
              onPress={() => verDetalle(item.id)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardNombre}>{item.usuario?.nombre}</Text>
                <Text style={styles.cardRol}>
                  {esRepartidor ? '🚚' : '👔'} {item.usuario?.rol}
                </Text>
              </View>
              <Text style={styles.cardFecha}>
                {format(new Date(item.fecha_inicio), "EEEE d 'de' MMMM", { locale: es })}
              </Text>
              <View style={styles.cardRow}>
                <Text style={styles.cardDato}>
                  🕐 {format(new Date(item.fecha_inicio), 'HH:mm')}
                  {item.fecha_fin ? ` → ${format(new Date(item.fecha_fin), 'HH:mm')}` : ' (en curso)'}
                </Text>
                {duracion !== null && <Text style={styles.cardDato}>⏱ {duracion} min</Text>}
              </View>
              <Text style={styles.cardParadas}>
                {item.total_paradas ?? 0} paradas
              </Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<Text style={styles.vacio}>No hay historial para este filtro</Text>}
      />
      )}

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitulo}>{detalle?.usuario?.nombre}</Text>
              <Text style={styles.modalSub}>
                {detalle?.fecha_inicio && format(new Date(detalle.fecha_inicio), "d 'de' MMMM yyyy", { locale: es })}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCerrar}>✕</Text>
            </TouchableOpacity>
          </View>
          {detalle && (
            <TouchableOpacity style={styles.btnPdf} onPress={() => descargarReporteJornada(detalle)}>
              <Text style={styles.btnPdfTexto}>📄 Descargar reporte en PDF</Text>
            </TouchableOpacity>
          )}
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
            {detalle?.paradas?.map((p: any) => (
              <View key={p.id} style={styles.paradaCard}>
                <View style={styles.paradaHeaderRow}>
                  <Text style={styles.paradaNombre}>{p.cliente?.nombre ?? 'Sin cliente'}</Text>
                  <Text style={styles.paradaHora}>{format(new Date(p.timestamp_llegada), 'HH:mm')}</Text>
                </View>
                <Text style={styles.paradaDireccion}>{p.cliente?.direccion}</Text>
                {(p.foto1_uri || p.foto2_uri) && (
                  <View style={styles.fotosRow}>
                    {p.foto1_uri && (
                      <View>
                        <Text style={styles.fotoLabel}>Foto 1</Text>
                        <Image source={{ uri: urlFoto(p.foto1_uri) }} style={styles.foto} />
                        <TouchableOpacity style={styles.btnDescargar} onPress={() => descargarFoto(p.foto1_uri)}>
                          <Text style={styles.btnDescargarTexto}>📥 Guardar</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    {p.foto2_uri && (
                      <View>
                        <Text style={styles.fotoLabel}>Foto 2</Text>
                        <Image source={{ uri: urlFoto(p.foto2_uri) }} style={styles.foto} />
                        <TouchableOpacity style={styles.btnDescargar} onPress={() => descargarFoto(p.foto2_uri)}>
                          <Text style={styles.btnDescargarTexto}>📥 Guardar</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
                {p.nota ? <Text style={styles.nota}>📝 {p.nota}</Text> : null}
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  filtroBar: { backgroundColor: COLORS.card, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rangoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rangoChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  rangoChipActivo: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  rangoTexto: { fontSize: 12, fontWeight: '600', color: COLORS.text },
  rangoTextoActivo: { color: '#fff' },
  total: { marginLeft: 'auto', fontSize: 13, color: COLORS.textLight, fontWeight: '600' },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    gap: 6,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardNombre: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  cardRol: { fontSize: 12, color: COLORS.textLight },
  cardFecha: { fontSize: 14, color: COLORS.text, textTransform: 'capitalize' },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between' },
  cardDato: { fontSize: 13, color: COLORS.textLight },
  cardParadas: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  vacio: { textAlign: 'center', color: COLORS.textLight, marginTop: 60, fontSize: 14 },
  modal: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitulo: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  modalSub: { fontSize: 13, color: COLORS.textLight, textTransform: 'capitalize' },
  modalCerrar: { fontSize: 20, color: COLORS.textLight },
  btnPdf: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnPdfTexto: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnDescargar: {
    marginTop: 6,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  btnDescargarTexto: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  paradaCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  paradaHeaderRow: { flexDirection: 'row', justifyContent: 'space-between' },
  paradaNombre: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  paradaHora: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  paradaDireccion: { fontSize: 13, color: COLORS.textLight },
  fotosRow: { flexDirection: 'row', gap: 16 },
  fotoLabel: { fontSize: 11, color: COLORS.textLight, fontWeight: '600', marginBottom: 4 },
  foto: { width: 130, height: 130, borderRadius: 8 },
  nota: { fontSize: 13, color: COLORS.text, fontStyle: 'italic' },
});
