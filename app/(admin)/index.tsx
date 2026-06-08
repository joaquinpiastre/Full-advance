import { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { suscribirUbicaciones } from '../../services/gpsFeed';
import { UbicacionLive } from '../../types';
import { COLORS } from '../../constants';
import { format } from 'date-fns';
import MapaLive from '../../components/MapaLive';

export default function AdminMapa() {
  const [ubicaciones, setUbicaciones] = useState<UbicacionLive[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    const unsub = suscribirUbicaciones((data) => {
      setUbicaciones(data);
      setLastUpdate(new Date());
    });
    return unsub;
  }, []);

  const repartidores = ubicaciones.filter((u) => u.rol === 'repartidor');
  const preventistas = ubicaciones.filter((u) => u.rol === 'preventista');

  return (
    <View style={styles.container}>
      <View style={styles.leyenda}>
        <View style={styles.leyendaItem}>
          <View style={[styles.leyendaDot, { backgroundColor: COLORS.repartidor }]} />
          <Text style={styles.leyendaTexto}>Repartidores ({repartidores.length})</Text>
        </View>
        <View style={styles.leyendaItem}>
          <View style={[styles.leyendaDot, { backgroundColor: COLORS.preventista }]} />
          <Text style={styles.leyendaTexto}>Preventistas ({preventistas.length})</Text>
        </View>
        {lastUpdate && (
          <Text style={styles.actualizado}>Actualizado {format(lastUpdate, 'HH:mm:ss')}</Text>
        )}
      </View>

      <View style={{ flex: 1 }}>
        {ubicaciones.length === 0 && (
          <Text style={styles.sinActivos}>No hay usuarios activos en este momento</Text>
        )}
        <MapaLive ubicaciones={ubicaciones} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  leyenda: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 12,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexWrap: 'wrap',
  },
  leyendaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  leyendaDot: { width: 12, height: 12, borderRadius: 6 },
  leyendaTexto: { fontSize: 13, color: COLORS.text, fontWeight: '600' },
  actualizado: { fontSize: 11, color: COLORS.textLight, marginLeft: 'auto' },
  sinActivos: {
    position: 'absolute',
    top: 24,
    alignSelf: 'center',
    zIndex: 10,
    backgroundColor: COLORS.card,
    color: COLORS.textLight,
    fontSize: 13,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    overflow: 'hidden',
  },
});
