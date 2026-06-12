import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Modal, ScrollView, Alert,
} from 'react-native';
import {
  obtenerAsignaciones, asignarRuta, obtenerRutas,
  obtenerAsignacionesFijas, guardarAsignacionFija, eliminarAsignacionFija,
} from '../../services/api';
import { COLORS } from '../../constants';
import SelectorFechas from '../../components/SelectorFechas';
import SelectorPersonas from '../../components/SelectorPersonas';
import SelectorModal from '../../components/SelectorModal';

const ICONO_ROL: Record<string, string> = { repartidor: '🚚', preventista: '👔', supervisor: '🛡️', admin: '⭐' };
import Buscador from '../../components/Buscador';
import { coincideBusqueda } from '../../utils/busqueda';
import { format } from 'date-fns';

export default function Asignaciones() {
  const [asignaciones, setAsignaciones] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [rutas, setRutas] = useState<any[]>([]);
  const [fijas, setFijas] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);

  // Modal asignación manual
  const [modalVisible, setModalVisible] = useState(false);
  const [usuarioSel, setUsuarioSel] = useState<any>(null);
  const [rutaSel, setRutaSel] = useState<any>(null);
  const [fechaNueva, setFechaNueva] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [busquedaRuta, setBusquedaRuta] = useState('');

  // Modal ruta fija
  const [modalFijaVisible, setModalFijaVisible] = useState(false);
  const [usuarioFijaSel, setUsuarioFijaSel] = useState<any>(null);
  const [rutaFijaSel, setRutaFijaSel] = useState<any>(null);
  const [busquedaFija, setBusquedaFija] = useState('');

  // Filtros lista diaria
  const [fechaFiltro, setFechaFiltro] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [usuarioFiltro, setUsuarioFiltro] = useState<number | null>(null);

  // Sección rutas fijas expandida/colapsada
  const [mostrarFijas, setMostrarFijas] = useState(true);

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setCargando(true);
    try {
      const [asigRes, rutasRes, fijasRes] = await Promise.all([
        obtenerAsignaciones(),
        obtenerRutas(),
        obtenerAsignacionesFijas(),
      ]);
      setAsignaciones(asigRes.data.asignaciones ?? asigRes.data);
      setUsuarios(asigRes.data.usuarios ?? []);
      setRutas(rutasRes.data);
      setFijas(fijasRes.data);
    } catch {}
    setCargando(false);
  };

  // ── Asignación manual ──────────────────────────────────────────────────────
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

  // ── Rutas habilitadas ────────────────────────────────────────────────────────
  const abrirModalFija = (usuario: any) => {
    setUsuarioFijaSel(usuario);
    setRutaFijaSel(null);
    setBusquedaFija('');
    setModalFijaVisible(true);
  };

  const handleGuardarFija = async () => {
    if (!usuarioFijaSel || !rutaFijaSel) {
      Alert.alert('Error', 'Seleccioná una ruta');
      return;
    }
    try {
      await guardarAsignacionFija(usuarioFijaSel.id, rutaFijaSel.id);
      setModalFijaVisible(false);
      cargar();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? 'No se pudo guardar');
    }
  };

  const handleEliminarFija = async (usuario_id: number, ruta_id: number) => {
    Alert.alert('Quitar ruta', '¿Querés quitar esta ruta habilitada para este usuario?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar', style: 'destructive', onPress: async () => {
          try {
            await eliminarAsignacionFija(usuario_id, ruta_id);
            cargar();
          } catch {
            Alert.alert('Error', 'No se pudo quitar la ruta');
          }
        }
      }
    ]);
  };

  // ── Filtros ────────────────────────────────────────────────────────────────
  const asignacionesFiltradas = useMemo(() => {
    return asignaciones.filter((a) => {
      const fechaOk = format(new Date(a.fecha), 'yyyy-MM-dd') === fechaFiltro;
      const usuarioOk = usuarioFiltro === null || a.usuario?.id === usuarioFiltro;
      return fechaOk && usuarioOk;
    });
  }, [asignaciones, fechaFiltro, usuarioFiltro]);

  const rutasFiltradas = useMemo(() => {
    return rutas.filter((r) => coincideBusqueda(busquedaRuta, r.nombre, r.descripcion));
  }, [rutas, busquedaRuta]);

  const rutasFijasFiltradas = useMemo(() => {
    const yaAsignadas = new Set(
      fijas.filter((f) => f.usuario_id === usuarioFijaSel?.id).map((f) => f.ruta_id)
    );
    return rutas
      .filter((r) => !yaAsignadas.has(r.id))
      .filter((r) => coincideBusqueda(busquedaFija, r.nombre, r.descripcion));
  }, [rutas, busquedaFija, fijas, usuarioFijaSel]);

  const personasNoAdmin = usuarios.filter((u) => u.rol !== 'admin');

  if (cargando) return <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;

  return (
    <View style={styles.container}>
      <ScrollView>
        {/* ── Sección Rutas habilitadas ─────────────────────────────────── */}
        <TouchableOpacity style={styles.fijasHeader} onPress={() => setMostrarFijas((v) => !v)}>
          <View>
            <Text style={styles.fijasHeaderTitulo}>⚙️ Rutas habilitadas</Text>
            <Text style={styles.fijasHeaderSub}>
              Cada repartidor/preventista elige cuál de estas rutas hacer al iniciar jornada (se resetea los domingos)
            </Text>
          </View>
          <Text style={styles.chevron}>{mostrarFijas ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {mostrarFijas && (
          <View style={styles.fijasList}>
            {personasNoAdmin.map((usuario) => {
              const fijasUsuario = fijas.filter((f) => f.usuario_id === usuario.id);
              return (
                <View key={usuario.id} style={styles.fijaRow}>
                  <View style={styles.fijaInfo}>
                    <Text style={styles.fijaNombre}>
                      {usuario.rol === 'repartidor' ? '🚚' : usuario.rol === 'supervisor' ? '🛡️' : '👔'} {usuario.nombre}
                    </Text>
                    {fijasUsuario.length ? (
                      fijasUsuario.map((f) => (
                        <View key={f.id} style={styles.fijaRutaRow}>
                          <Text style={styles.fijaRuta}>📍 {f.ruta.nombre}</Text>
                          <TouchableOpacity onPress={() => handleEliminarFija(usuario.id, f.ruta_id)}>
                            <Text style={styles.btnFijaQuitarTexto}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      ))
                    ) : (
                      <Text style={[styles.fijaRuta, styles.fijaRutaVacia]}>Sin rutas habilitadas</Text>
                    )}
                  </View>
                  <TouchableOpacity style={styles.btnFija} onPress={() => abrirModalFija(usuario)}>
                    <Text style={styles.btnFijaTexto}>+ Ruta</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
            {personasNoAdmin.length === 0 && (
              <Text style={styles.vacioChico}>No hay usuarios registrados</Text>
            )}
          </View>
        )}

        {/* ── Asignaciones manuales del día ─────────────────────────────── */}
        <SelectorFechas fecha={fechaFiltro} onCambiar={setFechaFiltro} diasAtras={7} diasAdelante={7} />

        {personasNoAdmin.length > 0 && (
          <View style={styles.filtroPersonas}>
            <SelectorPersonas personas={personasNoAdmin} seleccionado={usuarioFiltro} onSeleccionar={setUsuarioFiltro} />
          </View>
        )}

        <View style={styles.headerBar}>
          <Text style={styles.total}>{asignacionesFiltradas.length} asignación(es) manuales</Text>
          <TouchableOpacity style={styles.btnNueva} onPress={() => setModalVisible(true)}>
            <Text style={styles.btnNuevaTexto}>+ Manual</Text>
          </TouchableOpacity>
        </View>

        {asignacionesFiltradas.map((item) => (
          <View key={item.id} style={[
            styles.card,
            { borderLeftColor: item.usuario?.rol === 'repartidor' ? COLORS.repartidor : item.usuario?.rol === 'supervisor' ? COLORS.supervisor : COLORS.preventista }
          ]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardNombre}>{item.usuario?.nombre}</Text>
              <Text style={styles.cardRol}>
                {item.usuario?.rol === 'repartidor' ? '🚚' : item.usuario?.rol === 'supervisor' ? '🛡️' : '👔'} {item.usuario?.rol}
              </Text>
            </View>
            <Text style={styles.cardRuta}>📍 {item.ruta?.nombre}</Text>
            <Text style={styles.cardFecha}>{format(new Date(item.fecha), 'dd/MM/yyyy')}</Text>
          </View>
        ))}

        {asignacionesFiltradas.length === 0 && (
          <Text style={styles.vacio}>
            No hay asignaciones manuales para ese día{usuarioFiltro ? ' y esa persona' : ''}.{'\n'}
            Las rutas fijas se aplican automáticamente.
          </Text>
        )}
      </ScrollView>

      {/* ── Modal asignación manual ────────────────────────────────────────── */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitulo}>Asignación manual</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCerrar}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
            <Text style={styles.label}>¿Para qué día?</Text>
            <SelectorFechas fecha={fechaNueva} onCambiar={setFechaNueva} diasAtras={0} diasAdelante={21} />
            <Text style={styles.label}>¿Quién va a hacer el recorrido?</Text>
            <SelectorModal
              titulo="¿Quién va a hacer el recorrido?"
              opciones={personasNoAdmin.map((u) => u.nombre)}
              valor={usuarioSel?.nombre ?? ''}
              onSeleccionar={(v) => setUsuarioSel(personasNoAdmin.find((u) => u.nombre === v) ?? null)}
              iconos={Object.fromEntries(personasNoAdmin.map((u) => [u.nombre, ICONO_ROL[u.rol] ?? '']))}
              placeholder="Elegí una persona"
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
              {rutasFiltradas.length === 0 && <Text style={styles.vacioChico}>No se encontraron rutas</Text>}
            </View>
            <TouchableOpacity style={styles.btnConfirmar} onPress={handleAsignar}>
              <Text style={styles.btnConfirmarTexto}>Asignar para ese día</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Modal agregar ruta habilitada ─────────────────────────────────── */}
      <Modal visible={modalFijaVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitulo}>Habilitar ruta</Text>
              {usuarioFijaSel && (
                <Text style={styles.modalSub}>{usuarioFijaSel.nombre}</Text>
              )}
            </View>
            <TouchableOpacity onPress={() => setModalFijaVisible(false)}>
              <Text style={styles.modalCerrar}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
            <Text style={styles.label}>
              Agregá una ruta que esta persona pueda elegir al iniciar jornada
            </Text>
            <Buscador valor={busquedaFija} onCambiar={setBusquedaFija} placeholder="Buscar ruta..." />
            <View style={{ gap: 8 }}>
              {rutasFijasFiltradas.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.opcion, rutaFijaSel?.id === r.id && styles.opcionSel]}
                  onPress={() => setRutaFijaSel(r)}
                >
                  <Text style={styles.opcionTexto}>📍 {r.nombre}</Text>
                  {r.descripcion && <Text style={styles.opcionDesc}>{r.descripcion}</Text>}
                  <Text style={styles.opcionDesc}>{r.clientes?.length ?? 0} clientes</Text>
                </TouchableOpacity>
              ))}
              {rutasFijasFiltradas.length === 0 && (
                <Text style={styles.vacioChico}>No hay más rutas para habilitar</Text>
              )}
            </View>
            <TouchableOpacity style={styles.btnConfirmar} onPress={handleGuardarFija}>
              <Text style={styles.btnConfirmarTexto}>Habilitar ruta</Text>
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

  // Rutas fijas
  fijasHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, backgroundColor: COLORS.primary,
  },
  fijasHeaderTitulo: { fontSize: 15, fontWeight: '700', color: '#fff' },
  fijasHeaderSub: { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  chevron: { fontSize: 14, color: '#fff' },
  fijasList: {
    backgroundColor: COLORS.card,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  fijaRow: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  fijaInfo: { flex: 1, gap: 4 },
  fijaNombre: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  fijaRutaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  fijaRuta: { fontSize: 12, color: COLORS.primary, marginTop: 2 },
  fijaRutaVacia: { color: COLORS.textLight },
  fijaBtns: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  btnFija: { backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  btnFijaTexto: { color: '#fff', fontWeight: '700', fontSize: 12 },
  btnFijaQuitarTexto: { color: COLORS.danger, fontWeight: '700', fontSize: 14 },

  // Diarias
  filtroPersonas: { backgroundColor: COLORS.card, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16,
  },
  total: { fontSize: 14, color: COLORS.text, fontWeight: '600' },
  btnNueva: { backgroundColor: COLORS.accent, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  btnNuevaTexto: { color: '#fff', fontWeight: '700', fontSize: 14 },
  card: {
    backgroundColor: COLORS.card, borderRadius: 14, padding: 16, gap: 6, borderLeftWidth: 4,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, marginHorizontal: 16, marginBottom: 10,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardNombre: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  cardRol: { fontSize: 12, color: COLORS.textLight },
  cardRuta: { fontSize: 14, color: COLORS.text },
  cardFecha: { fontSize: 12, color: COLORS.textLight },
  vacio: {
    textAlign: 'center', color: COLORS.textLight, marginTop: 24, fontSize: 14,
    paddingHorizontal: 30, lineHeight: 22,
  },
  vacioChico: { textAlign: 'center', color: COLORS.textLight, fontSize: 13, paddingVertical: 12 },

  // Modales
  modal: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, backgroundColor: COLORS.card,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  modalTitulo: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  modalSub: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
  modalCerrar: { fontSize: 20, color: COLORS.textLight },
  label: { fontSize: 13, fontWeight: '700', color: COLORS.textLight, textTransform: 'uppercase' },
  opcion: {
    backgroundColor: COLORS.card, borderRadius: 10, padding: 14, borderWidth: 2, borderColor: COLORS.border,
  },
  opcionSel: { borderColor: COLORS.primary, backgroundColor: '#EEF4FF' },
  opcionTexto: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  opcionDesc: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  btnConfirmar: {
    backgroundColor: COLORS.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8,
  },
  btnConfirmarTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
