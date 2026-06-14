import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Modal, TextInput, Alert, ScrollView,
} from 'react-native';
import {
  obtenerClientes, crearCliente, actualizarCliente, obtenerRutas,
  obtenerDepartamentos, crearDepartamento, obtenerDistritos, crearDistrito,
  cambiarEstadoCliente, eliminarCliente,
} from '../../services/api';
import { COLORS, COLOR_CATEGORIA } from '../../constants';
import { Cliente, CategoriaCliente, Ruta } from '../../types';
import Buscador from '../../components/Buscador';
import { coincideBusqueda } from '../../utils/busqueda';
import SelectorModal from '../../components/SelectorModal';
import SelectorModalMultiple from '../../components/SelectorModalMultiple';

const FORM_VACIO = {
  nombre: '', numero_cliente: '', direccion: '', telefono: '', notas: '',
  categoria: '' as CategoriaCliente | '',
  razon_social: '', cuit: '', rubro: '', email: '', contacto_nombre: '', horario_atencion: '',
  monto_compra_promedio: '', frecuencia_compra: '', forma_pago: '', dia_visita_preferido: '',
  zona: '', departamento: '', ruta_id: '' as number | string,
  marcas: [] as string[],
};

const CATEGORIAS: CategoriaCliente[] = ['A', 'B', 'C', 'D', 'E', 'F'];
const FRECUENCIAS = ['Semanal', 'Quincenal', 'Mensual', 'Ocasional'];
const FORMAS_PAGO = ['Efectivo', 'Cuenta corriente', 'Transferencia'];
const DIAS_VISITA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Sin preferencia'];
const MARCAS = ['BIMBO', 'CITRIC', 'SANAS', 'ARRABAL', 'FARGO', 'LACTAL'];

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
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [busqueda, setBusqueda] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<CategoriaCliente | null>(null);
  const [estadoFiltro, setEstadoFiltro] = useState<'activos' | 'inactivos'>('activos');
  const [departamentos, setDepartamentos] = useState<{ id: number; nombre: string }[]>([]);
  const [distritos, setDistritos] = useState<{ id: number; nombre: string; departamento_id: number | null }[]>([]);

  useEffect(() => {
    cargar();
  }, [estadoFiltro]);

  const cargar = async () => {
    setCargando(true);
    try {
      const [resClientes, resRutas, resDeptos, resDistritos] = await Promise.all([
        obtenerClientes(estadoFiltro), obtenerRutas(), obtenerDepartamentos(), obtenerDistritos(),
      ]);
      setClientes(resClientes.data);
      setRutas(resRutas.data);
      setDepartamentos(resDeptos.data);
      setDistritos(resDistritos.data);
    } catch {}
    setCargando(false);
  };

  const departamentoId = departamentos.find((d) => d.nombre === form.departamento)?.id ?? null;
  const distritosFiltrados = departamentoId
    ? distritos.filter((d) => d.departamento_id === departamentoId).map((d) => d.nombre)
    : [];

  const handleCambiarEstado = (c: Cliente) => {
    const activar = !c.activo;
    Alert.alert(
      activar ? 'Activar cliente' : 'Desactivar cliente',
      activar
        ? `¿Volver a activar a "${c.nombre}"?`
        : `¿Desactivar a "${c.nombre}"? No aparecerá en las rutas ni en el mapa.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: activar ? 'Activar' : 'Desactivar',
          style: activar ? 'default' : 'destructive',
          onPress: async () => {
            try {
              await cambiarEstadoCliente(c.id, activar);
              setClientes((prev) => prev.filter((x) => x.id !== c.id));
            } catch {
              Alert.alert('Error', 'No se pudo actualizar el estado del cliente');
            }
          },
        },
      ]
    );
  };

  const handleEliminar = (c: Cliente) => {
    Alert.alert(
      'Eliminar cliente',
      `¿Eliminar definitivamente a "${c.nombre}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await eliminarCliente(c.id);
              setClientes((prev) => prev.filter((x) => x.id !== c.id));
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.error ?? 'No se pudo eliminar el cliente');
            }
          },
        },
      ]
    );
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
      numero_cliente: c.numero_cliente ?? '',
      direccion: c.direccion,
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
      zona: c.zona ?? '',
      departamento: c.departamento ?? '',
      ruta_id: c.ruta_id ?? '',
      marcas: c.marcas ?? [],
    });
    setModalVisible(true);
  };

  const handleGuardar = async () => {
    if (!form.nombre.trim() || !form.direccion.trim()) {
      Alert.alert('Error', 'Nombre y dirección son obligatorios');
      return;
    }
    if (!form.ruta_id) {
      Alert.alert('Error', 'Debés asignar una ruta al cliente');
      return;
    }
    const data = {
      nombre: form.nombre.trim(),
      numero_cliente: form.numero_cliente.trim() || null,
      direccion: form.direccion.trim(),
      lat: 0,
      lng: 0,
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
      zona: form.zona.trim() || null,
      departamento: form.departamento.trim() || null,
      marcas: form.marcas.length ? form.marcas : null,
      ruta_id: form.ruta_id,
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
    return clientes.filter((c) => {
      const coincideTexto = coincideBusqueda(
        busqueda,
        c.nombre, c.numero_cliente, c.direccion, c.rubro, c.razon_social, c.zona, c.departamento,
        c.telefono, c.email, c.contacto_nombre, c.cuit, c.notas
      );
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
        <Buscador valor={busqueda} onCambiar={setBusqueda} placeholder="Buscar por nombre, dirección, rubro, zona..." />
        <View style={styles.estadoFila}>
          {([
            { key: 'activos', label: 'Activos' },
            { key: 'inactivos', label: 'Inactivos' },
          ] as const).map((op) => {
            const activo = estadoFiltro === op.key;
            return (
              <TouchableOpacity
                key={op.key}
                style={[styles.estadoChip, activo && styles.estadoChipActivo]}
                onPress={() => setEstadoFiltro(op.key)}
              >
                <Text style={[styles.estadoChipTexto, activo && styles.estadoChipTextoActivo]}>{op.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
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
          <View style={[styles.card, !item.activo && styles.cardInactivo]}>
            <TouchableOpacity onPress={() => abrirEditar(item)}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardNombre}>
                  {item.nombre}
                  {item.numero_cliente ? <Text style={styles.cardNumero}> · #{item.numero_cliente}</Text> : null}
                </Text>
                {item.categoria && (
                  <View style={[styles.badge, { backgroundColor: COLOR_CATEGORIA[item.categoria] }]}>
                    <Text style={styles.badgeTexto}>{item.categoria}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.cardDir}>{item.direccion}</Text>
              {item.telefono && <Text style={styles.cardTel}>📞 {item.telefono}</Text>}
              {item.rubro && <Text style={styles.cardTel}>🏷️ {item.rubro}</Text>}
              {(item.departamento || item.zona) && (
                <Text style={styles.cardTel}>📍 {[item.departamento, item.zona].filter(Boolean).join(' · ')}</Text>
              )}
            </TouchableOpacity>
            <View style={styles.accionesFila}>
              <TouchableOpacity
                style={[styles.btnEstado, item.activo ? styles.btnDesactivar : styles.btnActivar]}
                onPress={() => handleCambiarEstado(item)}
              >
                <Text style={[styles.btnEstadoTexto, item.activo ? styles.btnEstadoTextoDesactivar : styles.btnEstadoTextoActivar]}>
                  {item.activo ? 'Desactivar' : 'Activar'}
                </Text>
              </TouchableOpacity>
              {!item.activo && (
                <TouchableOpacity
                  style={[styles.btnEstado, styles.btnEliminar]}
                  onPress={() => handleEliminar(item)}
                >
                  <Text style={[styles.btnEstadoTexto, styles.btnEstadoTextoEliminar]}>Eliminar</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.vacio}>
            {estadoFiltro === 'inactivos' ? 'No hay clientes inactivos' : 'No se encontraron clientes con ese filtro'}
          </Text>
        }
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
              { key: 'numero_cliente', label: 'Número de cliente', placeholder: 'Opcional' },
              { key: 'razon_social', label: 'Razón social', placeholder: 'Nombre legal / fantasía' },
              { key: 'cuit', label: 'CUIT / CUIL', placeholder: '20-12345678-9', keyboard: 'numbers-and-punctuation' },
              { key: 'direccion', label: 'Dirección *', placeholder: 'Dirección' },
              { key: 'telefono', label: 'Teléfono', placeholder: 'Opcional', keyboard: 'phone-pad' },
              { key: 'email', label: 'Email', placeholder: 'Opcional', keyboard: 'email-address' },
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

            <Text style={styles.seccionTitulo}>Ruta</Text>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Ruta asignada *</Text>
              <SelectorModal
                titulo="Ruta asignada"
                opciones={rutas.map((r) => r.nombre)}
                valor={rutas.find((r) => r.id === form.ruta_id)?.nombre ?? ''}
                onSeleccionar={(v) => setForm((prev) => ({ ...prev, ruta_id: rutas.find((r) => r.nombre === v)?.id ?? '' }))}
              />
              {rutas.length === 0 && (
                <Text style={styles.vacioChico}>No hay rutas creadas. Creá una ruta primero.</Text>
              )}
            </View>

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

            <Text style={styles.seccionTitulo}>Marcas que compra</Text>
            <View style={styles.formGroup}>
              <SelectorModalMultiple
                titulo="Marcas que compra"
                opciones={MARCAS}
                valores={form.marcas}
                onCambiar={(v) => setForm((prev) => ({ ...prev, marcas: v }))}
              />
            </View>

            <Text style={styles.seccionTitulo}>Ubicación</Text>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Departamento</Text>
              <SelectorModal
                titulo="Departamento"
                opciones={departamentos.map((d) => d.nombre)}
                valor={form.departamento}
                onSeleccionar={(v) => setForm((prev) => ({
                  ...prev,
                  departamento: v,
                  zona: distritos.some((d) => d.nombre === prev.zona && d.departamento_id === (departamentos.find((dep) => dep.nombre === v)?.id ?? null))
                    ? prev.zona
                    : '',
                }))}
                puedeAgregar
                placeholderNuevo="Ej: San Rafael"
                onAgregar={async (nombre) => {
                  const res = await crearDepartamento(nombre);
                  setDepartamentos((prev) => [...prev, res.data].sort((a, b) => a.nombre.localeCompare(b.nombre)));
                }}
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Zona / Distrito</Text>
              {form.departamento ? (
                <SelectorModal
                  titulo="Zona / Distrito"
                  opciones={distritosFiltrados}
                  valor={form.zona}
                  onSeleccionar={(v) => setForm((prev) => ({ ...prev, zona: v }))}
                  puedeAgregar
                  placeholderNuevo="Ej: Centro"
                  onAgregar={async (nombre) => {
                    const res = await crearDistrito(nombre, departamentoId);
                    setDistritos((prev) => [...prev, res.data]);
                  }}
                />
              ) : (
                <Text style={styles.ayuda}>Elegí primero un departamento</Text>
              )}
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
  estadoFila: { flexDirection: 'row', gap: 8 },
  estadoChip: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: COLORS.card,
  },
  estadoChipActivo: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  estadoChipTexto: { fontWeight: '700', fontSize: 13, color: COLORS.textLight },
  estadoChipTextoActivo: { color: '#fff' },
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
  cardInactivo: { borderLeftColor: COLORS.textLight, opacity: 0.7 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardNombre: { fontSize: 15, fontWeight: '700', color: COLORS.text, flex: 1 },
  cardNumero: { fontSize: 13, fontWeight: '400', color: COLORS.textLight },
  cardDir: { fontSize: 13, color: COLORS.textLight },
  cardTel: { fontSize: 12, color: COLORS.textLight },
  badge: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3, marginLeft: 8 },
  badgeTexto: { color: '#fff', fontWeight: '800', fontSize: 13 },
  accionesFila: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  btnEstado: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  btnDesactivar: { borderColor: COLORS.danger, backgroundColor: '#FEF2F2' },
  btnActivar: { borderColor: COLORS.success, backgroundColor: '#F0FDF4' },
  btnEliminar: { borderColor: COLORS.danger, backgroundColor: COLORS.danger },
  btnEstadoTexto: { fontWeight: '700', fontSize: 13 },
  btnEstadoTextoDesactivar: { color: COLORS.danger },
  btnEstadoTextoActivar: { color: COLORS.success },
  btnEstadoTextoEliminar: { color: '#fff' },
  vacio: { textAlign: 'center', color: COLORS.textLight, marginTop: 60, fontSize: 14 },
  vacioChico: { fontSize: 12, color: COLORS.textLight, fontStyle: 'italic' },
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
  ayuda: { fontSize: 13, color: COLORS.textLight, fontStyle: 'italic' },
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
