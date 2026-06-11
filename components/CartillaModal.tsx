import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, TextInput,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { actualizarCliente, obtenerDepartamentos, crearDepartamento, obtenerDistritos, crearDistrito } from '../services/api';
import { COLORS, COLOR_CATEGORIA } from '../constants';
import { Cliente } from '../types';
import { useAuthStore } from '../store/authStore';
import SelectorConAgregar from './SelectorConAgregar';

const FRECUENCIAS = ['Semanal', 'Quincenal', 'Mensual', 'Ocasional'];
const FORMAS_PAGO = ['Efectivo', 'Cuenta corriente', 'Transferencia'];
const DIAS_VISITA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Sin preferencia'];
const TIPOS_COMERCIO = [
  'Almacén/Fiambrería', 'Autoservicio', 'Carnicería/Pollería',
  'Kiosco/MaxiKiosco', 'Verdulería', 'Dietética', 'Cotillón', 'Otros',
];

const FORM_VACIO = {
  nombre: '', direccion: '',
  razon_social: '', cuit: '', rubro: '', email: '', contacto_nombre: '', horario_atencion: '',
  telefono: '', monto_compra_promedio: '', frecuencia_compra: '', forma_pago: '', dia_visita_preferido: '',
  notas: '', material_exhibicion: '', tipo_comercio: '', zona: '', departamento: '',
};

