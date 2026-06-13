import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Modal, TextInput, Alert, ScrollView,
} from 'react-native';
import { obtenerRutas, crearRuta, actualizarRuta, obtenerRuta, obtenerClientes, eliminarRuta, quitarClienteDeRuta } from '../../services/api';
import { COLORS } from '../../constants';
import { Cliente, Ruta } from '../../types';
import Buscador from '../../components/Buscador';
import { coincideBusqueda } from '../../utils/busqueda';

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
  const [clienteAQuitar, setClienteAQuitar] = useState<{ cliente_id: number; nombre: string } | null>(null);
  const [notaQuitar, setNotaQuitar] = useState('');
  const [rutaRenombrando, setRutaRenombrando] = useState<Ruta | null>(null);
  const [nombreRenombrar, setNombreRenombrar] = useState('');

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
    return clientes.filter((c) => {
      if (departamentoSel && c.departamento !== departamentoSel) return false;
      return coincideBusqueda(busquedaCliente, c.nombre, c.direccion, c.rubro, c.razon_social, c.zona, c.telefono, c.contacto_nombre);
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

  const abrirRenombrar = (ruta: Ruta) => {
    setRutaRenombrando(ruta);
    setNombreRenombrar(ruta.nombre);
  };

  const handleRenombrar = async () => {
    if (!rutaRenombrando) return;
    const nuevoNombre = nombreRenombrar.trim();
    if (!nuevoNombre) { Alert.alert('Error', 'El nombre es obligatorio'); return; }
    try {
      const datos = {
        nombre: nuevoNombre,
        descripcion: rutaRenombrando.descripcion ?? null,
        clientes: rutaRenombrando.clientes.map((c) => c.cliente_id),
      };
      await actualizarRuta(rutaRenombrando.id, datos);
      setRutas((prev) => prev.map((r) => (r.id === rutaRenombrando.id ? { ...r, nombre: nuevoNombre } : r)));
      if (detalleRuta?.id === rutaRenombrando.id) setDetalleRuta({ ...detalleRuta, nombre: nuevoNombre });
      setRutaRenombrando(null);
      setNombreRenombrar('');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? 'No se pudo renombrar la ruta');
    }
  };

  const handleEliminar = (ruta: Ruta) => {
    Alert.alert(
      'Eliminar ruta',
      `¿Seguro que querés eliminar la ruta "${ruta.nombre}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await eliminarRuta(ruta.id);
              if (detalleRuta?.id === ruta.id) setDetalleRuta(null);
              cargar();
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.error ?? 'No se pudo eliminar la ruta');
            }
          },
        },
      ]
    );
  };

  const handleQuitarCliente = async () => {
    if (!detalleRuta || !clienteAQuitar) return;
    if (!notaQuitar.trim()) { Alert.alert('Error', 'Tenés que explicar el motivo'); return; }
    try {
      await quitarClienteDeRuta(detalleRuta.id, clienteAQuitar.cliente_id, notaQuitar.trim());
      const res = await obtenerRuta(detalleRuta.id);
      setDetalleRuta(res.data);
      setRutas((prev) => prev.map((r) => (r.id === res.data.id ? res.data : r)));
      setClienteAQuitar(null);
      setNotaQuitar('');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? 'No se pudo quitar el cliente');
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
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={styles.btnEditar} onPress={() => abrirRenombrar(detalleRuta)}>
                  <Text style={styles.btnEditarTexto}>✏️ Renombrar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnEditar} onPress={() => abrirEdicion(detalleRuta)}>
                  <Text style={styles.btnEditarTexto}>✏️ Editar clientes</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnEliminar} onPress={() => handleEliminar(detalleRuta)}>
                  <Text style={styles.btnEliminarTexto}>🗑️ Eliminar</Text>
                </TouchableOpacity>
              </View>
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
                <View style={{ flex: 1 }}>
                  <Text style={styles.clienteNombre}>{item.cliente?.nombre}</Text>
                  <Text style={styles.clienteDir}>{item.cliente?.direccion}</Text>
                </View>
                <TouchableOpacity
                  style={styles.btnQuitar}
                  onPress={() => setClienteAQuitar({ cliente_id: item.cliente_id, nombre: item.cliente?.nombre ?? '' })}
                >
                  <Text style={styles.btnQuitarTexto}>Quitar</Text>
                </TouchableOpacity>
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
                <View style={styles.cardHeader}>
                  <Text style={styles.cardNombre}>{item.nombre}</Text>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity onPress={() => abrirRenombrar(item)}>
                      <Text style={styles.cardEliminar}>✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleEliminar(item)}>
                      <Text style={styles.cardEliminar}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
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

      {/* Modal para explicar por qué se quita un cliente de la ruta */}
      <Modal visible={!!clienteAQuitar} animationType="fade" transparent>
        <View style={styles.overlay}>
          <View style={styles.notaModal}>
            <Text style={styles.notaTitulo}>Quitar de la ruta</Text>
            <Text style={styles.notaSubtitulo}>
              {clienteAQuitar?.nombre} se quitará de esta ruta (sigue existiendo como cliente).
              Explicá el motivo, va a quedar registrado en Alertas.
            </Text>
            <TextInput
              style={styles.notaInput}
              placeholder="Motivo de la baja..."
              placeholderTextColor={COLORS.textLight}
              value={notaQuitar}
              onChangeText={setNotaQuitar}
              multiline
              numberOfLines={4}
            />
            <View style={styles.notaAcciones}>
              <TouchableOpacity
                style={styles.notaCancelar}
                onPress={() => { setClienteAQuitar(null); setNotaQuitar(''); }}
              >
                <Text style={styles.notaCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.notaConfirmar} onPress={handleQuitarCliente}>
                <Text style={styles.notaConfirmarTexto}>Quitar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal para renombrar la ruta */}
      <Modal visible={!!rutaRenombrando} animationType="fade" transparent>
        <View style={styles.overlay}>
          <View style={styles.notaModal}>
            <Text style={styles.notaTitulo}>Renombrar ruta</Text>
            <TextInput
              style={styles.input}
              placeholder="Nombre de la ruta"
              placeholderTextColor={COLORS.textLight}
              value={nombreRenombrar}
              onChangeText={setNombreRenombrar}
              autoFocus
            />
            <View style={styles.notaAcciones}>
              <TouchableOpacity
                style={styles.notaCancelar}
                onPress={() => { setRutaRenombrando(null); setNombreRenombrar(''); }}
              >
                <Text style={styles.notaCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.notaConfirmar} onPress={handleRenombrar}>
                <Text style={styles.notaConfirmarTexto}>Guardar</Text>
              </TouchableOpacity>
            </View>
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
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardEliminar: { fontSize: 16 },
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
  btnEliminar: { backgroundColor: COLORS.danger, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  btnEliminarTexto: { color: '#fff', fontWeight: '700', fontSize: 13 },
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
  btnQuitar: { backgroundColor: COLORS.danger, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  btnQuitarTexto: { color: '#fff', fontWeight: '700', fontSize: 12 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  notaModal: { backgroundColor: COLORS.card, borderRadius: 16, padding: 20, width: '100%', maxWidth: 420, gap: 12 },
  notaTitulo: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  notaSubtitulo: { fontSize: 13, color: COLORS.textLight, lineHeight: 18 },
  notaInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: COLORS.background,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  notaAcciones: { flexDirection: 'row', gap: 10, marginTop: 4 },
  notaCancelar: {
    flex: 1, borderRadius: 10, padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  notaCancelarTexto: { color: COLORS.textLight, fontWeight: '700' },
  notaConfirmar: { flex: 1, backgroundColor: COLORS.danger, borderRadius: 10, padding: 14, alignItems: 'center' },
  notaConfirmarTexto: { color: '#fff', fontWeight: '700' },
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
