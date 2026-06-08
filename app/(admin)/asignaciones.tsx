import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Modal, ScrollView, Alert,
} from 'react-native';
import { obtenerAsignaciones, asignarRuta, obtenerRutas } from '../../services/api';
import { COLORS } from '../../constants';
import SelectorFechas from '../../components/SelectorFechas';
import SelectorPersonas from '../../components/SelectorPersonas';
import Buscador from '../../components/Buscador';
import { format } from 'date-fns';

export default function Asignaciones() {
  const [asignaciones, setAsignaciones] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [rutas, setRutas] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [usuarioSel, setUsuarioSel] = useState<any>(null);
  const [rutaSel, setRutaSel] = useState<any>(null);
  const [fechaNueva, setFechaNueva] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [busquedaRuta, setBusquedaRuta] = useState('');

  // Filtros de la lista: por día y por repartidor/preventista
  const [fechaFiltro, setFechaFiltro] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [usuarioFiltro, setUsuarioFiltro] = useState<number | null>(null);

  useEffect(() => {
    cargar();
  }, []);

  const cargar = async () => {
    setCargando(true);
    try {
      const [asigRes, rutasRes] = await Promise.all([
        obtenerAsignaciones(),
        obtenerRutas(),
      ]);
      setAsignaciones(asigRes.data.asignaciones ?? asigRes.data);
      setUsuarios(asigRes.data.usuarios ?? []);
      setRutas(rutasRes.data);
    } catch {}
    setCargando(false);
  };

  const handleAsignar = async () => {
    if (!usuarioSel || !rutaSel) {
      Alert.alert('Error', 'Seleccioná repartidor/preventista y ruta');
      return;
    }
    try {
      await asignarRuta({ usuario_id: usuarioSel.id, ruta_id: rutaSel.id, fecha: fechaNueva });
      setModalVisible(false);
      setUsuarioSel(null);
      setRutaSel(null);
      setBusquedaRuta('');
      setFechaNueva(format(new Date(), 'yyyy-MM-dd'));
      cargar();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? 'No se pudo asignar');
    }
  };

  const asignacionesFiltradas = useMemo(() => {
    return asignaciones.filter((a) => {
      const fechaOk = format(new Date(a.fecha), 'yyyy-MM-dd') === fechaFiltro;
      const usuarioOk = usuarioFiltro === null || a.usuario?.id === usuarioFiltro;
      return fechaOk && usuarioOk;
    });
  }, [asignaciones, fechaFiltro, usuarioFiltro]);

  const rutasFiltradas = useMemo(() => {
    const q = busquedaRuta.trim().toLowerCase();
    if (!q) return rutas;
    return rutas.filter((r) => r.nombre?.toLowerCase().includes(q) || r.descripcion?.toLowerCase().includes(q));
  }, [rutas, busquedaRuta]);

  const personasNoAdmin = usuarios.filter((u) => u.rol !== 'admin');

  if (cargando) return <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;

  return (
    <View style={styles.container}>
      <SelectorFechas fecha={fechaFiltro} onCambiar={setFechaFiltro} diasAtras={7} diasAdelante={7} />

      {personasNoAdmin.length > 0 && (
        <View style={styles.filtroPersonas}>
          <SelectorPersonas personas={personasNoAdmin} seleccionado={usuarioFiltro} onSeleccionar={setUsuarioFiltro} />
        </View>
      )}

      <View style={styles.headerBar}>
        <Text style={styles.total}>{asignacionesFiltradas.length} asignación(es)</Text>
        <TouchableOpacity style={styles.btnNueva} onPress={() => setModalVisible(true)}>
          <Text style={styles.btnNuevaTexto}>+ Nueva</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={asignacionesFiltradas}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        renderItem={({ item }) => (
          <View style={[
            styles.card,
            { borderLeftColor: item.usuario?.rol === 'repartidor' ? COLORS.repartidor : COLORS.preventista }
          ]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardNombre}>{item.usuario?.nombre}</Text>
              <Text style={styles.cardRol}>
                {item.usuario?.rol === 'repartidor' ? '🚚' : '👔'} {item.usuario?.rol}
              </Text>
            </View>
            <Text style={styles.cardRuta}>📍 {item.ruta?.nombre}</Text>
            <Text style={styles.cardFecha}>{format(new Date(item.fecha), 'dd/MM/yyyy')}</Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.vacio}>No hay asignaciones para ese día{usuarioFiltro ? ' y esa persona' : ''}</Text>
        }
      />

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitulo}>Nueva asignación</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCerrar}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
            <Text style={styles.label}>¿Para qué día?</Text>
            <SelectorFechas fecha={fechaNueva} onCambiar={setFechaNueva} diasAtras={0} diasAdelante={21} />

            <Text style={styles.label}>¿Quién va a hacer el recorrido?</Text>
            <SelectorPersonas
              personas={personasNoAdmin}
              seleccionado={usuarioSel?.id ?? null}
              onSeleccionar={(id) => setUsuarioSel(personasNoAdmin.find((u) => u.id === id) ?? null)}
              incluirTodos={false}
            />

            <Text style={styles.label}>Ruta ({rutas.length} disponibles)</Text>
            <Buscador valor={busquedaRuta} onCambiar={setBusquedaRuta} placeholder="Buscar ruta por nombre..." />
            <View style={{ gap: 8 }}>
              {rutasFiltradas.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.opcion, rutaSel?.id === r.id && styles.opcionSel]}
                  onPress={() => setRutaSel(r)}
                >
                  <Text style={styles.opcionTexto}>📍 {r.nombre}</Text>
                  {r.descripcion && <Text style={styles.opcionDesc}>{r.descripcion}</Text>}
                  <Text style={styles.opcionDesc}>{r.clientes?.length ?? 0} clientes</Text>
                </TouchableOpacity>
              ))}
              {rutasFiltradas.length === 0 && (
                <Text style={styles.vacioChico}>No se encontraron rutas con ese nombre</Text>
              )}
            </View>

            <TouchableOpacity style={styles.btnConfirmar} onPress={handleAsignar}>
              <Text style={styles.btnConfirmarTexto}>Asignar</Text>
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
  filtroPersonas: { backgroundColor: COLORS.card, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  total: { fontSize: 14, color: COLORS.text, fontWeight: '600' },
  btnNueva: { backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  btnNuevaTexto: { color: '#fff', fontWeight: '700', fontSize: 14 },
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
  cardNombre: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  cardRol: { fontSize: 12, color: COLORS.textLight },
  cardRuta: { fontSize: 14, color: COLORS.text },
  cardFecha: { fontSize: 12, color: COLORS.textLight },
  vacio: { textAlign: 'center', color: COLORS.textLight, marginTop: 60, fontSize: 14, paddingHorizontal: 30 },
  vacioChico: { textAlign: 'center', color: COLORS.textLight, fontSize: 13, paddingVertical: 12 },
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
  label: { fontSize: 13, fontWeight: '700', color: COLORS.textLight, textTransform: 'uppercase' },
  opcion: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 14,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  opcionSel: { borderColor: COLORS.primary, backgroundColor: '#EEF4FF' },
  opcionTexto: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  opcionDesc: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  btnConfirmar: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnConfirmarTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
