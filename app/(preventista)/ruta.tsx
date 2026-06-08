import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useJornadaStore } from '../../store/jornadaStore';
import { obtenerAsignacionHoy, obtenerParadas } from '../../services/api';
import CartillaModal from '../../components/CartillaModal';
import { COLORS } from '../../constants';
import { Cliente } from '../../types';

export default function RutaPreventista() {
  const { jornada } = useJornadaStore();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [paradas, setParadas] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [clienteCartilla, setClienteCartilla] = useState<Cliente | null>(null);

  useEffect(() => {
    cargar();
  }, []);

  const cargar = async () => {
    setCargando(true);
    try {
      const asigRes = await obtenerAsignacionHoy();
      const clientesRuta = asigRes.data?.ruta?.clientes?.map((c: any) => c.cliente) ?? [];
      setClientes(clientesRuta);

      if (jornada) {
        const paradasRes = await obtenerParadas(jornada.id);
        setParadas(paradasRes.data);
      }
    } catch {}
    setCargando(false);
  };

  if (cargando) return <View style={styles.center}><ActivityIndicator color={COLORS.preventista} size="large" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.resumen}>
        <Text style={styles.resumenTexto}>
          {paradas.length} / {clientes.length} clientes visitados
        </Text>
        <View style={styles.barra}>
          <View style={[styles.barraFill, { width: clientes.length ? `${(paradas.length / clientes.length) * 100}%` : '0%' }]} />
        </View>
      </View>

      <FlatList
        data={clientes}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item, index }) => {
          const visitado = paradas.some((p) => p.cliente_id === item.id);
          return (
            <View style={[styles.clienteCard, visitado && styles.clienteCardVisitado]}>
              <View style={styles.clienteOrden}>
                <Text style={styles.clienteOrdenNum}>{index + 1}</Text>
              </View>
              <View style={styles.clienteInfo}>
                <Text style={styles.clienteNombre}>{item.nombre}</Text>
                <Text style={styles.clienteDireccion}>{item.direccion}</Text>
                {item.telefono && <Text style={styles.clienteTelefono}>📞 {item.telefono}</Text>}
              </View>
              {visitado && <Text style={styles.visitadoCheck}>✓</Text>}
              <TouchableOpacity style={styles.btnCartilla} onPress={() => setClienteCartilla(item)}>
                <Text style={styles.btnCartillaIcono}>📋</Text>
              </TouchableOpacity>
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.vacio}>No hay clientes en la ruta de hoy</Text>
        }
      />

      <CartillaModal
        cliente={clienteCartilla}
        visible={!!clienteCartilla}
        color={COLORS.preventista}
        onClose={() => setClienteCartilla(null)}
        onGuardado={cargar}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  resumen: {
    backgroundColor: COLORS.card,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  resumenTexto: { fontSize: 14, color: COLORS.text, fontWeight: '600' },
  barra: { height: 8, backgroundColor: COLORS.border, borderRadius: 4 },
  barraFill: { height: 8, backgroundColor: COLORS.preventista, borderRadius: 4 },
  clienteCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.preventista,
  },
  clienteCardVisitado: { borderLeftColor: COLORS.success, opacity: 0.7 },
  clienteOrden: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.preventista,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clienteOrdenNum: { color: '#fff', fontWeight: '700', fontSize: 14 },
  clienteInfo: { flex: 1 },
  clienteNombre: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  clienteDireccion: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
  clienteTelefono: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  visitadoCheck: { fontSize: 22, color: COLORS.success, fontWeight: '700' },
  btnCartilla: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.background,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  btnCartillaIcono: { fontSize: 18 },
  vacio: { textAlign: 'center', color: COLORS.textLight, marginTop: 60, fontSize: 14 },
});
