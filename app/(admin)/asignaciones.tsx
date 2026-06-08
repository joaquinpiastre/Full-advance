import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Modal, ScrollView, Alert,
} from 'react-native';
import { obtenerAsignaciones, asignarRuta, obtenerRutas } from '../../services/api';
import { COLORS } from '../../constants';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Asignaciones() {
  const [asignaciones, setAsignaciones] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [rutas, setRutas] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [usuarioSel, setUsuarioSel] = useState<any>(null);
  const [rutaSel, setRutaSel] = useState<any>(null);
  const [fecha, setFecha] = useState(format(new Date(), 'yyyy-MM-dd'));

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
      Alert.alert('Error', 'Seleccioná usuario y ruta');
      return;
    }
    try {
      await asignarRuta({ usuario_id: usuarioSel.id, ruta_id: rutaSel.id, fecha });
      setModalVisible(false);
      setUsuarioSel(null);
      setRutaSel(null);
      cargar();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? 'No se pudo asignar');
    }
  };

  if (cargando) return <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;

  const hoy = format(new Date(), "EEEE d 'de' MMMM", { locale: es });

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <Text style={styles.fecha}>{hoy}</Text>
        <TouchableOpacity style={styles.btnNueva} onPress={() => setModalVisible(true)}>
          <Text style={styles.btnNuevaTexto}>+ Nueva</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={asignaciones}
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
          <Text style={styles.vacio}>No hay asignaciones para hoy</Text>
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
            <Text style={styles.label}>Usuario</Text>
            {usuarios.filter((u) => u.rol !== 'admin').map((u) => (
              <TouchableOpacity
                key={u.id}
                style={[styles.opcion, usuarioSel?.id === u.id && styles.opcionSel]}
                onPress={() => setUsuarioSel(u)}
              >
                <Text style={styles.opcionTexto}>
                  {u.rol === 'repartidor' ? '🚚' : '👔'} {u.nombre}
                </Text>
              </TouchableOpacity>
            ))}

            <Text style={styles.label}>Ruta</Text>
            {rutas.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={[styles.opcion, rutaSel?.id === r.id && styles.opcionSel]}
                onPress={() => setRutaSel(r)}
              >
                <Text style={styles.opcionTexto}>📍 {r.nombre}</Text>
                {r.descripcion && <Text style={styles.opcionDesc}>{r.descripcion}</Text>}
              </TouchableOpacity>
            ))}

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
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  fecha: { fontSize: 14, color: COLORS.text, fontWeight: '600', textTransform: 'capitalize' },
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
