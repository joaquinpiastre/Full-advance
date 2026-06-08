import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Modal, TextInput, Alert, ScrollView,
} from 'react-native';
import { obtenerRutas, crearRuta, obtenerClientes } from '../../services/api';
import { COLORS } from '../../constants';
import { Cliente, Ruta } from '../../types';

export default function Rutas() {
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [clientesSel, setClientesSel] = useState<number[]>([]);
  const [detalleRuta, setDetalleRuta] = useState<Ruta | null>(null);

  useEffect(() => {
    cargar();
  }, []);

  const cargar = async () => {
    setCargando(true);
    try {
      const [rutasRes, clientesRes] = await Promise.all([obtenerRutas(), obtenerClientes()]);
      setRutas(rutasRes.data);
      setClientes(clientesRes.data);
    } catch {}
    setCargando(false);
  };

  const toggleCliente = (id: number) => {
    setClientesSel((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleCrear = async () => {
    if (!nombre.trim()) { Alert.alert('Error', 'El nombre es obligatorio'); return; }
    if (clientesSel.length === 0) { Alert.alert('Error', 'Seleccioná al menos un cliente'); return; }
    try {
      await crearRuta({ nombre: nombre.trim(), descripcion: descripcion.trim() || null, clientes: clientesSel });
      setModalVisible(false);
      setNombre('');
      setDescripcion('');
      setClientesSel([]);
      cargar();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? 'No se pudo crear');
    }
  };

  if (cargando) return <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;

  if (detalleRuta) {
    return (
      <View style={styles.container}>
        <View style={styles.detalleHeader}>
          <TouchableOpacity onPress={() => setDetalleRuta(null)}>
            <Text style={styles.back}>← Volver</Text>
          </TouchableOpacity>
          <Text style={styles.detalleTitulo}>{detalleRuta.nombre}</Text>
        </View>
        <FlatList
          data={detalleRuta.clientes}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          renderItem={({ item, index }) => (
            <View style={styles.clienteCard}>
              <View style={styles.clienteOrden}>
                <Text style={styles.clienteOrdenNum}>{index + 1}</Text>
              </View>
              <View>
                <Text style={styles.clienteNombre}>{item.cliente?.nombre}</Text>
                <Text style={styles.clienteDir}>{item.cliente?.direccion}</Text>
              </View>
            </View>
          )}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <Text style={styles.total}>{rutas.length} rutas</Text>
        <TouchableOpacity style={styles.btnNuevo} onPress={() => setModalVisible(true)}>
          <Text style={styles.btnNuevoTexto}>+ Nueva ruta</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={rutas}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => setDetalleRuta(item)}>
            <Text style={styles.cardNombre}>{item.nombre}</Text>
            {item.descripcion && <Text style={styles.cardDesc}>{item.descripcion}</Text>}
            <Text style={styles.cardClientes}>{item.clientes?.length ?? 0} clientes</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.vacio}>No hay rutas registradas</Text>}
      />

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitulo}>Nueva ruta</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCerrar}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Nombre *</Text>
              <TextInput
                style={styles.input}
                placeholder="Nombre de la ruta"
                placeholderTextColor={COLORS.textLight}
                value={nombre}
                onChangeText={setNombre}
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Descripción</Text>
              <TextInput
                style={styles.input}
                placeholder="Opcional"
                placeholderTextColor={COLORS.textLight}
                value={descripcion}
                onChangeText={setDescripcion}
              />
            </View>
            <Text style={styles.label}>Clientes ({clientesSel.length} seleccionados)</Text>
            {clientes.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.opcion, clientesSel.includes(c.id) && styles.opcionSel]}
                onPress={() => toggleCliente(c.id)}
              >
                <Text style={styles.opcionTexto}>{c.nombre}</Text>
                <Text style={styles.opcionDir}>{c.direccion}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.btnGuardar} onPress={handleCrear}>
              <Text style={styles.btnGuardarTexto}>Crear ruta</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  total: { fontSize: 14, color: COLORS.text, fontWeight: '600' },
  btnNuevo: { backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  btnNuevoTexto: { color: '#fff', fontWeight: '700', fontSize: 14 },
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
    borderLeftColor: COLORS.primary,
  },
  cardNombre: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  cardDesc: { fontSize: 13, color: COLORS.textLight },
  cardClientes: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  vacio: { textAlign: 'center', color: COLORS.textLight, marginTop: 60, fontSize: 14 },
  detalleHeader: {
    padding: 16,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 6,
  },
  back: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },
  detalleTitulo: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  clienteCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clienteOrden: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clienteOrdenNum: { color: '#fff', fontWeight: '700' },
  clienteNombre: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  clienteDir: { fontSize: 12, color: COLORS.textLight },
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
  formGroup: { gap: 4 },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.textLight, textTransform: 'uppercase' },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: COLORS.text,
    backgroundColor: COLORS.card,
  },
  opcion: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 14,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  opcionSel: { borderColor: COLORS.primary, backgroundColor: '#EEF4FF' },
  opcionTexto: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  opcionDir: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  btnGuardar: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnGuardarTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
