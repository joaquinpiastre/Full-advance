import { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Modal,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  obtenerClientes, obtenerMisPagos, crearPago, actualizarPago, eliminarPago,
} from '../services/api';
import { Cliente, Pago, MetodoPago } from '../types';
import { COLORS } from '../constants';
import { formatMoney } from '../utils/dinero';
import { ddmmaaaaAIso, isoADDMMAAAA, hoyDDMMAAAA } from '../utils/fechas';
import { METODOS_PAGO, METODO_LABEL, METODO_COLOR } from '../utils/pagos';
import Buscador from './Buscador';
import { coincideBusqueda } from '../utils/busqueda';

type Props = { color?: string };

const FORM_VACIO = {
  fechaPago: hoyDDMMAAAA(),
  fechaFactura: '',
  numeroFactura: '',
  montoACobrar: '',
  montoPagado: '',
  metodoPago: '' as MetodoPago | '',
  numeroCheque: '',
  nota: '',
};

export default function PagosScreen({ color = COLORS.primary }: Props) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [misPagos, setMisPagos] = useState<Pago[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [selectorVisible, setSelectorVisible] = useState(false);
  const [busquedaCliente, setBusquedaCliente] = useState('');

  const [form, setForm] = useState(FORM_VACIO);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<number | null>(null);
  const listRef = useRef<FlatList<Pago>>(null);

  const cargar = useCallback(async () => {
    try {
      const [resClientes, resPagos] = await Promise.all([
        obtenerClientes('activos'), obtenerMisPagos(),
      ]);
      setClientes(resClientes.data);
      setMisPagos(resPagos.data);
    } catch {}
    setCargando(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const clientesFiltrados = busquedaCliente.trim()
    ? clientes.filter((c) => coincideBusqueda(busquedaCliente, c.nombre, c.numero_cliente, c.direccion))
    : clientes;

  const resetForm = () => {
    setForm(FORM_VACIO);
    setClienteSeleccionado(null);
    setEditandoId(null);
  };

  const abrirEditar = (pago: Pago) => {
    const cliente = clientes.find((c) => c.id === pago.cliente_id) ?? null;
    setClienteSeleccionado(cliente ?? { id: pago.cliente_id, nombre: pago.cliente_nombre ?? 'Cliente', numero_cliente: pago.numero_cliente } as Cliente);
    setForm({
      fechaPago: isoADDMMAAAA(pago.fecha_pago),
      fechaFactura: pago.fecha_emision_factura ? isoADDMMAAAA(pago.fecha_emision_factura) : '',
      numeroFactura: pago.numero_factura ?? '',
      montoACobrar: String(pago.monto_a_cobrar),
      montoPagado: String(pago.monto_pagado),
      metodoPago: pago.metodo_pago,
      numeroCheque: pago.numero_cheque ?? '',
      nota: pago.nota ?? '',
    });
    setEditandoId(pago.id);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const guardar = async () => {
    if (!clienteSeleccionado) {
      Alert.alert('Error', 'Elegí el cliente al que le cobraste');
      return;
    }
    const fechaPagoIso = ddmmaaaaAIso(form.fechaPago);
    if (!fechaPagoIso) {
      Alert.alert('Error', 'La fecha de pago no es válida. Usá el formato DD/MM/AAAA');
      return;
    }
    let fechaFacturaIso: string | null = null;
    if (form.fechaFactura.trim()) {
      fechaFacturaIso = ddmmaaaaAIso(form.fechaFactura);
      if (!fechaFacturaIso) {
        Alert.alert('Error', 'La fecha de emisión de factura no es válida. Usá el formato DD/MM/AAAA');
        return;
      }
    }
    const montoACobrar = parseFloat(form.montoACobrar.replace(',', '.'));
    const montoPagado = parseFloat(form.montoPagado.replace(',', '.'));
    if (!montoACobrar || montoACobrar <= 0) {
      Alert.alert('Error', 'Ingresá el monto a cobrar');
      return;
    }
    if (!form.montoPagado.trim() || isNaN(montoPagado) || montoPagado < 0) {
      Alert.alert('Error', 'Ingresá el monto pagado');
      return;
    }
    if (!form.metodoPago) {
      Alert.alert('Error', 'Elegí el método de pago');
      return;
    }
    if (form.metodoPago === 'cheque' && !form.numeroCheque.trim()) {
      Alert.alert('Error', 'Ingresá el número de cheque');
      return;
    }

    const payload = {
      cliente_id: clienteSeleccionado.id,
      fecha_pago: fechaPagoIso,
      fecha_emision_factura: fechaFacturaIso,
      numero_factura: form.numeroFactura.trim() || null,
      monto_a_cobrar: montoACobrar,
      monto_pagado: montoPagado,
      metodo_pago: form.metodoPago,
      numero_cheque: form.metodoPago === 'cheque' ? form.numeroCheque.trim() : null,
      nota: form.nota.trim() || null,
    };

    setGuardando(true);
    try {
      if (editandoId) {
        const res = await actualizarPago(editandoId, payload);
        setMisPagos((prev) => prev.map((p) => (p.id === editandoId ? res.data : p)));
      } else {
        const res = await crearPago(payload);
        setMisPagos((prev) => [res.data, ...prev]);
      }
      resetForm();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? 'No se pudo guardar el pago');
    }
    setGuardando(false);
  };

  const confirmarEliminar = (pago: Pago) => {
    Alert.alert(
      'Eliminar pago',
      `¿Eliminar el pago de ${pago.cliente_nombre}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setEliminandoId(pago.id);
            try {
              await eliminarPago(pago.id);
              setMisPagos((prev) => prev.filter((p) => p.id !== pago.id));
              if (editandoId === pago.id) resetForm();
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.error ?? 'No se pudo eliminar el pago');
            }
            setEliminandoId(null);
          },
        },
      ]
    );
  };

  if (cargando) return <View style={styles.center}><ActivityIndicator color={color} size="large" /></View>;

  return (
    <>
    <FlatList
      ref={listRef}
      data={misPagos}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.lista}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargar(); }} />}
      ListHeaderComponent={
        <View style={{ gap: 16 }}>
          <View style={styles.form}>
            <Text style={styles.formTitulo}>{editandoId ? 'Editar pago' : 'Registrar cobro'}</Text>

            <View style={styles.campo}>
              <Text style={styles.label}>Cliente *</Text>
              <TouchableOpacity style={styles.selectorCliente} onPress={() => setSelectorVisible(true)}>
                {clienteSeleccionado ? (
                  <View>
                    <Text style={styles.selectorClienteNombre}>{clienteSeleccionado.nombre}</Text>
                    {clienteSeleccionado.numero_cliente ? (
                      <Text style={styles.selectorClienteSub}>#{clienteSeleccionado.numero_cliente}</Text>
                    ) : null}
                  </View>
                ) : (
                  <Text style={styles.selectorClientePlaceholder}>Tocá para elegir un cliente</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.fila}>
              <View style={[styles.campo, { flex: 1 }]}>
                <Text style={styles.label}>Fecha de pago *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="DD/MM/AAAA"
                  placeholderTextColor={COLORS.textLight}
                  value={form.fechaPago}
                  onChangeText={(v) => setForm((prev) => ({ ...prev, fechaPago: v }))}
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                />
              </View>
              <View style={[styles.campo, { flex: 1 }]}>
                <Text style={styles.label}>Fecha de factura</Text>
                <TextInput
                  style={styles.input}
                  placeholder="DD/MM/AAAA"
                  placeholderTextColor={COLORS.textLight}
                  value={form.fechaFactura}
                  onChangeText={(v) => setForm((prev) => ({ ...prev, fechaFactura: v }))}
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                />
              </View>
            </View>

            <View style={styles.campo}>
              <Text style={styles.label}>Número de factura</Text>
              <TextInput
                style={styles.input}
                placeholder="Opcional"
                placeholderTextColor={COLORS.textLight}
                value={form.numeroFactura}
                onChangeText={(v) => setForm((prev) => ({ ...prev, numeroFactura: v }))}
              />
            </View>

            <View style={styles.fila}>
              <View style={[styles.campo, { flex: 1 }]}>
                <Text style={styles.label}>Monto a cobrar *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="$ 0"
                  placeholderTextColor={COLORS.textLight}
                  keyboardType="numeric"
                  value={form.montoACobrar}
                  onChangeText={(v) => setForm((prev) => ({ ...prev, montoACobrar: v }))}
                />
              </View>
              <View style={[styles.campo, { flex: 1 }]}>
                <Text style={styles.label}>Monto pagado *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="$ 0"
                  placeholderTextColor={COLORS.textLight}
                  keyboardType="numeric"
                  value={form.montoPagado}
                  onChangeText={(v) => setForm((prev) => ({ ...prev, montoPagado: v }))}
                />
              </View>
            </View>
            <TouchableOpacity
              style={[styles.btnPagoTotal, { borderColor: color }]}
              onPress={() => setForm((prev) => ({ ...prev, montoPagado: prev.montoACobrar }))}
              disabled={!form.montoACobrar.trim()}
            >
              <Text style={[styles.btnPagoTotalTexto, { color }]}>💯 Pago total</Text>
            </TouchableOpacity>

            <View style={styles.campo}>
              <Text style={styles.label}>Método de pago *</Text>
              <View style={styles.chipsRow}>
                {METODOS_PAGO.map((m) => {
                  const activo = form.metodoPago === m.value;
                  return (
                    <TouchableOpacity
                      key={m.value}
                      style={[styles.chip, { borderColor: color }, activo && { backgroundColor: color }]}
                      onPress={() => setForm((prev) => ({ ...prev, metodoPago: m.value }))}
                    >
                      <Text style={[styles.chipTexto, { color: activo ? '#fff' : color }]}>{m.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {form.metodoPago === 'cheque' && (
              <View style={styles.campo}>
                <Text style={styles.label}>Número de cheque *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Número de cheque"
                  placeholderTextColor={COLORS.textLight}
                  value={form.numeroCheque}
                  onChangeText={(v) => setForm((prev) => ({ ...prev, numeroCheque: v }))}
                />
              </View>
            )}

            <View style={styles.campo}>
              <Text style={styles.label}>Nota</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="Opcional"
                placeholderTextColor={COLORS.textLight}
                multiline
                value={form.nota}
                onChangeText={(v) => setForm((prev) => ({ ...prev, nota: v }))}
              />
            </View>

            <View style={styles.fila}>
              {editandoId && (
                <TouchableOpacity style={styles.btnCancelar} onPress={resetForm} disabled={guardando}>
                  <Text style={styles.btnCancelarTexto}>Cancelar</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.btnGuardar, { backgroundColor: color, flex: 1 }]}
                onPress={guardar}
                disabled={guardando}
              >
                {guardando
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnGuardarTexto}>{editandoId ? 'Guardar cambios' : 'Guardar pago'}</Text>}
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.seccionTitulo}>Mis pagos recientes</Text>
        </View>
      }
      renderItem={({ item }) => {
        const saldo = item.monto_a_cobrar - item.monto_pagado;
        return (
          <View style={[styles.card, editandoId === item.id && styles.cardEditando]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardCliente} numberOfLines={1}>
                {item.cliente_nombre}
                {item.numero_cliente ? <Text style={styles.cardClienteNumero}> · #{item.numero_cliente}</Text> : null}
              </Text>
              <View style={[styles.pill, { backgroundColor: METODO_COLOR[item.metodo_pago] }]}>
                <Text style={styles.pillTexto}>{METODO_LABEL[item.metodo_pago]}</Text>
              </View>
            </View>
            <Text style={styles.cardFecha}>📅 {isoADDMMAAAA(item.fecha_pago)}</Text>
            <View style={styles.cardMontos}>
              <Text style={styles.cardMontoTexto}>A cobrar: <Text style={styles.cardMontoValor}>{formatMoney(item.monto_a_cobrar)}</Text></Text>
              <Text style={styles.cardMontoTexto}>Pagado: <Text style={[styles.cardMontoValor, { color: COLORS.success }]}>{formatMoney(item.monto_pagado)}</Text></Text>
              {saldo > 0 && (
                <Text style={styles.cardMontoTexto}>Saldo: <Text style={[styles.cardMontoValor, { color: COLORS.danger }]}>{formatMoney(saldo)}</Text></Text>
              )}
            </View>
            {item.numero_factura && <Text style={styles.cardDato}>🧾 Factura #{item.numero_factura}</Text>}
            {item.numero_cheque && <Text style={styles.cardDato}>💵 Cheque #{item.numero_cheque}</Text>}
            {item.nota && <Text style={styles.cardNota}>📝 {item.nota}</Text>}

            <View style={styles.accionesFila}>
              <TouchableOpacity style={styles.btnAccionSec} onPress={() => abrirEditar(item)}>
                <Text style={styles.btnAccionSecTexto}>✏️ Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnAccionDanger}
                onPress={() => confirmarEliminar(item)}
                disabled={eliminandoId === item.id}
              >
                {eliminandoId === item.id
                  ? <ActivityIndicator color={COLORS.danger} size="small" />
                  : <Text style={styles.btnAccionDangerTexto}>🗑️ Eliminar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        );
      }}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      ListEmptyComponent={
        <View style={styles.vacio}>
          <Text style={styles.vacioEmoji}>💰</Text>
          <Text style={styles.vacioTexto}>Todavía no registraste ningún cobro</Text>
        </View>
      }
      ListFooterComponent={<View style={{ height: 8 }} />}
    />

    <Modal visible={selectorVisible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modal}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitulo}>Elegir cliente</Text>
          <TouchableOpacity onPress={() => { setSelectorVisible(false); setBusquedaCliente(''); }}>
            <Text style={styles.modalCerrar}>✕</Text>
          </TouchableOpacity>
        </View>
        <View style={{ padding: 16, paddingBottom: 8 }}>
          <Buscador valor={busquedaCliente} onCambiar={setBusquedaCliente} placeholder="Buscar por nombre, número, dirección..." />
        </View>
        <FlatList
          data={clientesFiltrados}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.opcionCliente}
              onPress={() => {
                setClienteSeleccionado(item);
                setSelectorVisible(false);
                setBusquedaCliente('');
              }}
            >
              <Text style={styles.opcionClienteNombre}>
                {item.nombre}{item.numero_cliente ? ` · #${item.numero_cliente}` : ''}
              </Text>
              <Text style={styles.opcionClienteDireccion}>{item.direccion}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.vacioTexto}>No se encontraron clientes</Text>}
        />
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  lista: { padding: 16, paddingBottom: 32, flexGrow: 1, backgroundColor: COLORS.background },

  form: {
    backgroundColor: COLORS.card, borderRadius: 14, padding: 14, gap: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
  formTitulo: { fontSize: 13, fontWeight: '800', color: COLORS.text, textTransform: 'uppercase', letterSpacing: 0.5 },
  fila: { flexDirection: 'row', gap: 10 },
  campo: { gap: 4 },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.textLight, textTransform: 'uppercase' },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    padding: 12, fontSize: 15, color: COLORS.text, backgroundColor: COLORS.background,
  },
  inputMultiline: { minHeight: 60, textAlignVertical: 'top' },
  selectorCliente: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    padding: 12, backgroundColor: COLORS.background,
  },
  selectorClienteNombre: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  selectorClienteSub: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  selectorClientePlaceholder: { fontSize: 14, color: COLORS.textLight },
  btnPagoTotal: { borderWidth: 1.5, borderRadius: 10, padding: 9, alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 14 },
  btnPagoTotalTexto: { fontWeight: '700', fontSize: 13 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  chipTexto: { fontWeight: '700', fontSize: 13 },
  btnGuardar: { borderRadius: 12, padding: 14, alignItems: 'center' },
  btnGuardarTexto: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnCancelar: {
    borderRadius: 12, padding: 14, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 18, borderWidth: 1, borderColor: COLORS.border,
  },
  btnCancelarTexto: { color: COLORS.textLight, fontWeight: '700', fontSize: 13 },

  seccionTitulo: { fontSize: 13, fontWeight: '800', color: COLORS.text, textTransform: 'uppercase', letterSpacing: 0.5 },

  card: {
    backgroundColor: COLORS.card, borderRadius: 12, padding: 14, gap: 6,
    borderLeftWidth: 4, borderLeftColor: COLORS.primary,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4,
  },
  cardEditando: { borderLeftColor: COLORS.warning, backgroundColor: '#FFFBEB' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardCliente: { fontSize: 14, fontWeight: '700', color: COLORS.text, flex: 1 },
  cardClienteNumero: { fontSize: 12, fontWeight: '400', color: COLORS.textLight },
  cardFecha: { fontSize: 12, color: COLORS.textLight },
  cardMontos: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 2 },
  cardMontoTexto: { fontSize: 12, color: COLORS.textLight },
  cardMontoValor: { fontWeight: '800', color: COLORS.text },
  cardDato: { fontSize: 12, color: COLORS.textLight },
  cardNota: { fontSize: 12, color: COLORS.text, fontStyle: 'italic' },

  pill: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  pillTexto: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },

  accionesFila: { flexDirection: 'row', gap: 8, marginTop: 6 },
  btnAccionSec: {
    flex: 1, borderRadius: 10, padding: 9, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.background,
  },
  btnAccionSecTexto: { color: COLORS.textLight, fontWeight: '700', fontSize: 12 },
  btnAccionDanger: {
    flex: 1, borderRadius: 10, padding: 9, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.danger, backgroundColor: '#FEF2F2',
  },
  btnAccionDangerTexto: { color: COLORS.danger, fontWeight: '700', fontSize: 12 },

  vacio: { alignItems: 'center', paddingTop: 40, gap: 10 },
  vacioEmoji: { fontSize: 40 },
  vacioTexto: { fontSize: 14, color: COLORS.textLight, textAlign: 'center' },

  modal: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  modalTitulo: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  modalCerrar: { fontSize: 20, color: COLORS.textLight },
  opcionCliente: {
    backgroundColor: COLORS.card, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: COLORS.border,
  },
  opcionClienteNombre: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  opcionClienteDireccion: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
});
