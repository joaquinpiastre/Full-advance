import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, TextInput,
  ScrollView, Alert, ActivityIndicator, FlatList,
} from 'react-native';
import {
  crearCliente, obtenerDepartamentos, crearDepartamento, obtenerDistritos, crearDistrito,
  agregarClienteExistenteARuta, obtenerClientes,
} from '../services/api';
import { encolarAccion } from '../services/offlineAcciones';
import { COLORS } from '../constants';
import { Cliente } from '../types';
import { useAuthStore } from '../store/authStore';
import SelectorModal from './SelectorModal';
import SelectorModalMultiple from './SelectorModalMultiple';
import { coincideBusqueda } from '../utils/busqueda';

const TIPOS_COMERCIO = [
  'Almacén/Fiambrería', 'Autoservicio', 'Carnicería/Pollería',
  'Kiosco/MaxiKiosco', 'Verdulería', 'Dietética', 'Cotillón', 'Otros',
];

const MARCAS = ['BIMBO', 'CITRIC', 'SANAS', 'ARRABAL', 'FARGO', 'LACTAL'];

const FORM_VACIO = {
  nombre: '', razon_social: '', cuit: '', direccion: '', telefono: '', email: '',
  zona: '', departamento: '', tipo_comercio: '', notas: '',
  marcas: [] as string[],
};

function esErrorDeRed(e: any) {
  return !e?.response;
}

interface Props {
  visible: boolean;
  color?: string;
  onClose: () => void;
  onCreado?: (cliente: Cliente) => void;
  // Rutas asignadas hoy al usuario (preventista/repartidor). Si hay más de
  // una, se le pide elegir a cuál se agrega el cliente nuevo.
  rutas?: { id: number; nombre: string }[];
  // Ids de clientes que ya están en la ruta de hoy, para no ofrecerlos de
  // nuevo en el modo "Cliente existente".
  clientesEnRuta?: number[];
}

