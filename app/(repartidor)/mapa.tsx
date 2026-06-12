import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useJornadaStore } from '../../store/jornadaStore';
import { obtenerAsignacionHoy, obtenerParadas } from '../../services/api';
import MapaRuta from '../../components/MapaRuta';
import { COLORS } from '../../constants';
import { Cliente } from '../../types';

export default function MapaRepartidor() {
  const { jornada } = useJornadaStore();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [visitados, setVisitados] = useState<Set<number>>(new Set());
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const asigRes = await obtenerAsignacionHoy();
      setClientes(asigRes.data?.ruta?.clientes?.map((c: any) => c.cliente) ?? []);
      if (jornada) {
        const paradasRes = await obtenerParadas(jornada.id);
        setVisitados(new Set(
          paradasRes.data.filter((p: any) => p.completada && p.cliente_id).map((p: any) => p.cliente_id)
        ));
      }
    } catch {}
    setCargando(false);
  }, [jornada]);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  if (cargando) return <View style={styles.center}><ActivityIndicator color={COLORS.repartidor} size="large" /></View>;

  if (!clientes.length) {
    return (
      <View style={styles.center}>
        <Text style={styles.vacio}>No hay clientes en la ruta de hoy</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapaRuta clientes={clientes} visitados={visitados} color={COLORS.repartidor} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  vacio: { textAlign: 'center', color: COLORS.textLight, fontSize: 14 },
});
