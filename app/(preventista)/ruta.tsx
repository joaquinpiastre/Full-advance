import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity,
  Alert, ScrollView, Image, TextInput,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useJornadaStore } from '../../store/jornadaStore';
import {
  obtenerAsignacionHoy, obtenerParadas,
  registrarParada, subirFoto, finalizarParada,
} from '../../services/api';
import CartillaModal from '../../components/CartillaModal';
import NuevoClienteModal from '../../components/NuevoClienteModal';
import FechaVencimientoPicker from '../../components/FechaVencimientoPicker';
import { COLORS } from '../../constants';
import { Cliente } from '../../types';

type EstadoVisita = 'esperando' | 'fotos' | 'formulario';
const MAX_FOTOS = 5;

export default function RutaPreventista() {
  const { jornada } = useJornadaStore();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [paradas, setParadas] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [clienteCartilla, setClienteCartilla] = useState<Cliente | null>(null);
  const [nuevoClienteVisible, setNuevoClienteVisible] = useState(false);

  // Flujo de visita
  const [clienteActual, setClienteActual] = useState<Cliente | null>(null);
  const [paradaActual, setParadaActual] = useState<any>(null);
  const [estadoVisita, setEstadoVisita] = useState<EstadoVisita>('esperando');
  const [fotos, setFotos] = useState<(string | null)[]>([null, null, null, null, null]);
  const [fotoIndex, setFotoIndex] = useState(0);
  const [procesando, setProcesando] = useState(false);

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
  const enviandoRef = useRef(false);

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setCargando(true);
    try {
      const asigRes = await obtenerAsignacionHoy();
      setClientes(asigRes.data?.ruta?.clientes?.map((c: any) => c.cliente) ?? []);
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
        let lat = 0, lng = 0;
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          lat = loc.coords.latitude;
          lng = loc.coords.longitude;
        } catch {}
        const res = await registrarParada({ jornada_id: jornada.id, lat, lng, cliente_id: cliente.id });
        parada = res.data;
      }
      setParadaActual(parada);
      setClienteActual(cliente);
      setFotos([null, null, null, null, null]);
      setFotoIndex(0);
      setNota('');
      setTieneVencidos(false); setMercaderiaVencida(''); setTipoVenc('fecha'); setFechaVencimiento(null);
      setUrgente(false); setUrgenciaDesc('');
      setAccionRequerida(false); setAccionDesc('');
      setProductoInforme(''); setPrecioInforme('');
      setEstadoVisita('fotos');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? 'No se pudo registrar la visita');
    }
    setProcesando(false);
  };

  const tomarFoto = async () => {
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
        next[fotoIndex] = uri;
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
      for (let i = 0; i < fotos.length; i++) {
        const foto = fotos[i];
        if (!foto) continue;
        const f = new FormData();
        f.append('foto', { uri: foto, type: 'image/jpeg', name: `foto${i + 1}.jpg` } as any);
        f.append('numero', String(i + 1));
        await subirFoto(paradaActual.id, f);
      }
      await finalizarParada(paradaActual.id, {
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
      });
      setEstadoVisita('esperando');
      setClienteActual(null);
      setParadaActual(null);
      await cargar();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? 'No se pudo confirmar la visita. Probá de nuevo.');
    } finally {
      setProcesando(false);
      enviandoRef.current = false;
    }
  };

  if (cargando) return <View style={styles.center}><ActivityIndicator color={COLORS.preventista} size="large" /></View>;

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

          {/* Paso: Fotos */}
          {estadoVisita === 'fotos' && (
            <View style={styles.panelBody}>
              <Text style={styles.pasoTitulo}>📷 Foto {fotoIndex + 1} de {MAX_FOTOS}</Text>
              {fotos[fotoIndex] ? (
                <>
                  <Image source={{ uri: fotos[fotoIndex]! }} style={styles.fotoPreview} />
                  <TouchableOpacity style={styles.btnRetomar} onPress={tomarFoto}>
                    <Text style={styles.btnRetomarTexto}>🔄 Retomar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.btnPrimario}
                    onPress={() => {
                      if (fotoIndex < MAX_FOTOS - 1) setFotoIndex(fotoIndex + 1);
                      else setEstadoVisita('formulario');
                    }}
                  >
                    <Text style={styles.btnTexto}>{fotoIndex < MAX_FOTOS - 1 ? 'Siguiente →' : 'Continuar →'}</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity style={styles.btnFoto} onPress={tomarFoto}>
                    <Text style={styles.btnFotoIcono}>📷</Text>
                    <Text style={styles.btnFotoTexto}>Tomar Foto {fotoIndex + 1}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.btnSaltear}
                    onPress={() => {
                      if (fotoIndex < MAX_FOTOS - 1) setFotoIndex(fotoIndex + 1);
                      else setEstadoVisita('formulario');
                    }}
                  >
                    <Text style={styles.btnSaltearTexto}>
                      {fotoIndex < MAX_FOTOS - 1 ? 'Saltear esta foto' : 'Saltear y continuar'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
              {fotos.some((f) => f) && (
                <View style={styles.fotosRow}>
                  {fotos.map((f, i) => f && <Image key={i} source={{ uri: f }} style={styles.fotoMini} />)}
                </View>
              )}
              {fotos.some((f) => f) && (
                <TouchableOpacity style={styles.btnSaltear} onPress={() => setEstadoVisita('formulario')}>
                  <Text style={styles.btnSaltearTexto}>Terminar fotos e ir al formulario</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Paso: Formulario */}
          {estadoVisita === 'formulario' && (
            <ScrollView style={styles.panelScroll} contentContainerStyle={styles.panelScrollContent} showsVerticalScrollIndicator={false}>
              {/* Fotos tomadas */}
              {fotos.some((f) => f) && (
                <View style={styles.fotosRow}>
                  {fotos.map((f, i) => f && <Image key={i} source={{ uri: f }} style={styles.fotoMini} />)}
                </View>
              )}

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

              {/* Toggle: Urgente */}
              <TouchableOpacity
                style={[styles.toggleRow, urgente && styles.toggleRowUrgente]}
                onPress={() => setUrgente((v) => !v)}
                activeOpacity={0.7}
              >
                <Text style={styles.toggleEmoji}>🚨</Text>
                <Text style={[styles.toggleLabel, urgente && { color: COLORS.danger, fontWeight: '700' }]}>
                  Atención urgente requerida
                </Text>
                <View style={[styles.toggleBubble, urgente && styles.toggleBubbleUrgente]}>
                  <Text style={styles.toggleBubbleTexto}>{urgente ? 'SÍ' : 'NO'}</Text>
                </View>
              </TouchableOpacity>

              {urgente && (
                <View style={[styles.subForm, styles.subFormUrgente]}>
                  <Text style={styles.subLabel}>¿Qué necesita urgente?</Text>
                  <TextInput
                    style={[styles.input, styles.inputMultiline]}
                    placeholder="Ej: falta producto, problema con equipo..."
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
                <Text style={styles.informeDesc}>Registrá qué producto compró y a qué precio</Text>
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
            <View style={styles.resumenHeader}>
              <Text style={styles.resumenTexto}>
                {paradasCompletadas.length} / {clientes.length} clientes visitados
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
              const visitado = paradas.some((p) => p.cliente_id === item.id && p.completada);
              return (
                <View style={[styles.clienteCard, visitado && styles.clienteCardVisitado]}>
                  <View style={styles.clienteOrden}>
                    <Text style={styles.clienteOrdenNum}>{index + 1}</Text>
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
        color={COLORS.preventista}
        onClose={() => setClienteCartilla(null)}
        onGuardado={cargar}
      />

      <NuevoClienteModal
        visible={nuevoClienteVisible}
        color={COLORS.preventista}
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
    backgroundColor: COLORS.preventista,
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
  pasoTitulo: { fontSize: 18, fontWeight: '800', color: COLORS.preventista, marginBottom: 4 },
  fotoPreview: { width: '100%', height: 200, borderRadius: 10 },
  fotosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  fotoMini: { width: 70, height: 70, borderRadius: 8 },
  btnFoto: {
    backgroundColor: COLORS.preventista,
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
    backgroundColor: COLORS.preventista,
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
  chipActivo: { borderColor: COLORS.preventista, backgroundColor: COLORS.preventista },
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
  btnNuevoCliente: {
    backgroundColor: COLORS.preventista,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  btnNuevoClienteTexto: { color: '#fff', fontWeight: '700', fontSize: 12 },
  barra: { height: 8, backgroundColor: COLORS.border, borderRadius: 4 },
  barraFill: { height: 8, backgroundColor: COLORS.preventista, borderRadius: 4 },

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
    borderLeftColor: COLORS.preventista,
  },
  clienteCardVisitado: { borderLeftColor: COLORS.success, opacity: 0.75 },
  clienteOrden: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.preventista,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clienteOrdenNum: { color: '#fff', fontWeight: '700', fontSize: 13 },
  clienteInfo: { flex: 1 },
  clienteNombre: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  clienteDireccion: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  clienteTelefono: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },

  botonesCard: { flexDirection: 'column', alignItems: 'center', gap: 6 },
  visitadoCheck: { fontSize: 22, color: COLORS.success, fontWeight: '700' },
  btnVisitar: {
    backgroundColor: COLORS.preventista,
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
