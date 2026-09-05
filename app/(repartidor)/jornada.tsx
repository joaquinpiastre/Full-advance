import { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ScrollView, ActivityIndicator, Image, TextInput, FlatList, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useJornadaStore } from '../../store/jornadaStore';
import { registrarParada, obtenerParadas, obtenerAsignacionHoy, obtenerRuta, actualizarOrdenRuta } from '../../services/api';
import { obtenerUbicacionRapida } from '../../services/gps';
import {
  agregarVisitaPendiente, obtenerVisitasPendientes,
  procesarVisitasPendientes, suscribirVisitasPendientes, VisitaPendiente,
} from '../../services/offlineVisitas';
import {
  encolarAccion, obtenerAccionesPendientes,
  procesarAccionesPendientes, suscribirAccionesPendientes, AccionPendiente,
} from '../../services/offlineAcciones';
import CartillaModal from '../../components/CartillaModal';
import NuevoClienteModal from '../../components/NuevoClienteModal';
import FotoReferenciaCliente from '../../components/FotoReferenciaCliente';
import AccionesList from '../../components/AccionesList';
import { COLORS } from '../../constants';
import { coincideBusqueda } from '../../utils/busqueda';
import { Parada, Cliente } from '../../types';

type EstadoFotos = 'esperando' | 'visita';