function Chips({ opciones, valor, onSeleccionar, color }: {
  opciones: string[];
  valor: string;
  onSeleccionar: (v: string) => void;
  color: string;
}) {
  return (
    <View style={styles.chipsRow}>
      {opciones.map((op) => {
        const activo = valor === op;
        return (
          <TouchableOpacity
            key={op}
            style={[styles.chip, { borderColor: color }, activo && { backgroundColor: color }]}
            onPress={() => onSeleccionar(activo ? '' : op)}
          >
            <Text style={[styles.chipTexto, { color: activo ? '#fff' : color }]}>{op}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

interface Props {
  cliente: Cliente | null;
  visible: boolean;
  color?: string;
  onClose: () => void;
  onGuardado?: (cliente: Cliente) => void;
}

export default function CartillaModal({ cliente, visible, color = COLORS.primary, onClose, onGuardado }: Props) {
  const { usuario } = useAuthStore();
  const puedeAgregarZonas = usuario?.rol === 'admin' || usuario?.rol === 'supervisor';
  const [form, setForm] = useState(FORM_VACIO);
  const [horaVisita, setHoraVisita] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [departamentos, setDepartamentos] = useState<string[]>([]);
  const [distritos, setDistritos] = useState<string[]>([]);

  useEffect(() => {
    if (!visible) return;
    obtenerDepartamentos().then((res) => setDepartamentos(res.data.map((d: any) => d.nombre))).catch(() => {});
    obtenerDistritos().then((res) => setDistritos(res.data.map((d: any) => d.nombre))).catch(() => {});
  }, [visible]);

  useEffect(() => {
    if (!cliente) return;
    const raw = cliente.dia_visita_preferido ?? '';
    const parts = raw.split(' ');
    const isTime = (s: string) => /^\d{2}:\d{2}$/.test(s);
    const hasTime = parts.length > 1 && isTime(parts[parts.length - 1]);
    setHoraVisita(hasTime ? parts[parts.length - 1] : '');
    setForm({
      nombre: cliente.nombre ?? '',
      direccion: cliente.direccion ?? '',
      razon_social: cliente.razon_social ?? '',
      cuit: cliente.cuit ?? '',
      rubro: cliente.rubro ?? '',
      email: cliente.email ?? '',
      contacto_nombre: cliente.contacto_nombre ?? '',
      horario_atencion: cliente.horario_atencion ?? '',
      telefono: cliente.telefono ?? '',
      monto_compra_promedio: cliente.monto_compra_promedio != null ? String(cliente.monto_compra_promedio) : '',
      frecuencia_compra: cliente.frecuencia_compra ?? '',
      forma_pago: cliente.forma_pago ?? '',
      dia_visita_preferido: hasTime ? parts.slice(0, -1).join(' ') : raw,
      notas: cliente.notas ?? '',
      material_exhibicion: cliente.material_exhibicion ?? '',
      tipo_comercio: cliente.tipo_comercio ?? '',
      zona: cliente.zona ?? '',
      departamento: cliente.departamento ?? '',
    });
  }, [cliente]);

  if (!cliente) return null;

  const guardar = async () => {
    if (!form.nombre.trim() || !form.direccion.trim()) {
      Alert.alert('Error', 'El nombre y la dirección son obligatorios');
      return;
    }
    setGuardando(true);
    try {
      const dia = form.dia_visita_preferido;
      const hora = horaVisita.trim();
      const diaFinal = dia
        ? (dia !== 'Sin preferencia' && hora ? `${dia} ${hora}` : dia)
        : null;
      const data = {
        nombre: form.nombre.trim(),
        direccion: form.direccion.trim(),
        lat: cliente.lat,
        lng: cliente.lng,
        razon_social: form.razon_social.trim() || null,
        cuit: form.cuit.trim() || null,
        rubro: form.rubro.trim() || null,
        email: form.email.trim() || null,
        contacto_nombre: form.contacto_nombre.trim() || null,
        horario_atencion: form.horario_atencion.trim() || null,
        telefono: form.telefono.trim() || null,
        monto_compra_promedio: form.monto_compra_promedio.trim() ? parseFloat(form.monto_compra_promedio) : null,
        frecuencia_compra: form.frecuencia_compra || null,
        forma_pago: form.forma_pago || null,
        dia_visita_preferido: diaFinal,
        notas: form.notas.trim() || null,
        material_exhibicion: form.material_exhibicion.trim() || null,
        tipo_comercio: form.tipo_comercio || null,
        zona: form.zona || null,
        departamento: form.departamento || null,
      };
      const res = await actualizarCliente(cliente.id, data);
      onGuardado?.(res.data);
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? 'No se pudo guardar los datos del cliente');
    }
    setGuardando(false);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modal}>
        <View style={[styles.header, { backgroundColor: color }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitulo}>{cliente.nombre}</Text>
            <Text style={styles.headerDireccion}>{cliente.direccion}</Text>
          </View>
          {cliente.categoria && (
            <View style={[styles.badge, { backgroundColor: COLOR_CATEGORIA[cliente.categoria] }]}>
              <Text style={styles.badgeTexto}>{cliente.categoria}</Text>
            </View>
          )}
          <TouchableOpacity onPress={onClose} style={styles.btnCerrar}>
            <Text style={styles.cerrar}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.form}>
          <Text style={styles.aviso}>
            📋 Cartilla de cliente — completá o actualizá estos datos para que la empresa conozca mejor a este negocio.
          </Text>

          <Text style={styles.seccionTitulo}>Datos del cliente</Text>
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
            <Text style={styles.label}>CUIT / CUIL</Text>
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

          <Text style={styles.seccionTitulo}>Tipo de comercio</Text>
          <View style={styles.formGroup}>
            <Chips
              opciones={TIPOS_COMERCIO}
              valor={form.tipo_comercio}
              color={color}
              onSeleccionar={(v) => setForm((prev) => ({ ...prev, tipo_comercio: v }))}
            />
          </View>

          <Text style={styles.seccionTitulo}>Ubicación</Text>
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

          <Text style={styles.seccionTitulo}>Datos de la empresa</Text>
          {([
            { key: 'rubro', label: 'Rubro', placeholder: 'Kiosco, supermercado, restaurante...' },
            { key: 'contacto_nombre', label: 'Persona de contacto', placeholder: 'Nombre del encargado' },
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
            <Chips opciones={FRECUENCIAS} valor={form.frecuencia_compra} color={color}
              onSeleccionar={(v) => setForm((prev) => ({ ...prev, frecuencia_compra: v }))} />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Forma de pago habitual</Text>
            <Chips opciones={FORMAS_PAGO} valor={form.forma_pago} color={color}
              onSeleccionar={(v) => setForm((prev) => ({ ...prev, forma_pago: v }))} />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Día de visita preferido</Text>
            <Chips opciones={DIAS_VISITA} valor={form.dia_visita_preferido} color={color}
              onSeleccionar={(v) => setForm((prev) => ({ ...prev, dia_visita_preferido: v }))} />
            {form.dia_visita_preferido && form.dia_visita_preferido !== 'Sin preferencia' && (
              <>
                <Text style={[styles.label, { marginTop: 8 }]}>Hora de visita</Text>
                <TextInput
                  style={[styles.input, styles.inputHora]}
                  placeholder="Ej: 10:00"
                  placeholderTextColor={COLORS.textLight}
                  keyboardType="numbers-and-punctuation"
                  value={horaVisita}
                  onChangeText={setHoraVisita}
                  maxLength={5}
                />
              </>
            )}
          </View>
          <Text style={styles.seccionTitulo}>Material de exhibición</Text>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Material presente en el local</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="Ej: 1 heladera exhibidora, 2 carteles, 1 display de mostrador..."
              placeholderTextColor={COLORS.textLight}
              multiline
              value={form.material_exhibicion}
              onChangeText={(v) => setForm((prev) => ({ ...prev, material_exhibicion: v }))}
            />
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
            {guardando ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnGuardarTexto}>Guardar cartilla</Text>}
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
    padding: 20,
    paddingTop: 24,
    gap: 10,
  },
  headerTitulo: { fontSize: 18, fontWeight: '800', color: '#fff' },
  headerDireccion: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeTexto: { color: '#fff', fontWeight: '800', fontSize: 14 },
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
  inputHora: { width: 120 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  chipTexto: { fontWeight: '700', fontSize: 13 },
  btnGuardar: { borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  btnGuardarTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
