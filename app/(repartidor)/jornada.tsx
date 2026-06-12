import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ScrollView, ActivityIndicator, Image, TextInput, Modal, FlatList,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useJornadaStore } from '../../store/jornadaStore';
import { registrarParada, subirFoto, finalizarParada, obtenerParadas, obtenerAsignacionHoy } from '../../services/api';
import CartillaModal from '../../components/CartillaModal';
import NuevoClienteModal from '../../components/NuevoClienteModal';
import { COLORS, urlFoto } from '../../constants';
import { Parada, Cliente } from '../../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type EstadoFotos = 'esperando' | 'fotos' | 'nota';
const MAX_FOTOS = 5;

export default function JornadaRepartidor() {
  const { jornada, paradaActual, setParadaActual } = useJornadaStore();
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [asignacion, setAsignacion] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [estadoFotos, setEstadoFotos] = useState<EstadoFotos>('esperando');
  const [fotos, setFotos] = useState<(string | null)[]>([null, null, null, null, null]);
  const [fotoIndex, setFotoIndex] = useState(0);
  const [nota, setNota] = useState('');
  const [accionRequerida, setAccionRequerida] = useState(false);
  const [accionDesc, setAccionDesc] = useState('');
  const [productoInforme, setProductoInforme] = useState('');
  const [precioInforme, setPrecioInforme] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [clientesModal, setClientesModal] = useState(false);
  const [clienteCartilla, setClienteCartilla] = useState<Cliente | null>(null);
  const [nuevoClienteVisible, setNuevoClienteVisible] = useState(false);
  const enviandoRef = useRef(false);

  useEffect(() => {
    if (jornada) cargarDatos();
  }, [jornada]);

  const cargarDatos = async () => {
    if (!jornada) return;
    setCargando(true);
    try {
      const [paradasRes, asigRes] = await Promise.allSettled([
        obtenerParadas(jornada.id),
        obtenerAsignacionHoy(),
      ]);
      if (paradasRes.status === 'fulfilled') setParadas(paradasRes.value.data);
      if (asigRes.status === 'fulfilled') setAsignacion(asigRes.value.data);
    } catch {}
    setCargando(false);
  };

  const iniciarParadaEnCliente = async (cliente: Cliente) => {
    if (!jornada) return;
    setClientesModal(false);
    setProcesando(true);
    try {
      // Si ya existe una parada sin completar para este cliente (quedó "trabada"
      // por un corte de conexión), la retomamos en lugar de crear otra.
      let parada: Parada | null = paradas.find((p) => p.cliente_id === cliente.id && !p.completada) ?? null;
      if (!parada) {
        // Intentamos obtener la ubicación; si falla (GPS apagado, permisos, etc.)
        // continuamos igual con coordenadas 0 para no bloquear el flujo de fotos.
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
      setEstadoFotos('fotos');
      setFotos([null, null, null, null, null]);
      setFotoIndex(0);
      setNota('');
      setAccionRequerida(false);
      setAccionDesc('');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? 'No se pudo registrar la parada');
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
      Alert.alert('Error', 'No se pudo abrir la cámara. Verificá que la app tiene permiso de cámara en la configuración del teléfono.');
    }
  };

  const confirmarParada = async () => {
    if (enviandoRef.current) return;
    if (!paradaActual) {
      Alert.alert('Error', 'No se encontró la parada en curso. Volvé a registrar la llegada al cliente.');
      return;
    }
    enviandoRef.current = true;
    setProcesando(true);
    try {
      for (let i = 0; i < fotos.length; i++) {
        const foto = fotos[i];
        if (!foto) continue;
        const form = new FormData();
        form.append('foto', { uri: foto, type: 'image/jpeg', name: `foto${i + 1}.jpg` } as any);
        form.append('numero', String(i + 1));
        await subirFoto(paradaActual.id, form);
      }
      await finalizarParada(paradaActual.id, {
        nota: nota.trim() || undefined,
        accion_requerida: accionRequerida ? accionDesc.trim() || null : null,
        producto_informe: productoInforme.trim() || null,
        precio_informe: precioInforme.trim() || null,
      });
      setEstadoFotos('esperando');
      setParadaActual(null);
      setFotos([null, null, null, null, null]);
      setFotoIndex(0);
      setNota('');
      setAccionRequerida(false);
      setAccionDesc('');
      setProductoInforme('');
      setPrecioInforme('');
      await cargarDatos();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? 'No se pudo completar la parada. Probá de nuevo.');
    } finally {
      setProcesando(false);
      enviandoRef.current = false;
    }
  };

  if (!jornada) {
    return (
      <View style={styles.center}>
        <Text style={styles.sinJornada}>No hay jornada activa</Text>
        <Text style={styles.sinJornadaDesc}>Iniciá la jornada desde la pantalla de Inicio</Text>
      </View>
    );
  }

  if (cargando) return <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;

  const clientesRuta: Cliente[] = asignacion?.ruta?.clientes?.map((c: any) => c.cliente) ?? [];
  const paradasCompletadas = paradas.filter((p) => p.completada);

  return (
    <View style={styles.container}>
      {/* Panel de flujo de fotos */}
      {estadoFotos !== 'esperando' && paradaActual && (
        <View style={styles.fotoPanel}>
          <Text style={styles.fotoPanelCliente}>
            {paradaActual.cliente?.nombre ?? 'Cliente'}
          </Text>

          {estadoFotos === 'fotos' && (
            <>
              <Text style={styles.fotoPanelTitulo}>Foto {fotoIndex + 1} de {MAX_FOTOS}</Text>
              <Text style={styles.fotoPanelDesc}>Sacá una foto del cliente (opcional)</Text>
              {fotos[fotoIndex]
                ? (
                  <>
                    <Image source={{ uri: fotos[fotoIndex]! }} style={styles.fotoPreview} />
                    <TouchableOpacity style={styles.btnFotoRetomar} onPress={tomarFoto}>
                      <Text style={styles.btnFotoRetomarTexto}>🔄 Retomar foto</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.btnConfirmar}
                      onPress={() => {
                        if (fotoIndex < MAX_FOTOS - 1) setFotoIndex(fotoIndex + 1);
                        else setEstadoFotos('nota');
                      }}
                    >
                      <Text style={styles.btnTexto}>{fotoIndex < MAX_FOTOS - 1 ? 'Siguiente →' : 'Continuar →'}</Text>
                    </TouchableOpacity>
                  </>
                )
                : (
                  <>
                    <TouchableOpacity style={styles.btnFoto} onPress={tomarFoto}>
                      <Text style={styles.btnFotoIcono}>📷</Text>
                      <Text style={styles.btnFotoTexto}>Tomar Foto {fotoIndex + 1}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.btnSaltear}
                      onPress={() => {
                        if (fotoIndex < MAX_FOTOS - 1) setFotoIndex(fotoIndex + 1);
                        else setEstadoFotos('nota');
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
              {fotoIndex > 0 || fotos.some((f) => f) ? (
                <TouchableOpacity style={styles.btnSaltear} onPress={() => setEstadoFotos('nota')}>
                  <Text style={styles.btnSaltearTexto}>Terminar fotos e ir a la nota</Text>
                </TouchableOpacity>
              ) : null}
            </>
          )}

          {estadoFotos === 'nota' && (
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ gap: 10 }}>
              {fotos.some((f) => f) && (
                <View style={styles.fotosRow}>
                  {fotos.map((f, i) => f && <Image key={i} source={{ uri: f }} style={styles.fotoMini} />)}
                </View>
              )}
              {/* Informe de producto/precio */}
              <View style={styles.informeBox}>
                <Text style={styles.informeTitulo}>💰 Informe de precio (opcional)</Text>
                <Text style={styles.informeDesc}>Registrá qué producto compró y a qué precio</Text>
                <TextInput
                  style={styles.notaInput}
                  placeholder="Nombre del producto"
                  placeholderTextColor={COLORS.textLight}
                  value={productoInforme}
                  onChangeText={setProductoInforme}
                />
                <TextInput
                  style={[styles.notaInput, { marginTop: 8 }]}
                  placeholder="Precio (ej: $1500)"
                  placeholderTextColor={COLORS.textLight}
                  keyboardType="decimal-pad"
                  value={precioInforme}
                  onChangeText={setPrecioInforme}
                />
              </View>
              <TextInput
                style={[styles.notaInput, { minHeight: 60 }]}
                placeholder="Nota adicional (opcional)"
                placeholderTextColor={COLORS.textLight}
                multiline
                value={nota}
                onChangeText={setNota}
              />

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
                <View style={[styles.subFormAccion]}>
                  <Text style={styles.subLabel}>¿Qué acción tiene que hacer?</Text>
                  <TextInput
                    style={[styles.notaInput, { minHeight: 60 }]}
                    placeholder="Ej: contactar al cliente, revisar precio, gestionar pedido..."
                    placeholderTextColor={COLORS.textLight}
                    value={accionDesc}
                    onChangeText={setAccionDesc}
                    multiline
                  />
                </View>
              )}

              <TouchableOpacity style={styles.btnConfirmar} onPress={confirmarParada} disabled={procesando}>
                {procesando
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnTexto}>Confirmar parada ✓</Text>}
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      )}

      {/* Lista de paradas del día */}
      {estadoFotos === 'esperando' && (
        <>
          <View style={styles.header}>
            <Text style={styles.headerTitulo}>Paradas del día</Text>
            <Text style={styles.headerCount}>{paradasCompletadas.length} completadas</Text>
          </View>

          <TouchableOpacity style={styles.btnNuevaParada} onPress={() => setClientesModal(true)} disabled={procesando}>
            {procesando
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnTexto}>+ Registrar llegada a cliente</Text>}
          </TouchableOpacity>

          <FlatList
            data={paradasCompletadas}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            renderItem={({ item }) => (
              <View style={styles.paradaCard}>
                <View style={styles.paradaHeader}>
                  <Text style={styles.paradaNombre}>{item.cliente?.nombre ?? 'Sin cliente'}</Text>
                  <Text style={styles.paradaHora}>{format(new Date(item.timestamp_llegada), 'HH:mm')}</Text>
                </View>
                <Text style={styles.paradaDireccion}>{item.cliente?.direccion}</Text>
                <View style={styles.fotosRow}>
                  {item.foto1_uri && <Image source={{ uri: urlFoto(item.foto1_uri) }} style={styles.fotoMini} />}
                  {item.foto2_uri && <Image source={{ uri: urlFoto(item.foto2_uri) }} style={styles.fotoMini} />}
                  {item.foto3_uri && <Image source={{ uri: urlFoto(item.foto3_uri) }} style={styles.fotoMini} />}
                  {item.foto4_uri && <Image source={{ uri: urlFoto(item.foto4_uri) }} style={styles.fotoMini} />}
                  {item.foto5_uri && <Image source={{ uri: urlFoto(item.foto5_uri) }} style={styles.fotoMini} />}
                </View>
                {item.nota ? <Text style={styles.paradaNota}>📝 {item.nota}</Text> : null}
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.sinParadas}>No hay paradas registradas hoy</Text>
            }
          />
        </>
      )}

      {/* Modal selección de cliente */}
      <Modal visible={clientesModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitulo}>Seleccionar cliente</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity style={styles.btnNuevoCliente} onPress={() => {
                setClientesModal(false);
                setNuevoClienteVisible(true);
              }}>
                <Text style={styles.btnNuevoClienteTexto}>+ Nuevo cliente</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setClientesModal(false)}>
                <Text style={styles.modalCerrar}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
          <FlatList
            data={clientesRuta}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ padding: 16, gap: 10 }}
            renderItem={({ item }) => {
              const yaVisitado = paradas.some((p) => p.cliente_id === item.id && p.completada);
              return (
                <View style={styles.clienteRow}>
                  <TouchableOpacity
                    style={[styles.clienteItem, yaVisitado && styles.clienteItemVisitado]}
                    onPress={() => iniciarParadaEnCliente(item)}
                    disabled={yaVisitado}
                  >
                    <Text style={styles.clienteNombre}>{item.nombre}</Text>
                    <Text style={styles.clienteDireccion}>{item.direccion}</Text>
                    {yaVisitado && <Text style={styles.clienteVisitado}>✓ Visitado</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btnCartilla} onPress={() => {
                    setClientesModal(false);
                    setClienteCartilla(item);
                  }}>
                    <Text style={styles.btnCartillaIcono}>📋</Text>
                    <Text style={styles.btnCartillaTexto}>Cartilla</Text>
                  </TouchableOpacity>
                </View>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.sinParadas}>No hay clientes en la ruta de hoy</Text>
            }
          />
        </View>
      </Modal>

      <CartillaModal
        cliente={clienteCartilla}
        visible={!!clienteCartilla}
        color={COLORS.repartidor}
        onClose={() => {
          setClienteCartilla(null);
          setTimeout(() => setClientesModal(true), 350);
        }}
        onGuardado={cargarDatos}
        onEliminado={cargarDatos}
      />

      <NuevoClienteModal
        visible={nuevoClienteVisible}
        color={COLORS.repartidor}
        onClose={() => {
          setNuevoClienteVisible(false);
          setTimeout(() => setClientesModal(true), 350);
        }}
        onCreado={cargarDatos}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  sinJornada: { fontSize: 18, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  sinJornadaDesc: { fontSize: 14, color: COLORS.textLight, textAlign: 'center', marginTop: 8 },

  fotoPanel: {
    backgroundColor: COLORS.card,
    margin: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
    gap: 12,
  },
  fotoPanelCliente: { fontSize: 13, color: COLORS.textLight, fontWeight: '600' },
  fotoPanelTitulo: { fontSize: 20, fontWeight: '800', color: COLORS.primary },
  fotoPanelDesc: { fontSize: 14, color: COLORS.textLight },
  fotoPreview: { width: '100%', height: 200, borderRadius: 10 },
  fotosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fotoMini: { width: 70, height: 70, borderRadius: 8 },
  btnFoto: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  btnFotoIcono: { fontSize: 40 },
  btnFotoTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },
  btnFotoRetomar: { alignItems: 'center', paddingVertical: 8 },
  btnFotoRetomarTexto: { color: COLORS.textLight, fontSize: 13 },
  btnSaltear: { alignItems: 'center', paddingVertical: 10 },
  btnSaltearTexto: { color: COLORS.textLight, fontSize: 13, textDecorationLine: 'underline' },
  notaInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: COLORS.background,
  },
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    gap: 10,
  },
  toggleRowAccion: { borderColor: COLORS.secondary, backgroundColor: '#EFF6FF' },
  toggleEmoji: { fontSize: 22 },
  toggleLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.text },
  toggleBubble: {
    backgroundColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  toggleBubbleAccion: { backgroundColor: COLORS.secondary },
  toggleBubbleTexto: { fontSize: 11, fontWeight: '800', color: '#fff' },
  subLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textLight, textTransform: 'uppercase' },
  subFormAccion: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.secondary,
  },
  btnConfirmar: {
    backgroundColor: COLORS.success,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
  },
  headerTitulo: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  headerCount: { fontSize: 13, color: COLORS.textLight },
  btnNuevaParada: {
    backgroundColor: COLORS.repartidor,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 4,
  },
  btnTexto: { color: '#fff', fontWeight: '700', fontSize: 15 },

  paradaCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.success,
  },
  paradaHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  paradaNombre: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  paradaHora: { fontSize: 13, color: COLORS.textLight },
  paradaDireccion: { fontSize: 13, color: COLORS.textLight },
  paradaNota: { fontSize: 13, color: COLORS.text, fontStyle: 'italic' },
  sinParadas: { textAlign: 'center', color: COLORS.textLight, marginTop: 40, fontSize: 14 },

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
  btnNuevoCliente: {
    backgroundColor: COLORS.repartidor,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  btnNuevoClienteTexto: { color: '#fff', fontWeight: '700', fontSize: 12 },
  clienteRow: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  clienteItem: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.repartidor,
  },
  clienteItemVisitado: { borderLeftColor: COLORS.success, opacity: 0.6 },
  btnCartilla: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  btnCartillaIcono: { fontSize: 18 },
  btnCartillaTexto: { fontSize: 11, fontWeight: '700', color: COLORS.textLight },
  clienteNombre: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  clienteDireccion: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
  clienteVisitado: { fontSize: 12, color: COLORS.success, fontWeight: '600', marginTop: 4 },
});
