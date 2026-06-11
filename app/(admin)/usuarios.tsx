import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Modal, TextInput, Alert, ScrollView,
} from 'react-native';
import { obtenerUsuarios, crearUsuario, actualizarUsuario, eliminarUsuario } from '../../services/api';
import { COLORS } from '../../constants';
import { Usuario } from '../../types';

const FORM_VACIO = { nombre: '', email: '', password: '', rol: 'repartidor', horario_preferido: '' };
const ROLES = [
  { key: 'repartidor', label: '🚚 Repartidor', color: COLORS.repartidor },
  { key: 'preventista', label: '👔 Preventista', color: COLORS.preventista },
  { key: 'supervisor', label: '🛡️ Supervisor', color: COLORS.supervisor },
];
const ROL_COLOR: Record<string, string> = Object.fromEntries(ROLES.map((r) => [r.key, r.color]));
const ROL_LABEL: Record<string, string> = Object.fromEntries(ROLES.map((r) => [r.key, r.label]));

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    cargar();
  }, []);

  const cargar = async () => {
    setCargando(true);
    try {
      const res = await obtenerUsuarios();
      setUsuarios(res.data);
    } catch {}
    setCargando(false);
  };

  const abrirNuevo = () => {
    setEditando(null);
    setForm(FORM_VACIO);
    setModalVisible(true);
  };

  const abrirEditar = (usuario: Usuario) => {
    setEditando(usuario);
    setForm({
      nombre: usuario.nombre,
      email: usuario.email,
      password: '',
      rol: usuario.rol,
      horario_preferido: usuario.horario_preferido ?? '',
    });
    setModalVisible(true);
  };

  const handleGuardar = async () => {
    if (!form.nombre.trim() || !form.email.trim() || (!editando && !form.password.trim())) {
      Alert.alert('Error', 'Completá todos los campos');
      return;
    }
    setGuardando(true);
    try {
      if (editando) {
        await actualizarUsuario(editando.id, {
          nombre: form.nombre.trim(),
          email: form.email.trim().toLowerCase(),
          rol: form.rol,
          horario_preferido: form.horario_preferido.trim() || undefined,
          password: form.password.trim() || undefined,
        });
        setModalVisible(false);
        Alert.alert('Listo', 'El usuario fue actualizado');
      } else {
        await crearUsuario({
          nombre: form.nombre.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          rol: form.rol,
          horario_preferido: form.horario_preferido.trim() || undefined,
        });
        setModalVisible(false);
        Alert.alert('Listo', 'El usuario fue creado');
      }
      cargar();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? 'No se pudo guardar el usuario');
    }
    setGuardando(false);
  };

  const handleEliminar = (usuario: Usuario) => {
    Alert.alert(
      'Eliminar usuario',
      `¿Seguro que querés eliminar a ${usuario.nombre}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await eliminarUsuario(usuario.id);
              cargar();
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.error ?? 'No se pudo eliminar el usuario');
            }
          },
        },
      ]
    );
  };

  if (cargando) return <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;

  const noAdmins = usuarios.filter((u) => u.rol !== 'admin' && u.activo !== false);

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <Text style={styles.total}>{noAdmins.length} usuarios</Text>
        <TouchableOpacity style={styles.btnNuevo} onPress={abrirNuevo}>
          <Text style={styles.btnNuevoTexto}>+ Nuevo</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={noAdmins}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.card,
              { borderLeftColor: ROL_COLOR[item.rol] ?? COLORS.preventista }
            ]}
            onPress={() => abrirEditar(item)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardNombre}>{item.nombre}</Text>
              <Text style={styles.cardRol}>
                {ROL_LABEL[item.rol] ?? item.rol}
              </Text>
            </View>
            <Text style={styles.cardEmail}>{item.email}</Text>
            {!!item.horario_preferido && <Text style={styles.cardHorario}>🕒 {item.horario_preferido}</Text>}
            <View style={styles.cardAcciones}>
              <Text style={styles.cardEditar}>✏️ Tocá para editar</Text>
              <TouchableOpacity onPress={() => handleEliminar(item)}>
                <Text style={styles.cardEliminar}>🗑️ Eliminar</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.vacio}>No hay usuarios registrados</Text>}
      />

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitulo}>{editando ? 'Editar usuario' : 'Nuevo usuario'}</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCerrar}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.form}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Nombre *</Text>
              <TextInput
                style={styles.input}
                placeholder="Nombre y apellido"
                placeholderTextColor={COLORS.textLight}
                value={form.nombre}
                onChangeText={(v) => setForm((p) => ({ ...p, nombre: v }))}
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Email *</Text>
              <TextInput
                style={styles.input}
                placeholder="email@ejemplo.com"
                placeholderTextColor={COLORS.textLight}
                autoCapitalize="none"
                keyboardType="email-address"
                value={form.email}
                onChangeText={(v) => setForm((p) => ({ ...p, email: v }))}
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>{editando ? 'Contraseña' : 'Contraseña *'}</Text>
              <TextInput
                style={styles.input}
                placeholder={editando ? 'Dejar en blanco para no cambiarla' : 'Contraseña inicial'}
                placeholderTextColor={COLORS.textLight}
                secureTextEntry
                value={form.password}
                onChangeText={(v) => setForm((p) => ({ ...p, password: v }))}
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Rol *</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {ROLES.map((r) => (
                  <TouchableOpacity
                    key={r.key}
                    style={[
                      styles.rolOpcion,
                      form.rol === r.key && { borderColor: r.color, backgroundColor: '#F5F7FA' },
                    ]}
                    onPress={() => setForm((p) => ({ ...p, rol: r.key }))}
                  >
                    <Text style={styles.rolTexto}>{r.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Horario preferido</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: Mañana de 8 a 13"
                placeholderTextColor={COLORS.textLight}
                value={form.horario_preferido}
                onChangeText={(v) => setForm((p) => ({ ...p, horario_preferido: v }))}
              />
            </View>

            <TouchableOpacity style={styles.btnGuardar} onPress={handleGuardar} disabled={guardando}>
              {guardando
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnGuardarTexto}>{editando ? 'Guardar cambios' : 'Crear usuario'}</Text>}
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
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardNombre: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  cardRol: { fontSize: 12, color: COLORS.textLight },
  cardEmail: { fontSize: 13, color: COLORS.textLight },
  cardHorario: { fontSize: 12, color: COLORS.textLight },
  cardAcciones: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  cardEditar: { fontSize: 11, color: COLORS.primary, fontWeight: '600' },
  cardEliminar: { fontSize: 11, color: COLORS.danger, fontWeight: '600' },
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
  form: { padding: 16, gap: 14 },
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
  rolOpcion: {
    flex: 1,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  rolTexto: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  btnGuardar: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnGuardarTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
