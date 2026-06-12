import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, TextInput,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { crearCliente, obtenerDepartamentos, crearDepartamento, obtenerDistritos, crearDistrito } from '../services/api';
import { COLORS } from '../constants';
import { Cliente } from '../types';
import { useAuthStore } from '../store/authStore';
import SelectorConAgregar from './SelectorConAgregar';

const TIPOS_COMERCIO = [
  'Almacén/Fiambrería', 'Autoservicio', 'Carnicería/Pollería',
  'Kiosco/MaxiKiosco', 'Verdulería', 'Dietética', 'Cotillón', 'Otros',
];

const MARCAS = ['BIMBO', 'CITRIC', 'SANAS', 'ARRABAL'];

const FORM_VACIO = {
  nombre: '', razon_social: '', cuit: '', direccion: '', telefono: '', email: '',
  zona: '', departamento: '', tipo_comercio: '', notas: '',
  marcas: [] as string[],
};

interface Props {
  visible: boolean;
  color?: string;
  onClose: () => void;
  onCreado?: (cliente: Cliente) => void;
}

export default function NuevoClienteModal({ visible, color = COLORS.primary, onClose, onCreado }: Props) {
  const { usuario } = useAuthStore();
  const puedeAgregarZonas = usuario?.rol === 'admin' || usuario?.rol === 'supervisor';
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [departamentos, setDepartamentos] = useState<string[]>([]);
  const [distritos, setDistritos] = useState<string[]>([]);

  useEffect(() => {
    if (!visible) return;
    obtenerDepartamentos().then((res) => setDepartamentos(res.data.map((d: any) => d.nombre))).catch(() => {});
    obtenerDistritos().then((res) => setDistritos(res.data.map((d: any) => d.nombre))).catch(() => {});
  }, [visible]);

  const guardar = async () => {
    if (!form.nombre.trim() || !form.direccion.trim()) {
      Alert.alert('Error', 'El nombre y la dirección son obligatorios');
      return;
    }
    setGuardando(true);
    try {
      const res = await crearCliente({
        nombre: form.nombre.trim(),
        razon_social: form.razon_social.trim() || null,
        cuit: form.cuit.trim() || null,
        direccion: form.direccion.trim(),
        telefono: form.telefono.trim() || null,
        email: form.email.trim() || null,
        zona: form.zona.trim() || null,
        departamento: form.departamento.trim() || null,
        tipo_comercio: form.tipo_comercio || null,
        marcas: form.marcas.length ? form.marcas : null,
        notas: form.notas.trim() || null,
      });
      setForm(FORM_VACIO);
      onCreado?.(res.data);
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? 'No se pudo crear el cliente');
    }
    setGuardando(false);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modal}>
        <View style={[styles.header, { backgroundColor: color }]}>
          <Text style={styles.headerTitulo}>Nuevo cliente</Text>
          <TouchableOpacity onPress={onClose} style={styles.btnCerrar}>
            <Text style={styles.cerrar}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.form}>
          <Text style={styles.aviso}>
            ➕ Cargá un nuevo cliente. Quedará agregado a tu ruta de hoy.
          </Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Nombre *</Text>
            <TextInput
              style={styles.input}
              placeholder="Nombre del cliente"
              placeholderTextColor={COLORS.textLight}
              value={form.nombre}
              onChangeText={(v) => setForm((prev) => ({ ...prev, nombre: v }))}
            />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Razón social</Text>
            <TextInput
              style={styles.input}
              placeholder="Nombre legal / fantasía"
              placeholderTextColor={COLORS.textLight}
              value={form.razon_social}
              onChangeText={(v) => setForm((prev) => ({ ...prev, razon_social: v }))}
            />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>CUIT</Text>
            <TextInput
              style={styles.input}
              placeholder="20-12345678-9"
              placeholderTextColor={COLORS.textLight}
              keyboardType="numbers-and-punctuation"
              value={form.cuit}
              onChangeText={(v) => setForm((prev) => ({ ...prev, cuit: v }))}
            />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Dirección *</Text>
            <TextInput
              style={styles.input}
              placeholder="Dirección"
              placeholderTextColor={COLORS.textLight}
              value={form.direccion}
              onChangeText={(v) => setForm((prev) => ({ ...prev, direccion: v }))}
            />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Teléfono</Text>
            <TextInput
              style={styles.input}
              placeholder="Opcional"
              placeholderTextColor={COLORS.textLight}
              keyboardType="phone-pad"
              value={form.telefono}
              onChangeText={(v) => setForm((prev) => ({ ...prev, telefono: v }))}
            />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Opcional"
              placeholderTextColor={COLORS.textLight}
              keyboardType="email-address"
              autoCapitalize="none"
              value={form.email}
              onChangeText={(v) => setForm((prev) => ({ ...prev, email: v }))}
            />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Departamento</Text>
            <SelectorConAgregar
              opciones={departamentos}
              valor={form.departamento}
              onSeleccionar={(v) => setForm((prev) => ({ ...prev, departamento: v }))}
              color={color}
              puedeAgregar={puedeAgregarZonas}
              placeholderNuevo="Ej: SAN RAFAEL"
              onAgregar={async (nombre) => {
                await crearDepartamento(nombre);
                setDepartamentos((prev) => (prev.includes(nombre) ? prev : [...prev, nombre].sort()));
              }}
            />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Zona / Distrito</Text>
            <SelectorConAgregar
              opciones={distritos}
              valor={form.zona}
              onSeleccionar={(v) => setForm((prev) => ({ ...prev, zona: v }))}
              color={color}
              puedeAgregar={puedeAgregarZonas}
              placeholderNuevo="Ej: CENTRO"
              onAgregar={async (nombre) => {
                await crearDistrito(nombre);
                setDistritos((prev) => (prev.includes(nombre) ? prev : [...prev, nombre].sort()));
              }}
            />
          </View>

          <Text style={styles.seccionTitulo}>Tipo de comercio</Text>
          <View style={styles.formGroup}>
            <View style={styles.chipsRow}>
              {TIPOS_COMERCIO.map((op) => {
                const activo = form.tipo_comercio === op;
                return (
                  <TouchableOpacity
                    key={op}
                    style={[styles.chip, { borderColor: color }, activo && { backgroundColor: color }]}
                    onPress={() => setForm((prev) => ({ ...prev, tipo_comercio: activo ? '' : op }))}
                  >
                    <Text style={[styles.chipTexto, { color: activo ? '#fff' : color }]}>{op}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <Text style={styles.seccionTitulo}>Marcas que compra</Text>
          <View style={styles.formGroup}>
            <View style={styles.chipsRow}>
              {MARCAS.map((op) => {
                const activo = form.marcas.includes(op);
                return (
                  <TouchableOpacity
                    key={op}
                    style={[styles.chip, { borderColor: color }, activo && { backgroundColor: color }]}
                    onPress={() => setForm((prev) => ({
                      ...prev,
                      marcas: activo ? prev.marcas.filter((m) => m !== op) : [...prev.marcas, op],
                    }))}
                  >
                    <Text style={[styles.chipTexto, { color: activo ? '#fff' : color }]}>{op}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Notas</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="Observaciones sobre el cliente..."
              placeholderTextColor={COLORS.textLight}
              multiline
              value={form.notas}
              onChangeText={(v) => setForm((prev) => ({ ...prev, notas: v }))}
            />
          </View>

          <TouchableOpacity style={[styles.btnGuardar, { backgroundColor: color }]} onPress={guardar} disabled={guardando}>
            {guardando ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnGuardarTexto}>Crear cliente</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 24,
  },
  headerTitulo: { fontSize: 18, fontWeight: '800', color: '#fff' },
  btnCerrar: { marginLeft: 4, padding: 4 },
  cerrar: { fontSize: 20, color: '#fff', fontWeight: '700' },
  form: { padding: 16, gap: 14, paddingBottom: 40 },
  aviso: {
    fontSize: 13, color: COLORS.textLight, backgroundColor: COLORS.card,
    borderRadius: 12, padding: 14, lineHeight: 18,
  },
  seccionTitulo: {
    fontSize: 13, fontWeight: '800', color: COLORS.text, textTransform: 'uppercase',
    marginTop: 6, letterSpacing: 0.5,
  },
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
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  chipTexto: { fontWeight: '700', fontSize: 13 },
  btnGuardar: { borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  btnGuardarTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