export default function JornadaRepartidor() {
  const { jornada, paradaActual, setParadaActual } = useJornadaStore();
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [ruta, setRuta] = useState<any>(null);
  const [clientesRuta, setClientesRuta] = useState<any[]>([]);
  const [accionesPendientes, setAccionesPendientes] = useState<AccionPendiente[]>([]);
  const [busquedaClientes, setBusquedaClientes] = useState('');
  const [cargando, setCargando] = useState(true);
  const [estadoFotos, setEstadoFotos] = useState<EstadoFotos>('esperando');
  const [fotos, setFotos] = useState<(string | null)[]>([null, null, null, null, null]);
  const [nota, setNota] = useState('');
  const [incidente, setIncidente] = useState(false);
  const [incidenteDesc, setIncidenteDesc] = useState('');
  const [accionRequerida, setAccionRequerida] = useState(false);
  const [accionDesc, setAccionDesc] = useState<string[]>(['']);
  const [oportunidades, setOportunidades] = useState<string[]>(['']);
  const [procesando, setProcesando] = useState(false);
  const [clienteCartilla, setClienteCartilla] = useState<Cliente | null>(null);
  const [nuevoClienteVisible, setNuevoClienteVisible] = useState(false);
  const [pendientes, setPendientes] = useState<VisitaPendiente[]>([]);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  // Web drag state (unused on native) — declarado acá arriba, antes de
  // cualquier return condicional, para no violar las Reglas de los Hooks
  // (React necesita llamar la misma cantidad de hooks en cada render).
  const [dragSrcIdx, setDragSrcIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const enviandoRef = useRef(false);

  // Memoizados: NuevoClienteModal recarga zonas cuando cambian sus props, así
  // que pasarle arrays nuevos en cada render lo haría pedir datos en bucle.
  const rutasParaModal = useMemo(
    () => (ruta ? [{ id: ruta.id, nombre: ruta.nombre }] : []),
    [ruta?.id, ruta?.nombre]
  );
  const idsClientesRuta = useMemo(
    () => clientesRuta.map((rc: any) => rc.cliente.id),
    [clientesRuta]
  );

  useEffect(() => {
    if (jornada) cargarDatos();
  }, [jornada]);

  useEffect(() => {
    if (!jornada) return;
    const cargarPendientes = () => obtenerVisitasPendientes(jornada.id).then(setPendientes);
    cargarPendientes();
    return suscribirVisitasPendientes(cargarPendientes);
  }, [jornada]);

  // Cuando la cola de acciones offline termina de vaciarse, refrescamos la ruta
  // en silencio: así los clientes creados sin señal (id temporal negativo)
  // pasan a mostrarse con su id real y se pueden visitar.
  useEffect(() => {
    let anteriores = 0;
    const cargarPendientes = async () => {
      const lista = await obtenerAccionesPendientes();
      setAccionesPendientes(lista);
      if (anteriores > 0 && lista.length === 0) cargarDatosRef.current?.(true);
      anteriores = lista.length;
    };
    cargarPendientes();
    return suscribirAccionesPendientes(cargarPendientes);
  }, []);

  // La ruta de "Mi Ruta" es la que quedó fijada en la jornada al iniciarla
  // (jornada.ruta_id) — no se recalcula en vivo mientras la jornada está
  // activa. Fallback a /asignaciones/hoy solo para jornadas activas que se
  // iniciaron antes de este cambio (sin ruta_id todavía).
  // `silencioso` recarga sin mostrar el spinner de pantalla completa ni pisar
  // la pantalla con un error: se usa cuando la cola offline termina de
  // sincronizar y solo hace falta refrescar los datos.
  const cargarDatos = async (silencioso = false) => {
    if (!jornada) return;
    if (!silencioso) {
      setCargando(true);
      setErrorCarga(null);
    }
    try {
      const paradasRes = await obtenerParadas(jornada.id).catch(() => null);
      if (paradasRes) setParadas(paradasRes.data);

      if (jornada.ruta_id) {
        const rutaRes = await obtenerRuta(jornada.ruta_id);
        setRuta(rutaRes.data);
        setClientesRuta(rutaRes.data.clientes ?? []);
      } else {
        const asigRes = await obtenerAsignacionHoy();
        const data = asigRes.data;
        if (data.necesita_eleccion && !data.ruta) {
          if (!silencioso) setErrorCarga('No tenés una ruta seleccionada. Volvé al Inicio y elegí tu ruta antes de empezar.');
          setCargando(false);
          return;
        }
        setRuta(data.ruta ?? null);
        setClientesRuta(data.ruta?.clientes ?? []);
      }
      setErrorCarga(null);
    } catch (e: any) {
      if (!silencioso) {
        setErrorCarga(e?.response?.data?.error ?? 'Error al cargar los datos. Verificá tu conexión.');
      }
    }
    setCargando(false);
  };

  // Siempre apunta a la última versión de cargarDatos, para poder llamarla
  // desde efectos que se montan una sola vez.
  const cargarDatosRef = useRef<((silencioso?: boolean) => void) | null>(null);
  cargarDatosRef.current = cargarDatos;

  const iniciarParadaEnCliente = async (cliente: Cliente) => {
    if (!jornada) return;
    if (cliente.id < 0) {
      Alert.alert('Cliente sin sincronizar', 'Este cliente se agregó sin conexión y todavía no se sincronizó. Esperá a que haya señal e intentá de nuevo.');
      return;
    }
    setProcesando(true);
    try {
      // Si ya existe una parada sin completar para este cliente (quedó "trabada"
      // por un corte de conexión), la retomamos en lugar de crear otra.
      let parada: Parada | null = paradas.find((p) => p.cliente_id === cliente.id && !p.completada) ?? null;
      if (!parada) {
        // Intentamos obtener la ubicación; si falla o tarda (GPS apagado, sin
        // permisos, web sin geolocalización) seguimos con (0,0) sin trabar.
        const { lat, lng } = await obtenerUbicacionRapida();

        try {
          const res = await registrarParada({ jornada_id: jornada.id, lat, lng, cliente_id: cliente.id });
          parada = res.data;
        } catch (e: any) {
          if (e?.response) throw e;
          // Sin conexión: seguimos offline, la parada se registrará al sincronizar.
          parada = {
            id: -Date.now(),
            jornada_id: jornada.id,
            cliente_id: cliente.id,
            lat, lng,
            timestamp_llegada: new Date().toISOString(),
            completada: false,
            cliente,
          } as Parada;
        }
      }
      setParadaActual(parada);
      setEstadoFotos('visita');
      setFotos([null, null, null, null, null]);
      setNota('');
      setIncidente(false);
      setIncidenteDesc('');
      setAccionRequerida(false);
      setAccionDesc(['']);
      setOportunidades(['']);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? 'No se pudo registrar la parada');
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
      const fotosPendientes = fotos
        .map((uri, i) => (uri ? { numero: i + 1, uri } : null))
        .filter((f): f is { numero: number; uri: string } => f !== null);

      await agregarVisitaPendiente({
        jornada_id: jornada!.id,
        cliente_id: paradaActual.cliente_id ?? paradaActual.cliente?.id ?? 0,
        cliente_nombre: paradaActual.cliente?.nombre,
        cliente_direccion: paradaActual.cliente?.direccion,
        lat: paradaActual.lat,
        lng: paradaActual.lng,
        parada_id: paradaActual.id > 0 ? paradaActual.id : undefined,
        fotos: fotosPendientes,
        finalizar: {
          nota: nota.trim() || undefined,
          urgente: incidente,
          urgencia_descripcion: incidente ? incidenteDesc.trim() || null : null,
          accion_requerida: accionRequerida ? accionDesc.map((a) => a.trim()).filter(Boolean).join('\n') || null : null,
          oportunidades: oportunidades.map((o) => o.trim()).filter(Boolean).join('\n') || null,
        },
      });

      setEstadoFotos('esperando');
      setParadaActual(null);
      setFotos([null, null, null, null, null]);
      setNota('');
      setIncidente(false);
      setIncidenteDesc('');
      setAccionRequerida(false);
      setAccionDesc(['']);
      setOportunidades(['']);

      procesarVisitasPendientes().then(() => { cargarDatos(); });
    } catch {
      Alert.alert('Error', 'No se pudo guardar la visita. Probá de nuevo.');
    } finally {
      setProcesando(false);
      enviandoRef.current = false;
    }
  };

  // Se agrega localmente al toque (funciona online y offline) — evita
  // depender de un refetch que fallaría si no hay conexión.
  const handleClienteAgregado = (cliente: Cliente) => {
    setClientesRuta((prev) => {
      if (prev.some((rc: any) => rc.cliente.id === cliente.id)) return prev;
      return [...prev, { id: cliente.id, cliente_id: cliente.id, ruta_id: ruta?.id ?? 0, orden: prev.length + 1, cliente }];
    });
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

  if (errorCarga) return (
    <View style={styles.center}>
      <Text style={{ fontSize: 40, marginBottom: 16 }}>⚠️</Text>
      <Text style={{ textAlign: 'center', color: COLORS.textMuted, fontSize: 15, paddingHorizontal: 32, marginBottom: 24 }}>
        {errorCarga}
      </Text>
      <TouchableOpacity
        style={{ backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
        onPress={() => cargarDatos()}
      >
        <Text style={{ color: '#fff', fontWeight: '700' }}>Reintentar</Text>
      </TouchableOpacity>
    </View>
  );

  const paradasCompletadas = paradas.filter((p) => p.completada);

  const handleReordenar = (nuevos: any[]) => {
    if (busquedaClientes.trim()) return; // no reorder while filtered
    setClientesRuta(nuevos);
    if (!ruta) return;
    const clientesIds = nuevos.map((c: any) => c.cliente.id);
    actualizarOrdenRuta(ruta.id, clientesIds).catch((e: any) => {
      if (!e?.response) {
        // Sin conexión: se guarda igual y se sincroniza cuando vuelva la señal.
        encolarAccion({ tipo: 'reordenar_ruta', payload: { ruta_id: ruta.id, clientes: clientesIds } });
      }
    });
  };

  const webDrop = (toIndex: number) => {
    if (dragSrcIdx !== null && dragSrcIdx !== toIndex) {
      const nuevos = [...clientesRuta];
      const [moved] = nuevos.splice(dragSrcIdx, 1);
      nuevos.splice(toIndex, 0, moved);
      handleReordenar(nuevos);
    }
    setDragSrcIdx(null);
    setDragOverIdx(null);
  };

  const clientesRutaFiltrados = busquedaClientes.trim()
    ? clientesRuta.filter((rc) =>
        coincideBusqueda(busquedaClientes, rc.cliente.nombre, rc.cliente.direccion, rc.cliente.rubro, rc.cliente.razon_social)
      )
    : clientesRuta;

  const renderFilaCliente = (item: any, index: number) => {
    const cliente = item.cliente;
    const visitado = paradas.some((p) => p.cliente_id === cliente.id && p.completada)
      || pendientes.some((p) => p.cliente_id === cliente.id);
    return (
      <View
        style={[
          styles.clienteCard,
          ...(Platform.OS === 'web' ? [
            dragSrcIdx === index && { opacity: 0.4 },
            dragOverIdx === index && styles.clienteCardDragOver,
          ] : []),
        ]}
        {...(Platform.OS === 'web' ? ({
          onDragOver: (e: any) => { e.preventDefault(); setDragOverIdx(index); },
          onDrop: (e: any) => { e.preventDefault(); webDrop(index); },
          onDragLeave: () => { if (dragOverIdx === index) setDragOverIdx(null); },
        } as any) : {})}
      >
        <View style={styles.clienteOrden}>
          <Text style={styles.clienteOrdenNum}>{index + 1}</Text>
        </View>
        {Platform.OS === 'web' && !busquedaClientes.trim() && (
          <View
            style={styles.asaWeb}
            {...({ draggable: true, onDragStart: () => setDragSrcIdx(index), onDragEnd: () => { setDragSrcIdx(null); setDragOverIdx(null); } } as any)}
          >
            <Text style={styles.asaTexto}>☰</Text>
          </View>
        )}
        <View style={styles.clienteInfo}>
          <Text style={styles.clienteNombre}>{cliente.nombre}{cliente.id < 0 ? ' ⏳' : ''}</Text>
          <Text style={styles.clienteDireccion}>{cliente.direccion}</Text>
        </View>
        <View style={styles.botonesCard}>
          {visitado ? (
            <Text style={styles.visitadoCheck}>✓</Text>
          ) : (
            <TouchableOpacity
              style={[styles.btnVisitar, procesando && { opacity: 0.5 }]}
              onPress={() => iniciarParadaEnCliente(cliente)}
              disabled={procesando}
            >
              <Text style={styles.btnVisitarTexto}>Visitar</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.btnCartilla} onPress={() => setClienteCartilla(cliente)}>
            <Text style={styles.btnCartillaIcono}>📋</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Panel de flujo de fotos */}
      {estadoFotos !== 'esperando' && paradaActual && (
        <View style={styles.fotoPanel}>
          <View style={styles.fotoPanelHeader}>
            {paradaActual.cliente && (
              <FotoReferenciaCliente
                cliente={paradaActual.cliente}
                color={COLORS.repartidor}
                onActualizado={(uri) => {
                  const cliente = paradaActual.cliente;
                  if (!cliente) return;
                  setParadaActual({
                    ...paradaActual,
                    cliente: { ...cliente, foto_referencia_uri: uri },
                  });
                }}
              />
            )}
            <Text style={styles.fotoPanelCliente}>
              {paradaActual.cliente?.nombre ?? 'Cliente'}
            </Text>
          </View>

          {estadoFotos === 'visita' && (
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ gap: 10 }}>
              <Text style={styles.fotoPanelTitulo}>Fotos (opcional)</Text>
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

              {/* Oportunidades */}
              <View style={styles.informeBox}>
                <Text style={styles.informeTitulo}>💡 Oportunidades</Text>
                <Text style={styles.informeDesc}>Registrá oportunidades de venta u otras observaciones</Text>
                <AccionesList
                  acciones={oportunidades}
                  onChange={setOportunidades}
                  label=""
                  placeholder="Ej: cliente interesado en nueva línea de productos..."
                  agregarTexto="+ Agregar oportunidad"
                  color="#1D4ED8"
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

              {/* Toggle: Incidente */}
              <TouchableOpacity
                style={[styles.toggleRow, incidente && styles.toggleRowIncidente]}
                onPress={() => setIncidente((v) => !v)}
                activeOpacity={0.7}
              >
                <Text style={styles.toggleEmoji}>⚠️</Text>
                <Text style={[styles.toggleLabel, incidente && { color: COLORS.danger, fontWeight: '700' }]}>
                  Incidente
                </Text>
                <View style={[styles.toggleBubble, incidente && styles.toggleBubbleIncidente]}>
                  <Text style={styles.toggleBubbleTexto}>{incidente ? 'SÍ' : 'NO'}</Text>
                </View>
              </TouchableOpacity>

              {incidente && (
                <View style={styles.subFormIncidente}>
                  <Text style={styles.subLabel}>¿Qué pasó?</Text>
                  <TextInput
                    style={[styles.notaInput, { minHeight: 70 }]}
                    placeholder="Describí el incidente..."
                    placeholderTextColor={COLORS.textLight}
                    multiline
                    value={incidenteDesc}
                    onChangeText={setIncidenteDesc}
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
                  Acciones
                </Text>
                <View style={[styles.toggleBubble, accionRequerida && styles.toggleBubbleAccion]}>
                  <Text style={styles.toggleBubbleTexto}>{accionRequerida ? 'SÍ' : 'NO'}</Text>
                </View>
              </TouchableOpacity>

              {accionRequerida && (
                <View style={[styles.subFormAccion]}>
                  <AccionesList acciones={accionDesc} onChange={setAccionDesc} />
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

      {/* Lista de clientes de la ruta */}
      {estadoFotos === 'esperando' && (
        <View style={{ flex: 1 }}>
          <View style={styles.resumen}>
            {pendientes.length > 0 && (
              <View style={styles.pendientesBanner}>
                <Text style={styles.pendientesTexto}>
                  ⏳ {pendientes.length} visita{pendientes.length > 1 ? 's' : ''} pendiente{pendientes.length > 1 ? 's' : ''} de enviar — se enviarán solas cuando haya internet
                </Text>
              </View>
            )}
            {accionesPendientes.length > 0 && (
              <View style={styles.pendientesBanner}>
                <Text style={styles.pendientesTexto}>
                  ⏳ {accionesPendientes.length} cambio{accionesPendientes.length > 1 ? 's' : ''} de ruta pendiente{accionesPendientes.length > 1 ? 's' : ''} de sincronizar
                </Text>
              </View>
            )}
            <View style={styles.resumenHeader}>
              <Text style={styles.resumenTexto}>
                {paradasCompletadas.length + pendientes.length} / {clientesRuta.length} clientes visitados
              </Text>
              <TouchableOpacity style={styles.btnNuevoCliente} onPress={() => setNuevoClienteVisible(true)}>
                <Text style={styles.btnNuevoClienteTexto}>+ Agregar cliente</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.barra}>
              <View style={[
                styles.barraFill,
                { width: clientesRuta.length ? `${((paradasCompletadas.length + pendientes.length) / clientesRuta.length) * 100}%` : '0%' }
              ]} />
            </View>
          </View>

          <View style={styles.buscadorCont}>
            <TextInput
              style={styles.buscadorInput}
              placeholder="Buscar cliente..."
              placeholderTextColor={COLORS.textLight}
              value={busquedaClientes}
              onChangeText={setBusquedaClientes}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
          </View>

          <FlatList
            style={{ flex: 1 }}
            data={clientesRutaFiltrados}
            keyExtractor={(item: any) => String(item.cliente.id)}
            contentContainerStyle={{ padding: 16, gap: 10 }}
            renderItem={({ item, index }) => renderFilaCliente(item, index)}
            ListEmptyComponent={
              <Text style={styles.sinParadas}>No hay clientes en la ruta de hoy</Text>
            }
          />
        </View>
      )}

      <CartillaModal
        cliente={clienteCartilla}
        visible={!!clienteCartilla}
        color={COLORS.repartidor}
        onClose={() => setClienteCartilla(null)}
        onGuardado={() => cargarDatos()}
        onEliminado={() => cargarDatos()}
      />

      <NuevoClienteModal
        visible={nuevoClienteVisible}
        color={COLORS.repartidor}
        rutas={rutasParaModal}
        clientesEnRuta={idsClientesRuta}
        onClose={() => setNuevoClienteVisible(false)}
        onCreado={handleClienteAgregado}
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
    flex: 1,
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
  fotoPanelHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fotoPanelCliente: { fontSize: 13, color: COLORS.textLight, fontWeight: '600' },
  fotoPanelTitulo: { fontSize: 20, fontWeight: '800', color: COLORS.primary },
  fotoPanelDesc: { fontSize: 14, color: COLORS.textLight },
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
  toggleRowIncidente: { borderColor: COLORS.danger, backgroundColor: '#FEF2F2' },
  toggleEmoji: { fontSize: 22 },
  toggleLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.text },
  toggleBubble: {
    backgroundColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  toggleBubbleAccion: { backgroundColor: COLORS.secondary },
  toggleBubbleIncidente: { backgroundColor: COLORS.danger },
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
  subFormIncidente: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  btnConfirmar: {
    backgroundColor: COLORS.success,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },

  pendientesBanner: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 10,
    padding: 10,
  },
  pendientesTexto: { fontSize: 12, color: '#92400E', fontWeight: '600' },
  btnTexto: { color: '#fff', fontWeight: '700', fontSize: 15 },

  sinParadas: { textAlign: 'center', color: COLORS.textLight, marginTop: 40, fontSize: 14 },

  resumen: {
    backgroundColor: COLORS.card,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  resumenHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  resumenTexto: { fontSize: 14, color: COLORS.text, fontWeight: '600' },
  barra: { height: 8, backgroundColor: COLORS.border, borderRadius: 4 },
  barraFill: { height: 8, backgroundColor: COLORS.repartidor, borderRadius: 4 },
  btnNuevoCliente: {
    backgroundColor: COLORS.repartidor,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  btnNuevoClienteTexto: { color: '#fff', fontWeight: '700', fontSize: 12 },
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
    borderLeftColor: COLORS.repartidor,
  },
  clienteCardDragOver: {
    borderTopWidth: 3,
    borderTopColor: COLORS.primary,
  },
  clienteOrden: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.repartidor,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clienteOrdenNum: { color: '#fff', fontWeight: '700', fontSize: 13 },
  asaTexto: { fontSize: 18, color: COLORS.textLight },
  asaWeb: {
    width: 34, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
    cursor: 'grab',
  } as any,
  clienteInfo: { flex: 1 },
  clienteNombre: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  clienteDireccion: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  botonesCard: { flexDirection: 'column', alignItems: 'center', gap: 6 },
  visitadoCheck: { fontSize: 22, color: COLORS.success, fontWeight: '700' },
  btnVisitar: {
    backgroundColor: COLORS.repartidor,
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
});
