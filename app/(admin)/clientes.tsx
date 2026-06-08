import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Modal, TextInput, Alert, ScrollView,
} from 'react-native';
import { obtenerClientes, crearCliente, actualizarCliente } from '../../services/api';
import { COLORS, COLOR_CATEGORIA } from '../../constants';
import { Cliente, CategoriaCliente } from '../../types';
import Buscador from '../../components/Buscador';

const FORM_VACIO = {
  nombre: '', direccion: '', lat: '', lng: '', telefono: '', notas: '',
  categoria: '' as CategoriaCliente | '',
  razon_social: '', cuit: '', rubro: '', email: '', contacto_nombre: '', horario_atencion: '',
  monto_compra_promedio: '', frecuencia_compra: '', forma_pago: '', dia_visita_preferido: '',
};

const CATEGORIAS: CategoriaCliente[] = ['A', 'B', 'C', 'D', 'E', 'F'];
const FRECUENCIAS = ['Semanal', 'Quincenal', 'Mensual', 'Ocasional'];
const FORMAS_PAGO = ['Efectivo', 'Cuenta corriente', 'Transferencia'];
const DIAS_VISITA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Sin preferencia'];

function Chips({ opciones, valor, onSeleccionar, colorPorOpcion }: {
  opciones: string[];
  valor: string;
  onSeleccionar: (v: string) => void;
  colorPorOpcion?: (op: string) => string;
}) {
  return (
    <View style={styles.chipsRow}>
      {opciones.map((op) => {
        const activo = valor === op;
        const color = colorPorOpcion?.(op) ?? COLORS.primary;
        return (
          <TouchableOpacity
            key={op}
            style={[
              styles.chip,
              { borderColor: color },
              activo && { backgroundColor: color },
            ]}
            onPress={() => onSeleccionar(activo ? '' : op)}
          >
            <Text style={[styles.chipTexto, { color: activo ? '#fff' : color }]}>{op}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [busqueda, setBusqueda] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<CategoriaCliente | null>(null);

  useEffect(() => {
    cargar();
  }, []);

  const cargar = async () => {
    setCargando(true);
    try {
      const res = await obtenerClientes();
      setClientes(res.data);
    } catch {}
    setCargando(false);
  };

  const abrirNuevo = () => {
    setEditando(null);
    setForm(FORM_VACIO);
    setModalVisible(true);
  };

  const abrirEditar = (c: Cliente) => {
    setEditando(c);
    setForm({
      nombre: c.nombre,
      direccion: c.direccion,
      lat: String(c.lat),
      lng: String(c.lng),
      telefono: c.telefono ?? '',
      notas: c.notas ?? '',
      categoria: c.categoria ?? '',
      razon_social: c.razon_social ?? '',
      cuit: c.cuit ?? '',
      rubro: c.rubro ?? '',
      email: c.email ?? '',
      contacto_nombre: c.contacto_nombre ?? '',
      horario_atencion: c.horario_atencion ?? '',
      monto_compra_promedio: c.monto_compra_promedio != null ? String(c.monto_compra_promedio) : '',
      frecuencia_compra: c.frecuencia_compra ?? '',
      forma_pago: c.forma_pago ?? '',
      dia_visita_preferido: c.dia_visita_preferido ?? '',
    });
    setModalVisible(true);
  };

  const handleGuardar = async () => {
    if (!form.nombre.trim() || !form.direccion.trim()) {
      Alert.alert('Error', 'Nombre y dirección son obligatorios');
      return;
    }
    const data = {
      nombre: form.nombre.trim(),
      direccion: form.direccion.trim(),
      lat: parseFloat(form.lat) || 0,
      lng: parseFloat(form.lng) || 0,
      telefono: form.telefono.trim() || null,
      notas: form.notas.trim() || null,
      categoria: form.categoria || null,
      razon_social: form.razon_social.trim() || null,
      cuit: form.cuit.trim() || null,
      rubro: form.rubro.trim() || null,
      email: form.email.trim() || null,
      contacto_nombre: form.contacto_nombre.trim() || null,
      horario_atencion: form.horario_atencion.trim() || null,
      monto_compra_promedio: form.monto_compra_promedio.trim() ? parseFloat(form.monto_compra_promedio) : null,
      frecuencia_compra: form.frecuencia_compra || null,
      forma_pago: form.forma_pago || null,
      dia_visita_preferido: form.dia_visita_preferido || null,
    };
    try {
      if (editando) {
        await actualizarCliente(editando.id, data);
      } else {
        await crearCliente(data);
      }
      setModalVisible(false);
      cargar();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? 'No se pudo guardar');
    }
  };

  const clientesFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return clientes.filter((c) => {
      const coincideTexto = !q
        || c.nombre?.toLowerCase().includes(q)
        || c.direccion?.toLowerCase().includes(q)
        || c.rubro?.toLowerCase().includes(q)
        || c.razon_social?.toLowerCase().includes(q);
      const coincideCategoria = !categoriaFiltro || c.categoria === categoriaFiltro;
      return coincideTexto && coincideCategoria;
    });
  }, [clientes, busqueda, categoriaFiltro]);

  if (cargando) return <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <Text style={styles.total}>{clientesFiltrados.length} de {clientes.length} clientes</Text>
        <TouchableOpacity style={styles.btnNuevo} onPress={abrirNuevo}>
          <Text style={styles.btnNuevoTexto}>+ Nuevo</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filtros}>
        <Buscador valor={busqueda} onCambiar={setBusqueda} placeholder="Buscar por nombre, dirección, rubro..." />
        <View style={styles.categoriasFila}>
          {(['A', 'B', 'C', 'D', 'E', 'F'] as CategoriaCliente[]).map((cat) => {
            const activo = categoriaFiltro === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoriaChip,
                  { borderColor: COLOR_CATEGORIA[cat] },
                  activo && { backgroundColor: COLOR_CATEGORIA[cat] },
                ]}
                onPress={() => setCategoriaFiltro(activo ? null : cat)}
              >
                <Text style={[styles.categoriaChipTexto, { color: activo ? '#fff' : COLOR_CATEGORIA[cat] }]}>{cat}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <FlatList
        data={clientesFiltrados}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => abrirEditar(item)}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardNombre}>{item.nombre}</Text>
              {item.categoria && (
                <View style={[styles.badge, { backgroundColor: COLOR_CATEGORIA[item.categoria] }]}>
                  <Text style={styles.badgeTexto}>{item.categoria}</Text>
                </View>
              )}
            </View>
            <Text style={styles.cardDir}>{item.direccion}</Text>
            {item.telefono && <Text style={styles.cardTel}>📞 {item.telefono}</Text>}
            {item.rubro && <Text style={styles.cardTel}>🏷️ {item.rubro}</Text>}
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.vacio}>No se encontraron clientes con ese filtro</Text>}
      />

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitulo}>{editando ? 'Editar cliente' : 'Nuevo cliente'}</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCerrar}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.form}>
            <Text style={styles.seccionTitulo}>Datos básicos</Text>
            {([
              { key: 'nombre', label: 'Nombre *', placeholder: 'Nombre del cliente' },
              { key: 'direccion', label: 'Dirección *', placeholder: 'Dirección' },
              { key: 'lat', label: 'Latitud', placeholder: '-34.6037', keyboard: 'numeric' },
              { key: 'lng', label: 'Longitud', placeholder: '-58.3816', keyboard: 'numeric' },
              { key: 'telefono', label: 'Teléfono', placeholder: 'Opcional', keyboard: 'phone-pad' },
            ] as any[]).map((f) => (
              <View key={f.key} style={styles.formGroup}>
                <Text style={styles.label}>{f.label}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={f.placeholder}
                  placeholderTextColor={COLORS.textLight}
                  keyboardType={f.keyboard ?? 'default'}
                  value={(form as any)[f.key]}
                  onChangeText={(v) => setForm((prev) => ({ ...prev, [f.key]: v }))}
                />
              </View>
            ))}

            <Text style={styles.seccionTitulo}>Clasificación</Text>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Categoría (importancia para nosotros)</Text>
              <Chips
                opciones={CATEGORIAS}
                valor={form.categoria}
                onSeleccionar={(v) => setForm((prev) => ({ ...prev, categoria: v as CategoriaCliente | '' }))}
                colorPorOpcion={(op) => COLOR_CATEGORIA[op as CategoriaCliente]}
              />
            </View>

            <Text style={styles.seccionTitulo}>Datos de la empresa</Text>
            {([
              { key: 'razon_social', label: 'Razón social', placeholder: 'Nombre legal / fantasía' },
              { key: 'cuit', label: 'CUIT / CUIL', placeholder: '20-12345678-9', keyboard: 'numbers-and-punctuation' },
              { key: 'rubro', label: 'Rubro', placeholder: 'Kiosco, supermercado, restaurante...' },
              { key: 'contacto_nombre', label: 'Persona de contacto', placeholder: 'Nombre del encargado' },
              { key: 'email', label: 'Email', placeholder: 'Opcional', keyboard: 'email-address' },
              { key: 'horario_atencion', label: 'Horario de atención', placeholder: 'Ej: Lun a Vie 9 a 18' },
            ] as any[]).map((f) => (
              <View key={f.key} style={styles.formGroup}>
                <Text style={styles.label}>{f.label}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={f.placeholder}
                  placeholderTextColor={COLORS.textLight}
                  keyboardType={f.keyboard ?? 'default'}
                  autoCapitalize={f.key === 'email' ? 'none' : 'sentences'}
                  value={(form as any)[f.key]}
                  onChangeText={(v) => setForm((prev) => ({ ...prev, [f.key]: v }))}
                />
              </View>
            ))}

            <Text style={styles.seccionTitulo}>Datos comerciales</Text>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Monto de compra promedio ($)</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: 50000"
                placeholderTextColor={COLORS.textLight}
                keyboardType="numeric"
                value={form.monto_compra_promedio}
                onChangeText={(v) => setForm((prev) => ({ ...prev, monto_compra_promedio: v }))}
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Frecuencia de compra</Text>
              <Chips
                opciones={FRECUENCIAS}
                valor={form.frecuencia_compra}
                onSeleccionar={(v) => setForm((prev) => ({ ...prev, frecuencia_compra: v }))}
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Forma de pago habitual</Text>
              <Chips
                opciones={FORMAS_PAGO}
                valor={form.forma_pago}
                onSeleccionar={(v) => setForm((prev) => ({ ...prev, forma_pago: v }))}
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Día de visita preferido</Text>
              <Chips
                opciones={DIAS_VISITA}
                valor={form.dia_visita_preferido}
                onSeleccionar={(v) => setForm((prev) => ({ ...prev, dia_visita_preferido: v }))}
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Notas</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="Opcional"
                placeholderTextColor={COLORS.textLight}
                multiline
                value={form.notas}
                onChangeText={(v) => setForm((prev) => ({ ...prev, notas: v }))}
              />
            </View>

            <TouchableOpacity style={styles.btnGuardar} onPress={handleGuardar}>
              <Text style={styles.btnGuardarTexto}>Guardar</Text>
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
  filtros: { paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
  categoriasFila: { flexDirection: 'row', gap: 8 },
  categoriaChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.card,
  },
  categoriaChipTexto: { fontWeight: '800', fontSize: 14 },
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
  cardNombre: { fontSize: 15, fontWeight: '700', color: COLORS.text, flex: 1 },
  cardDir: { fontSize: 13, color: COLORS.textLight },
  cardTel: { fontSize: 12, color: COLORS.textLight },
  badge: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3, marginLeft: 8 },
  badgeTexto: { color: '#fff', fontWeight: '800', fontSize: 13 },
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
  form: { padding: 16, gap: 14, paddingBottom: 40 },
  seccionTitulo: {
    fontSize: 13, fontWeight: '800', color: COLORS.primary, textTransform: 'uppercase',
    marginTop: 8, letterSpacing: 0.5,
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
  chip: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipTexto: { fontWeight: '700', fontSize: 13 },
  btnGuardar: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnGuardarTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
