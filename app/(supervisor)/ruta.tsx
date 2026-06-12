import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity,
  Alert, ScrollView, Image, TextInput,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useJornadaStore } from '../../store/jornadaStore';
import {
  obtenerAsignacionHoy, obtenerParadas,
  registrarParada, actualizarOrdenRuta,
} from '../../services/api';
import { obtenerUbicacionRapida } from '../../services/gps';
import CartillaModal from '../../components/CartillaModal';
import NuevoClienteModal from '../../components/NuevoClienteModal';
import FechaVencimientoPicker from '../../components/FechaVencimientoPicker';
import { COLORS } from '../../constants';
import { Cliente } from '../../types';
import {
  agregarVisitaPendiente, obtenerVisitasPendientes,
  procesarVisitasPendientes, suscribirVisitasPendientes, VisitaPendiente,
} from '../../services/offlineVisitas';

type EstadoVisita = 'esperando' | 'formulario';

export default function RutaSupervisor() {
  const { jornada } = useJornadaStore();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [rutaId, setRutaId] = useState<number | null>(null);
  const [paradas, setParadas] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [clienteCartilla, setClienteCartilla] = useState<Cliente | null>(null);
  const [nuevoClienteVisible, setNuevoClienteVisible] = useState(false);

  // Flujo de visita
  const [clienteActual, setClienteActual] = useState<Cliente | null>(null);
  const [paradaActual, setParadaActual] = useState<any>(null);
  const [estadoVisita, setEstadoVisita] = useState<EstadoVisita>('esperando');
  const [fotos, setFotos] = useState<(string | null)[]>([null, null, null, null, null]);
  const [procesando, setProcesando] = useState(false);
  const enviandoRef = useRef(false);

  // Formulario
  const [nota, setNota] = useState('');
  const [tieneVencidos, setTieneVencidos] = useState(false);
  const [mercaderiaVencida, setMercaderiaVencida] = useState('');
  const [tipoVenc, setTipoVenc] = useState<'vencida' | 'fecha'>('fecha');
  const [fechaVencimiento, setFechaVencimiento] = useState<Date | null>(null);
  const [urgente, setUrgente] = useState(false);
  const [urgenciaDesc, setUrgenciaDesc] = useState('');
  const [accionRequerida, setAccionRequerida] = useState(false);
  const [accionDesc, setAccionDesc] = useState('');
  const [productoInforme, setProductoInforme] = useState('');
  const [precioInforme, setPrecioInforme] = useState('');
  const [pendientes, setPendientes] = useState<VisitaPendiente[]>([]);

  useEffect(() => { cargar(); }, []);

  useEffect(() => {
    if (!jornada) return;
    const cargarPendientes = () => obtenerVisitasPendientes(jornada.id).then(setPendientes);
    cargarPendientes();
    return suscribirVisitasPendientes(cargarPendientes);
  }, [jornada]);

  const cargar = async () => {
    setCargando(true);
    try {
      const asigRes = await obtenerAsignacionHoy();
      setClientes(asigRes.data?.ruta?.clientes?.map((c: any) => c.cliente) ?? []);
      setRutaId(asigRes.data?.ruta?.id ?? null);
      if (jornada) {
        const paradasRes = await obtenerParadas(jornada.id);
        setParadas(paradasRes.data);
      }
    } catch {}
    setCargando(false);
  };

  const iniciarVisita = async (cliente: Cliente) => {
    if (!jornada) {
      Alert.alert('Sin jornada', 'Iniciá la jornada desde la pantalla de Inicio primero.');
      return;
    }
    setProcesando(true);
    try {
      // Si ya existe una parada sin completar para este cliente (quedó "trabada"
      // por un corte de conexión), la retomamos en lugar de crear otra.
      const pendiente = paradas.find((p) => p.cliente_id === cliente.id && !p.completada);
      let parada = pendiente;
      if (!parada) {
        const { lat, lng } = await obtenerUbicacionRapida();
        try {
          const res = await registrarParada({ jornada_id: jornada.id, lat, lng, cliente_id: cliente.id });
          parada = res.data;
        } catch (e: any) {
          if (e?.response) throw e;
          parada = {
            id: -Date.now(),
            jornada_id: jornada.id,
            cliente_id: cliente.id,
            lat, lng,
            timestamp_llegada: new Date().toISOString(),
            completada: false,
            cliente,
          };
        }
      }
      setParadaActual(parada);
      setClienteActual(cliente);
      setFotos([null, null, null, null, null]);
      setNota('');
      setTieneVencidos(false); setMercaderiaVencida(''); setTipoVenc('fecha'); setFechaVencimiento(null);
      setUrgente(false); setUrgenciaDesc('');
      setAccionRequerida(false); setAccionDesc('');
      setProductoInforme(''); setPrecioInforme('');
      setEstadoVisita('formulario');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? 'No se pudo registrar la visita');
    }
    setProcesando(false);
  };

  const tomarFoto = async (index: number) => {
    try {
      const permiso = await ImagePicker.requestCameraPermissionsAsync();
      if (permiso.status !== 'granted') {
        Alert.alert(
          'Permiso de cámara',
          permiso.canAskAgain
            ? 'Necesitás permitir el acceso a la cámara.'
            : 'El permiso fue denegado permanentemente. Habilitalo en Ajustes → Aplicaciones → Permisos → Cámara.',
          [{ text: 'OK' }]
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.3, allowsEditing: false });
      if (result.canceled) return;
      const uri = result.assets[0].uri;
      setFotos((prev) => {
        const next = [...prev];
        next[index] = uri;
        return next;
      });
    } catch {
      Alert.alert('Error', 'No se pudo abrir la cámara. Verificá que la app tiene permiso.');
    }
  };

  const confirmarVisita = async () => {
    if (enviandoRef.current) return;
    if (!paradaActual) {
      Alert.alert('Error', 'No se encontró la visita en curso. Volvé a presionar "Visitar".');
      return;
    }
    enviandoRef.current = true;
    setProcesando(true);
    try {
      const fotosPendientes = fotos
        .map((uri, i) => (uri ? { numero: i + 1, uri } : null))
        .filter((f): f is { numero: number; uri: string } => f !== null);

      await agregarVisitaPendiente({
        jornada_id: jornada!.id,
        cliente_id: paradaActual.cliente_id ?? clienteActual?.id ?? 0,
        cliente_nombre: clienteActual?.nombre,
        cliente_direccion: clienteActual?.direccion,
        lat: paradaActual.lat,
        lng: paradaActual.lng,
        parada_id: paradaActual.id > 0 ? paradaActual.id : undefined,
        fotos: fotosPendientes,
        finalizar: {
          nota: nota.trim() || undefined,
          tiene_vencidos: tieneVencidos,
          mercaderia_vencida: tieneVencidos ? mercaderiaVencida.trim() || null : null,
          fecha_vencimiento: tieneVencidos
            ? (tipoVenc === 'vencida' ? 'Vencida' : fechaVencimiento
                ? `${String(fechaVencimiento.getDate()).padStart(2,'0')}/${String(fechaVencimiento.getMonth()+1).padStart(2,'0')}/${fechaVencimiento.getFullYear()}`
                : null)
            : null,
          urgente,
          urgencia_descripcion: urgente ? urgenciaDesc.trim() || null : null,
          accion_requerida: accionRequerida ? accionDesc.trim() || null : null,
          producto_informe: productoInforme.trim() || null,
          precio_informe: precioInforme.trim() || null,
        },
      });

      setEstadoVisita('esperando');
      setClienteActual(null);
      setParadaActual(null);

      procesarVisitasPendientes().then(cargar);
    } catch {
      Alert.alert('Error', 'No se pudo guardar la visita. Probá de nuevo.');
    } finally {
      setProcesando(false);
      enviandoRef.current = false;
    }
  };

  const moverCliente = (index: number, direccion: -1 | 1) => {
    const nuevoIndex = index + direccion;
    if (nuevoIndex < 0 || nuevoIndex >= clientes.length) return;
    const nuevos = [...clientes];
    [nuevos[index], nuevos[nuevoIndex]] = [nuevos[nuevoIndex], nuevos[index]];
    setClientes(nuevos);
    if (rutaId) {
      actualizarOrdenRuta(rutaId, nuevos.map((c) => c.id)).catch(() => {});
    }
  };

  if (cargando) return <View style={styles.center}><ActivityIndicator color={COLORS.supervisor} size="large" /></View>;

  const paradasCompletadas = paradas.filter((p) => p.completada);

  return (
    <View style={styles.container}>

      {/* ── Panel de visita activa ── */}
      {estadoVisita !== 'esperando' && clienteActual && (
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.panelCliente}>{clienteActual.nombre}</Text>
              <Text style={styles.panelDir}>{clienteActual.direccion}</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                Alert.alert('Cancelar visita', '¿Cancelar el registro de esta visita?', [
                  { text: 'No', style: 'cancel' },
                  { text: 'Sí, cancelar', style: 'destructive', onPress: () => {
                    setEstadoVisita('esperando');
                    setClienteActual(null);
                  }},
                ]);
              }}
            >
              <Text style={styles.panelCerrar}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Paso: Formulario */}
          {estadoVisita === 'formulario' && (
            <ScrollView style={styles.panelScroll} contentContainerStyle={styles.panelScrollContent} showsVerticalScrollIndicator={false}>
              {/* Fotos */}
              <Text style={styles.pasoTitulo}>📷 Fotos (opcional)</Text>
              <Text style={styles.fotoPanelDesc}>
                Tocá un casillero para sacar esa foto. Podés sacarlas en el orden que quieras, incluso al final.
              </Text>
              <View style={styles.fotosGrid}>
                {fotos.map((f, i) => (
                  <TouchableOpacity key={i} style={styles.fotoSlot} onPress={() => tomarFoto(i)}>
                    {f ? (
                      <Image source={{ uri: f }} style={styles.fotoSlotImg} />
                    ) : (
                      <Text style={styles.fotoSlotIcono}>📷</Text>
                    )}
                    <View style={styles.fotoSlotBadge}>
                      <Text style={styles.fotoSlotBadgeTexto}>{i + 1}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Toggle: Mercadería vencida */}
              <TouchableOpacity
                style={[styles.toggleRow, tieneVencidos && styles.toggleRowVenc]}
                onPress={() => setTieneVencidos((v) => !v)}
                activeOpacity={0.7}
              >
                <Text style={styles.toggleEmoji}>📦</Text>
                <Text style={styles.toggleLabel}>Mercadería vencida / por vencer</Text>
                <View style={[styles.toggleBubble, tieneVencidos && styles.toggleBubbleOn]}>
                  <Text style={styles.toggleBubbleTexto}>{tieneVencidos ? 'SÍ' : 'NO'}</Text>
                </View>
              </TouchableOpacity>

              {tieneVencidos && (
                <View style={styles.subForm}>
                  <Text style={styles.subLabel}>¿Qué mercadería?</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ej: yogur marca X, galletitas..."
                    placeholderTextColor={COLORS.textLight}
                    value={mercaderiaVencida}
                    onChangeText={setMercaderiaVencida}
                  />
                  <Text style={[styles.subLabel, { marginTop: 10 }]}>Estado</Text>
                  <View style={styles.chipsRow}>
                    {(['vencida', 'fecha'] as const).map((op) => (
                      <TouchableOpacity
                        key={op}
                        style={[styles.chip, tipoVenc === op && styles.chipActivo]}
                        onPress={() => setTipoVenc(op)}
                      >
                        <Text style={[styles.chipTexto, tipoVenc === op && styles.chipTextoActivo]}>
                          {op === 'vencida' ? 'Ya vencida' : 'Próximo vencimiento'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {tipoVenc === 'fecha' && (
                    <FechaVencimientoPicker
                      value={fechaVencimiento}
                      onChange={setFechaVencimiento}
                    />
                  )}
                </View>
              )}

              {/* Toggle: Urgente / problema en el local */}
              <TouchableOpacity
                style={[styles.toggleRow, urgente && styles.toggleRowUrgente]}
                onPress={() => setUrgente((v) => !v)}
                activeOpacity={0.7}
              >
                <Text style={styles.toggleEmoji}>🚨</Text>
                <Text style={[styles.toggleLabel, urgente && { color: COLORS.danger, fontWeight: '700' }]}>
                  Reportar un problema / atención urgente
                </Text>
                <View style={[styles.toggleBubble, urgente && styles.toggleBubbleUrgente]}>
                  <Text style={styles.toggleBubbleTexto}>{urgente ? 'SÍ' : 'NO'}</Text>
                </View>
              </TouchableOpacity>

              {urgente && (
                <View style={[styles.subForm, styles.subFormUrgente]}>
                  <Text style={styles.subLabel}>Describí el problema</Text>
                  <TextInput
                    style={[styles.input, styles.inputMultiline]}
                    placeholder="Ej: exhibidor roto, falta de stock, mal estado del local..."
                    placeholderTextColor={COLORS.textLight}
                    value={urgenciaDesc}
                    onChangeText={setUrgenciaDesc}
                    multiline
                  />
                </View>
              )}

              {/* Toggle: Acciones para administración/supervisor */}
              <TouchableOpacity
                style={[styles.toggleRow, accionRequerida && styles.toggleRowAccion]}
                onPress={() => setAccionRequerida((v) => !v)}
                activeOpacity={0.7}
              >
                <Text style={styles.toggleEmoji}>📋</Text>
                <Text style={[styles.toggleLabel, accionRequerida && { color: COLORS.secondary, fontWeight: '700' }]}>
                  Acción para administración / supervisor
                </Text>
                <View style={[styles.toggleBubble, accionRequerida && styles.toggleBubbleAccion]}>
                  <Text style={styles.toggleBubbleTexto}>{accionRequerida ? 'SÍ' : 'NO'}</Text>
                </View>
              </TouchableOpacity>

              {accionRequerida && (
                <View style={[styles.subForm, styles.subFormAccion]}>
                  <Text style={styles.subLabel}>¿Qué acción tiene que hacer?</Text>
                  <TextInput
                    style={[styles.input, styles.inputMultiline]}
                    placeholder="Ej: contactar al cliente, revisar precio, gestionar pedido..."
                    placeholderTextColor={COLORS.textLight}
                    value={accionDesc}
                    onChangeText={setAccionDesc}
                    multiline
                  />
                </View>
              )}

              {/* Informe de producto/precio */}
              <View style={styles.informeBox}>
                <Text style={styles.informeTitulo}>💰 Informe de precio (opcional)</Text>
                <Text style={styles.informeDesc}>Registrá qué producto y a qué precio se ofrece</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Nombre del producto"
                  placeholderTextColor={COLORS.textLight}
                  value={productoInforme}
                  onChangeText={setProductoInforme}
                />
                <TextInput
                  style={[styles.input, { marginTop: 6 }]}
                  placeholder="Precio (ej: $1500)"
                  placeholderTextColor={COLORS.textLight}
                  keyboardType="decimal-pad"
                  value={precioInforme}
                  onChangeText={setPrecioInforme}
                />
              </View>

              {/* Nota */}
              <View style={styles.formGroup}>
                <Text style={styles.subLabel}>Nota (opcional)</Text>
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  placeholder="Observaciones adicionales..."
                  placeholderTextColor={COLORS.textLight}
                  multiline
                  value={nota}
                  onChangeText={setNota}
                />
              </View>

              <TouchableOpacity
                style={[styles.btnConfirmar, procesando && { opacity: 0.6 }]}
                onPress={confirmarVisita}
                disabled={procesando}
              >
                {procesando
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnConfirmarTexto}>✓ Confirmar visita</Text>}
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      )}

      {/* ── Lista de clientes ── */}
      {estadoVisita === 'esperando' && (
        <>
          <View style={styles.resumen}>
            {pendientes.length > 0 && (
              <View style={styles.pendientesBanner}>
                <Text style={styles.pendientesTexto}>
                  ⏳ {pendientes.length} visita{pendientes.length > 1 ? 's' : ''} pendiente{pendientes.length > 1 ? 's' : ''} de enviar — se enviarán solas cuando haya internet
                </Text>
              </View>
            )}
            <View style={styles.resumenHeader}>
              <Text style={styles.resumenTexto}>
                {paradasCompletadas.length + pendientes.length} / {clientes.length} clientes visitados
              </Text>
              <TouchableOpacity style={styles.btnNuevoCliente} onPress={() => setNuevoClienteVisible(true)}>
                <Text style={styles.btnNuevoClienteTexto}>+ Nuevo cliente</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.barra}>
              <View style={[
                styles.barraFill,
                { width: clientes.length ? `${(paradasCompletadas.length / clientes.length) * 100}%` : '0%' }
              ]} />
            </View>
          </View>

          <FlatList
            data={clientes}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ padding: 16, gap: 10 }}
            renderItem={({ item, index }) => {
              const visitado = paradas.some((p) => p.cliente_id === item.id && p.completada)
                || pendientes.some((p) => p.cliente_id === item.id);
              return (
                <View style={[styles.clienteCard, visitado && styles.clienteCardVisitado]}>
                  <View style={styles.clienteOrden}>
                    <Text style={styles.clienteOrdenNum}>{index + 1}</Text>
                  </View>
                  <View style={styles.flechasOrden}>
                    <TouchableOpacity
                      style={[styles.btnFlecha, index === 0 && styles.btnFlechaDisabled]}
                      onPress={() => moverCliente(index, -1)}
                      disabled={index === 0}
                    >
                      <Text style={styles.btnFlechaTexto}>▲</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.btnFlecha, index === clientes.length - 1 && styles.btnFlechaDisabled]}
                      onPress={() => moverCliente(index, 1)}
                      disabled={index === clientes.length - 1}
                    >
                      <Text style={styles.btnFlechaTexto}>▼</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.clienteInfo}>
                    <Text style={styles.clienteNombre}>{item.nombre}</Text>
                    <Text style={styles.clienteDireccion}>{item.direccion}</Text>
                    {item.telefono && <Text style={styles.clienteTelefono}>📞 {item.telefono}</Text>}
                  </View>
                  <View style={styles.botonesCard}>
                    {visitado ? (
                      <Text style={styles.visitadoCheck}>✓</Text>
                    ) : (
                      <TouchableOpacity
                        style={[styles.btnVisitar, procesando && { opacity: 0.5 }]}
                        onPress={() => iniciarVisita(item)}
                        disabled={procesando}
                      >
                        <Text style={styles.btnVisitarTexto}>Visitar</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.btnCartilla}
                      onPress={() => setClienteCartilla(item)}
                    >
                      <Text style={styles.btnCartillaIcono}>📋</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={<Text style={styles.vacio}>No hay clientes en la ruta de hoy</Text>}
          />
        </>
      )}

      <CartillaModal
        cliente={clienteCartilla}
        visible={!!clienteCartilla}
        color={COLORS.supervisor}
        onClose={() => setClienteCartilla(null)}
        onGuardado={cargar}
        onEliminado={cargar}
      />

      <NuevoClienteModal
        visible={nuevoClienteVisible}
        color={COLORS.supervisor}
        onClose={() => setNuevoClienteVisible(false)}
        onCreado={cargar}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Panel de visita
  panel: {
    flex: 1,
    backgroundColor: COLORS.card,
    margin: 12,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  panelHeader: {
    backgroundColor: COLORS.supervisor,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  panelCliente: { fontSize: 16, fontWeight: '800', color: '#fff' },
  panelDir: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  panelCerrar: { fontSize: 22, color: '#fff', fontWeight: '700', padding: 4 },
  panelBody: { padding: 20, gap: 12 },
  panelScroll: { flex: 1 },
  panelScrollContent: { padding: 16, gap: 12 },

  // Paso fotos
  pasoTitulo: { fontSize: 18, fontWeight: '800', color: COLORS.supervisor, marginBottom: 4 },
  fotoPanelDesc: { fontSize: 13, color: COLORS.textLight, marginBottom: 4 },
  fotosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  fotoMini: { width: 70, height: 70, borderRadius: 8 },
  fotosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  fotoSlot: {
    width: 70,
    height: 70,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  fotoSlotImg: { width: '100%', height: '100%' },
  fotoSlotIcono: { fontSize: 24 },
  fotoSlotBadge: {
    position: 'absolute',
    top: 2,
    left: 2,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fotoSlotBadgeTexto: { color: '#fff', fontSize: 10, fontWeight: '700' },
  btnFoto: {
    backgroundColor: COLORS.supervisor,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  btnFotoIcono: { fontSize: 36 },
  btnFotoTexto: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnRetomar: { alignItems: 'center', paddingVertical: 8 },
  btnRetomarTexto: { color: COLORS.textLight, fontSize: 13 },
  btnSaltear: { alignItems: 'center', paddingVertical: 10 },
  btnSaltearTexto: { color: COLORS.textLight, fontSize: 13, textDecorationLine: 'underline' },
  btnPrimario: {
    backgroundColor: COLORS.supervisor,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  btnTexto: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Formulario
  formGroup: { gap: 4 },
  subLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textLight, textTransform: 'uppercase' },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: COLORS.background,
  },
  inputMultiline: { minHeight: 70, textAlignVertical: 'top' },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  toggleRowVenc: { borderColor: '#F59E0B', backgroundColor: '#FFFBEB' },
  toggleRowUrgente: { borderColor: COLORS.danger, backgroundColor: '#FEF2F2' },
  toggleEmoji: { fontSize: 22 },
  toggleLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.text },
  toggleBubble: {
    backgroundColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  toggleBubbleOn: { backgroundColor: '#F59E0B' },
  toggleBubbleUrgente: { backgroundColor: COLORS.danger },
  toggleBubbleAccion: { backgroundColor: COLORS.secondary },
  toggleBubbleTexto: { fontSize: 11, fontWeight: '800', color: '#fff' },
  toggleRowAccion: { borderColor: COLORS.secondary, backgroundColor: '#EFF6FF' },

  subForm: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  subFormUrgente: { borderColor: COLORS.danger },
  subFormAccion: { borderColor: COLORS.secondary },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: COLORS.card,
  },
  chipActivo: { borderColor: COLORS.supervisor, backgroundColor: COLORS.supervisor },
  chipTexto: { fontSize: 13, fontWeight: '600', color: COLORS.textLight },
  chipTextoActivo: { color: '#fff' },

  informeBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  informeTitulo: { fontSize: 14, fontWeight: '700', color: '#1D4ED8' },
  informeDesc: { fontSize: 12, color: '#3B82F6', marginBottom: 4 },

  btnConfirmar: {
    backgroundColor: COLORS.success,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnConfirmarTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },

  // Lista de clientes
  resumen: {
    backgroundColor: COLORS.card,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  resumenHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  resumenTexto: { fontSize: 14, color: COLORS.text, fontWeight: '600' },
  pendientesBanner: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 10,
    padding: 10,
  },
  pendientesTexto: { fontSize: 12, color: '#92400E', fontWeight: '600' },
  btnNuevoCliente: {
    backgroundColor: COLORS.supervisor,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  btnNuevoClienteTexto: { color: '#fff', fontWeight: '700', fontSize: 12 },
  barra: { height: 8, backgroundColor: COLORS.border, borderRadius: 4 },
  barraFill: { height: 8, backgroundColor: COLORS.supervisor, borderRadius: 4 },

  clienteCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.supervisor,
  },
  clienteCardVisitado: { borderLeftColor: COLORS.success, opacity: 0.75 },
  clienteOrden: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.supervisor,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clienteOrdenNum: { color: '#fff', fontWeight: '700', fontSize: 13 },
  flechasOrden: { gap: 2 },
  btnFlecha: {
    width: 26, height: 22, borderRadius: 6,
    backgroundColor: COLORS.background,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  btnFlechaDisabled: { opacity: 0.3 },
  btnFlechaTexto: { fontSize: 11, color: COLORS.supervisor, fontWeight: '700' },
  clienteInfo: { flex: 1 },
  clienteNombre: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  clienteDireccion: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  clienteTelefono: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },

  botonesCard: { flexDirection: 'column', alignItems: 'center', gap: 6 },
  visitadoCheck: { fontSize: 22, color: COLORS.success, fontWeight: '700' },
  btnVisitar: {
    backgroundColor: COLORS.supervisor,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  btnVisitarTexto: { color: '#fff', fontWeight: '700', fontSize: 12 },
  btnCartilla: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: COLORS.background,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  btnCartillaIcono: { fontSize: 16 },

  vacio: { textAlign: 'center', color: COLORS.textLight, marginTop: 60, fontSize: 14 },
});