export default function NuevoClienteModal({ visible, color = COLORS.primary, onClose, onCreado, rutas, clientesEnRuta = [] }: Props) {
  const { usuario } = useAuthStore();
  const puedeAgregarZonas = usuario?.rol === 'admin' || usuario?.rol === 'supervisor';
  const [modo, setModo] = useState<'nuevo' | 'existente'>('nuevo');
  const [form, setForm] = useState(FORM_VACIO);
  const [rutaId, setRutaId] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [departamentos, setDepartamentos] = useState<{ id: number; nombre: string }[]>([]);
  const [distritos, setDistritos] = useState<{ id: number; nombre: string; departamento_id: number | null }[]>([]);
  const [busquedaExistente, setBusquedaExistente] = useState('');
  const [clientesDisponibles, setClientesDisponibles] = useState<Cliente[]>([]);
  const [cargandoExistentes, setCargandoExistentes] = useState(false);
  const [agregandoId, setAgregandoId] = useState<number | null>(null);

  useEffect(() => {
    if (!visible) return;
    setModo('nuevo');
    obtenerDepartamentos().then((res) => setDepartamentos(res.data)).catch(() => {});
    obtenerDistritos().then((res) => setDistritos(res.data)).catch(() => {});
    setRutaId(rutas?.length === 1 ? rutas[0].id : null);
  }, [visible, rutas]);

  useEffect(() => {
    if (!visible || modo !== 'existente' || clientesDisponibles.length) return;
    setCargandoExistentes(true);
    obtenerClientes()
      .then((res) => setClientesDisponibles(res.data))
      .catch(() => {})
      .finally(() => setCargandoExistentes(false));
  }, [visible, modo]);

  const departamentoId = departamentos.find((d) => d.nombre === form.departamento)?.id ?? null;
  const distritosFiltrados = departamentoId
    ? distritos.filter((d) => d.departamento_id === departamentoId).map((d) => d.nombre)
    : [];

  const clientesExistentesFiltrados = useMemo(() => {
    const noEstanEnRuta = clientesDisponibles.filter((c) => !clientesEnRuta.includes(c.id));
    if (!busquedaExistente.trim()) return noEstanEnRuta;
    return noEstanEnRuta.filter((c) =>
      coincideBusqueda(busquedaExistente, c.nombre, c.direccion, c.rubro, c.razon_social, c.zona)
    );
  }, [clientesDisponibles, clientesEnRuta, busquedaExistente]);

  const agregarExistente = async (cliente: Cliente) => {
    const destino = rutas?.length === 1 ? rutas[0].id : rutaId;
    if (!destino) {
      Alert.alert('Error', 'No se encontró la ruta de hoy');
      return;
    }
    setAgregandoId(cliente.id);
    try {
      await agregarClienteExistenteARuta(destino, cliente.id);
      onCreado?.(cliente);
      onClose();
    } catch (e: any) {
      if (esErrorDeRed(e)) {
        // Sin conexión: se agrega igual en la app y se sincroniza solo más tarde.
        await encolarAccion({ tipo: 'agregar_cliente_existente', payload: { ruta_id: destino, cliente_id: cliente.id } });
        onCreado?.(cliente);
        onClose();
      } else {
        Alert.alert('Error', e?.response?.data?.error ?? 'No se pudo agregar el cliente');
      }
    }
    setAgregandoId(null);
  };

  const guardar = async () => {
    if (!form.nombre.trim() || !form.direccion.trim()) {
      Alert.alert('Error', 'El nombre y la dirección son obligatorios');
      return;
    }
    if (rutas && rutas.length > 1 && !rutaId) {
      Alert.alert('Error', 'Elegí a qué ruta pertenece el cliente');
      return;
    }
    setGuardando(true);
    const datos = {
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
      ...(rutaId ? { ruta_id: rutaId } : {}),
    };
    try {
      const res = await crearCliente(datos);
      setForm(FORM_VACIO);
      onCreado?.(res.data);
      onClose();
    } catch (e: any) {
      if (esErrorDeRed(e)) {
        // Sin conexión: lo mostramos como agregado ya mismo (con id temporal)
        // y se crea en el servidor solo cuando vuelva la señal.
        const tempId = -Date.now();
        await encolarAccion({ tipo: 'crear_cliente', payload: { datos, tempId } });
        setForm(FORM_VACIO);
        onCreado?.({ id: tempId, nombre: datos.nombre, direccion: datos.direccion, lat: 0, lng: 0 } as Cliente);
        onClose();
      } else {
        Alert.alert('Error', e?.response?.data?.error ?? 'No se pudo crear el cliente');
      }
    }
    setGuardando(false);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modal}>
        <View style={[styles.header, { backgroundColor: color }]}>
          <Text style={styles.headerTitulo}>Agregar cliente</Text>
          <TouchableOpacity onPress={onClose} style={styles.btnCerrar}>
            <Text style={styles.cerrar}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.modoTabs}>
          <TouchableOpacity
            style={[styles.modoTab, modo === 'nuevo' && { borderColor: color, backgroundColor: `${color}15` }]}
            onPress={() => setModo('nuevo')}
          >
            <Text style={[styles.modoTabTexto, modo === 'nuevo' && { color }]}>Nuevo cliente</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modoTab, modo === 'existente' && { borderColor: color, backgroundColor: `${color}15` }]}
            onPress={() => setModo('existente')}
          >
            <Text style={[styles.modoTabTexto, modo === 'existente' && { color }]}>Cliente existente</Text>
          </TouchableOpacity>
        </View>

        {modo === 'existente' ? (
          <View style={{ flex: 1 }}>
            <View style={styles.buscadorCont}>
              <TextInput
                style={styles.buscadorInput}
                placeholder="Buscar cliente por nombre, dirección, zona..."
                placeholderTextColor={COLORS.textLight}
                value={busquedaExistente}
                onChangeText={setBusquedaExistente}
                autoCorrect={false}
              />
            </View>
            {cargandoExistentes ? (
              <View style={styles.center}><ActivityIndicator color={color} /></View>
            ) : (
              <FlatList
                data={clientesExistentesFiltrados}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={{ padding: 16, gap: 10 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.clienteExistenteCard}
                    onPress={() => agregarExistente(item)}
                    disabled={agregandoId !== null}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.clienteExistenteNombre}>{item.nombre}</Text>
                      <Text style={styles.clienteExistenteDir}>{item.direccion}{item.zona ? ` · ${item.zona}` : ''}</Text>
                    </View>
                    {agregandoId === item.id
                      ? <ActivityIndicator color={color} />
                      : <Text style={[styles.btnAgregarTexto, { color }]}>+ Agregar</Text>}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={styles.vacio}>No se encontraron clientes para agregar</Text>
                }
              />
            )}
          </View>
        ) : (
        <ScrollView contentContainerStyle={styles.form}>
          <Text style={styles.aviso}>
            ➕ Cargá un nuevo cliente. Quedará agregado a tu ruta de hoy.
          </Text>

          {rutas && rutas.length > 1 && (
            <View style={styles.formGroup}>
              <Text style={styles.label}>Ruta *</Text>
              <SelectorModal
                titulo="Ruta"
                opciones={rutas.map((r) => r.nombre)}
                valor={rutas.find((r) => r.id === rutaId)?.nombre ?? ''}
                onSeleccionar={(v) => setRutaId(rutas.find((r) => r.nombre === v)?.id ?? null)}
                color={color}
              />
            </View>
          )}

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
              color={color}
              puedeAgregar={puedeAgregarZonas}
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
                color={color}
                puedeAgregar={puedeAgregarZonas}
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

          <Text style={styles.seccionTitulo}>Tipo de comercio</Text>
          <View style={styles.formGroup}>
            <SelectorModal
              titulo="Tipo de comercio"
              opciones={TIPOS_COMERCIO}
              valor={form.tipo_comercio}
              onSeleccionar={(v) => setForm((prev) => ({ ...prev, tipo_comercio: v }))}
              color={color}
            />
          </View>

          <Text style={styles.seccionTitulo}>Marcas que compra</Text>
          <View style={styles.formGroup}>
            <SelectorModalMultiple
              titulo="Marcas que compra"
              opciones={MARCAS}
              valores={form.marcas}
              onCambiar={(v) => setForm((prev) => ({ ...prev, marcas: v }))}
              color={color}
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
            {guardando ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnGuardarTexto}>Crear cliente</Text>}
          </TouchableOpacity>
        </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  modoTabs: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    paddingBottom: 8,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modoTab: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modoTabTexto: { fontSize: 13, fontWeight: '700', color: COLORS.textLight },
  buscadorCont: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  buscadorInput: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 15,
    color: COLORS.text,
  },
  clienteExistenteCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  clienteExistenteNombre: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  clienteExistenteDir: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
  btnAgregarTexto: { fontSize: 13, fontWeight: '800' },
  vacio: { textAlign: 'center', color: COLORS.textLight, marginTop: 40, fontSize: 14, paddingHorizontal: 24 },
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
  ayuda: { fontSize: 13, color: COLORS.textLight, fontStyle: 'italic' },
  btnGuardar: { borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  btnGuardarTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
