import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Modal, ScrollView, Image,
} from 'react-native';
import { obtenerHistorialJornadas, obtenerDetalleJornada } from '../../services/api';
import { COLORS } from '../../constants';
import { format, differenceInMinutes } from 'date-fns';
import { es } from 'date-fns/locale';

export default function HistorialAdmin() {
  const [jornadas, setJornadas] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [detalle, setDetalle] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    obtenerHistorialJornadas()
      .then((res) => setJornadas(res.data))
      .catch(() => {})
      .finally(() => setCargando(false));
  }, []);

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
        ListEmptyComponent={<Text style={styles.vacio}>No hay historial registrado</Text>}
      />

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitulo}>{detalle?.usuario?.nombre}</Text>
              <Text style={styles.modalSub}>
                {detalle?.fecha_inicio && format(new Date(detalle.fecha_inicio), "d 'de' MMMM yyyy", { locale: es })}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCerrar}>✕</Text>
            </TouchableOpacity>
          </View>
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
                        <Image source={{ uri: p.foto1_uri }} style={styles.foto} />
                      </View>
                    )}
                    {p.foto2_uri && (
                      <View>
                        <Text style={styles.fotoLabel}>Foto 2</Text>
                        <Image source={{ uri: p.foto2_uri }} style={styles.foto} />
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
