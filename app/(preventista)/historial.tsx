import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { obtenerHistorialJornadas } from '../../services/api';
import { COLORS } from '../../constants';
import { format, differenceInMinutes } from 'date-fns';
import { es } from 'date-fns/locale';

export default function HistorialPreventista() {
  const [jornadas, setJornadas] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    obtenerHistorialJornadas()
      .then((res) => setJornadas(res.data))
      .catch(() => {})
      .finally(() => setCargando(false));
  }, []);

  if (cargando) return <View style={styles.center}><ActivityIndicator color={COLORS.preventista} size="large" /></View>;

  return (
    <FlatList
      style={styles.container}
      data={jornadas}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      renderItem={({ item }) => {
        const duracion = item.fecha_fin
          ? differenceInMinutes(new Date(item.fecha_fin), new Date(item.fecha_inicio))
          : null;
        return (
          <View style={styles.card}>
            <Text style={styles.fecha}>
              {format(new Date(item.fecha_inicio), "EEEE d 'de' MMMM yyyy", { locale: es })}
            </Text>
            <Text style={styles.hora}>
              🕐 {format(new Date(item.fecha_inicio), 'HH:mm')}
              {item.fecha_fin ? ` → ${format(new Date(item.fecha_fin), 'HH:mm')}` : ' (en curso)'}
              {duracion !== null ? `  •  ${duracion} min` : ''}
            </Text>
            <Text style={styles.clientes}>{item.total_paradas ?? 0} clientes visitados</Text>
          </View>
        );
      }}
      ListEmptyComponent={<Text style={styles.vacio}>No hay jornadas registradas</Text>}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.preventista,
  },
  fecha: { fontSize: 15, fontWeight: '700', color: COLORS.text, textTransform: 'capitalize' },
  hora: { fontSize: 13, color: COLORS.textLight },
  clientes: { fontSize: 13, color: COLORS.preventista, fontWeight: '600' },
  vacio: { textAlign: 'center', color: COLORS.textLight, marginTop: 60, fontSize: 14 },
});
