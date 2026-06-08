import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image, Modal, ScrollView } from 'react-native';
import { obtenerHistorialJornadas, obtenerDetalleJornada } from '../../services/api';
import { descargarFoto, descargarReporteJornada } from '../../services/descargas';
import { COLORS, urlFoto } from '../../constants';
import { format, differenceInMinutes } from 'date-fns';
import { es } from 'date-fns/locale';

export default function HistorialRepartidor() {
  const [jornadas, setJornadas] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [detalle, setDetalle] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    cargar();
  }, []);

  const cargar = async () => {
    setCargando(true);
    try {
      const res = await obtenerHistorialJornadas();
      setJornadas(res.data);
    } catch {}
    setCargando(false);
  };

  const verDetalle = async (jornadaId: number) => {
    try {
      const res = await obtenerDetalleJornada(jornadaId);
      setDetalle(res.data);
      setModalVisible(true);
    } catch {}
  };

  if (cargando) return <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;

  return (
    <View style={styles.container}>
      <FlatList
        data={jornadas}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        renderItem={({ item }) => {
          const duracion = item.fecha_fin
            ? differenceInMinutes(new Date(item.fecha_fin), new Date(item.fecha_inicio))
            : null;
          return (
            <TouchableOpacity style={styles.card} onPress={() => verDetalle(item.id)}>
              <Text style={styles.cardFecha}>
                {format(new Date(item.fecha_inicio), "EEEE d 'de' MMMM yyyy", { locale: es })}
              </Text>
              <View style={styles.cardRow}>
                <Text style={styles.cardDato}>
                  🕐 {format(new Date(item.fecha_inicio), 'HH:mm')}
                  {item.fecha_fin ? ` → ${format(new Date(item.fecha_fin), 'HH:mm')}` : ' (en curso)'}
                </Text>
                {duracion !== null && (
                  <Text style={styles.cardDato}>⏱ {duracion} min</Text>
                )}
              </View>
              <Text style={styles.cardParadas}>{item.total_paradas ?? 0} paradas</Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<Text style={styles.vacio}>No hay jornadas registradas</Text>}
      />

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitulo}>Detalle de jornada</Text>
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
                <Text style={styles.paradaNombre}>{p.cliente?.nombre ?? 'Sin cliente'}</Text>
                <Text style={styles.paradaDireccion}>{p.cliente?.direccion}</Text>
                <Text style={styles.paradaHora}>
                  {format(new Date(p.timestamp_llegada), 'HH:mm')}
                  {p.timestamp_salida ? ` → ${format(new Date(p.timestamp_salida), 'HH:mm')}` : ''}
                </Text>
                <View style={styles.fotosRow}>
                  {p.foto1_uri && (
                    <View>
                      <Image source={{ uri: urlFoto(p.foto1_uri) }} style={styles.foto} />
                      <TouchableOpacity style={styles.btnDescargar} onPress={() => descargarFoto(p.foto1_uri)}>
                        <Text style={styles.btnDescargarTexto}>📥 Guardar</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {p.foto2_uri && (
                    <View>
                      <Image source={{ uri: urlFoto(p.foto2_uri) }} style={styles.foto} />
                      <TouchableOpacity style={styles.btnDescargar} onPress={() => descargarFoto(p.foto2_uri)}>
                        <Text style={styles.btnDescargarTexto}>📥 Guardar</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
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
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.repartidor,
  },
  cardFecha: { fontSize: 15, fontWeight: '700', color: COLORS.text, textTransform: 'capitalize' },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between' },
  cardDato: { fontSize: 13, color: COLORS.textLight },
  cardParadas: { fontSize: 13, color: COLORS.repartidor, fontWeight: '600' },
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
  paradaNombre: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  paradaDireccion: { fontSize: 13, color: COLORS.textLight },
  paradaHora: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  fotosRow: { flexDirection: 'row', gap: 10 },
  foto: { width: 120, height: 120, borderRadius: 8 },
  nota: { fontSize: 13, color: COLORS.text, fontStyle: 'italic' },
});
