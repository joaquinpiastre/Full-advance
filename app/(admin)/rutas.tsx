import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Modal, TextInput, Alert, ScrollView,
} from 'react-native';
import { obtenerRutas, crearRuta, actualizarRuta, obtenerRuta, obtenerClientes } from '../../services/api';
import { COLORS } from '../../constants';
import { Cliente, Ruta } from '../../types';
import Buscador from '../../components/Buscador';

export default function Rutas() {
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [clientesSel, setClientesSel] = useState<number[]>([]);
  const [detalleRuta, setDetalleRuta] = useState<Ruta | null>(null);
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [rutaEditando, setRutaEditando] = useState<Ruta | null>(null);
  const [departamentoSel, setDepartamentoSel] = useState<string | null>(null);

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

  const departamentos = useMemo(() => {
    const set = new Set<string>();
    clientes.forEach((c) => { if (c.departamento) set.add(c.departamento); });
    return Array.from(set).sort();
  }, [clientes]);

  const clientesFiltrados = useMemo(() => {
    const q = busquedaCliente.trim().toLowerCase();
    return clientes.filter((c) => {
      if (departamentoSel && c.departamento !== departamentoSel) return false;
      if (!q) return true;
      return c.nombre?.toLowerCase().includes(q)
        || c.direccion?.toLowerCase().includes(q)
        || c.rubro?.toLowerCase().includes(q)
        || c.zona?.toLowerCase().includes(q);
    });
  }, [clientes, busquedaCliente, departamentoSel]);

  const cerrarModal = () => {
    setModalVisible(false);
    setNombre('');
    setDescripcion('');
    setClientesSel([]);
    setBusquedaCliente('');
    setDepartamentoSel(null);
    setRutaEditando(null);
  };

  const abrirNuevo = () => {
    setRutaEditando(null);
    setNombre('');
    setDescripcion('');
    setClientesSel([]);
    setBusquedaCliente('');
    setDepartamentoSel(null);
    setModalVisible(true);
  };

  const abrirEdicion = (ruta: Ruta) => {
    setRutaEditando(ruta);
    setNombre(ruta.nombre);
    setDescripcion(ruta.descripcion ?? '');
    setClientesSel(ruta.clientes.map((c) => c.cliente_id));
    setBusquedaCliente('');
    setDepartamentoSel(null);
    setModalVisible(true);
  };

  const handleGuardar = async () => {
    if (!nombre.trim()) { Alert.alert('Error', 'El nombre es obligatorio'); return; }
    if (clientesSel.length === 0) { Alert.alert('Error', 'Seleccioná al menos un cliente'); return; }
    try {
      const datos = { nombre: nombre.trim(), descripcion: descripcion.trim() || null, clientes: clientesSel };
      if (rutaEditando) {
        await actualizarRuta(rutaEditando.id, datos);
        const res = await obtenerRuta(rutaEditando.id);
        setDetalleRuta(res.data);
      } else {
        await crearRuta(datos);
      }
      cerrarModal();
      cargar();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? 'No se pudo guardar');
    }
  };

  if (cargando) return <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;

  return (
    <View style={styles.container}>
      {detalleRuta ? (
        // Vista de detalle de una ruta
        <>
          <View style={styles.detalleHeader}>
            <View style={styles.detalleHeaderTop}>
              <TouchableOpacity onPress={() => setDetalleRuta(null)}>
                <Text style={styles.back}>← Volver</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnEditar} onPress={() => abrirEdicion(detalleRuta)}>
                <Text style={styles.btnEditarTexto}>✏️ Editar clientes</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.detalleTitulo}>{detalleRuta.nombre}</Text>
            {detalleRuta.descripcion ? <Text style={styles.detalleDesc}>{detalleRuta.descripcion}</Text> : null}
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
        </>
      ) : (
        // Vista de lista de rutas
        <>
          <View style={styles.headerBar}>
            <Text style={styles.total}>{rutas.length} rutas</Text>
            <TouchableOpacity style={styles.btnNuevo} onPress={abrirNuevo}>
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
        </>
      )}

      {/* Modal siempre renderizado — así funciona tanto desde la lista como desde el detalle */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitulo}>{rutaEditando ? 'Editar ruta' : 'Nueva ruta'}</Text>
            <TouchableOpacity onPress={cerrarModal}>
              <Text style={styles.modalCerrar}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Campos fijos arriba */}
          <View style={styles.formCabecera}>
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
            {clientesSel.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                <View style={styles.seleccionadosFila}>
                  {clientesSel.map((id) => {
                    const c = clientes.find((x) => x.id === id);
                    if (!c) return null;
                    return (
                      <TouchableOpacity key={id} style={styles.seleccionadoChip} onPress={() => toggleCliente(id)}>
                        <Text style={styles.seleccionadoChipTexto}>{c.nombre} ✕</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            )}
            <Buscador valor={busquedaCliente} onCambiar={setBusquedaCliente} placeholder="Buscar por nombre, dirección, zona..." />
            {departamentos.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                <View style={styles.departamentosFila}>
                  <TouchableOpacity
                    style={[styles.depChip, !departamentoSel && styles.depChipSel]}
                    onPress={() => setDepartamentoSel(null)}
                  >
                    <Text style={[styles.depChipTexto, !departamentoSel && styles.depChipTextoSel]}>Todos</Text>
                  </TouchableOpacity>
                  {departamentos.map((dep) => (
                    <TouchableOpacity
                      key={dep}
                      style={[styles.depChip, departamentoSel === dep && styles.depChipSel]}
                      onPress={() => setDepartamentoSel(departamentoSel === dep ? null : dep)}
                    >
                      <Text style={[styles.depChipTexto, departamentoSel === dep && styles.depChipTextoSel]}>{dep}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>

          {/* Lista virtualizada — no freezea con 669 clientes */}
          <FlatList
            data={clientesFiltrados}
            keyExtractor={(item) => String(item.id)}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8, gap: 8 }}
            renderItem={({ item: c }) => (
              <TouchableOpacity
                style={[styles.opcion, clientesSel.includes(c.id) && styles.opcionSel]}
                onPress={() => toggleCliente(c.id)}
              >
                <Text style={styles.opcionTexto}>
                  {clientesSel.includes(c.id) ? '✅ ' : ''}{c.nombre}
                </Text>
                <Text style={styles.opcionDir}>{c.direccion}{c.zona ? ` · ${c.zona}` : ''}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.vacioChico}>No se encontraron clientes con ese filtro</Text>
            }
          />

          {/* Botón fijo abajo */}
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.btnGuardar} onPress={handleGuardar}>
              <Text style={styles.btnGuardarTexto}>{rutaEditando ? 'Guardar cambios' : 'Crear ruta'}</Text>
            </TouchableOpacity>
          </View>
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
  vacioChico: { textAlign: 'center', color: COLORS.textLight, fontSize: 13, paddingVertical: 12 },
  detalleHeader: {
    padding: 16,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 6,
  },
  detalleHeaderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },
  btnEditar: { backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  btnEditarTexto: { color: '#fff', fontWeight: '700', fontSize: 13 },
  detalleTitulo: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  detalleDesc: { fontSize: 13, color: COLORS.textLight },
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
  formCabecera: { padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalFooter: { padding: 16, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.card },
  seleccionadosFila: { flexDirection: 'row', flexWrap: 'nowrap', gap: 8 },
  seleccionadoChip: {
    backgroundColor: '#EEF4FF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  seleccionadoChipTexto: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  departamentosFila: { flexDirection: 'row', gap: 8 },
  depChip: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  depChipSel: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  depChipTexto: { fontSize: 12, fontWeight: '600', color: COLORS.textLight },
  depChipTextoSel: { color: '#fff' },
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
