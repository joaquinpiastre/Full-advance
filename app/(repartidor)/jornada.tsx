import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ScrollView, ActivityIndicator, Image, TextInput, Modal, FlatList, Platform,
} from 'react-native';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useJornadaStore } from '../../store/jornadaStore';
import { registrarParada, obtenerParadas, obtenerAsignacionHoy, obtenerJornadaActiva, actualizarOrdenRuta } from '../../services/api';
import { obtenerUbicacionRapida, detenerGps } from '../../services/gps';
import {
  agregarVisitaPendiente, obtenerVisitasPendientes,
  procesarVisitasPendientes, suscribirVisitasPendientes, VisitaPendiente,
} from '../../services/offlineVisitas';
import CartillaModal from '../../components/CartillaModal';
import NuevoClienteModal from '../../components/NuevoClienteModal';
import FotoReferenciaCliente from '../../components/FotoReferenciaCliente';
import AccionesList from '../../components/AccionesList';
import { COLORS, urlFoto } from '../../constants';
import { coincideBusqueda } from '../../utils/busqueda';
import { Parada, Cliente } from '../../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type EstadoFotos = 'esperando' | 'visita';

export default function JornadaRepartidor() {
  const { jornada, paradaActual, setParadaActual, setJornada } = useJornadaStore();
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [asignacion, setAsignacion] = useState<any>(null);
  const [clientesRuta, setClientesRuta] = useState<any[]>([]);
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
  const [clientesModal, setClientesModal] = useState(false);
  const [clienteCartilla, setClienteCartilla] = useState<Cliente | null>(null);
  const [nuevoClienteVisible, setNuevoClienteVisible] = useState(false);
  const [pendientes, setPendientes] = useState<VisitaPendiente[]>([]);
  const enviandoRef = useRef(false);

  useEffect(() => {
    if (jornada) cargarDatos();
  }, [jornada]);

  useEffect(() => {
    if (!jornada) return;
    const cargarPendientes = () => obtenerVisitasPendientes(jornada.id).then(setPendientes);
    cargarPendientes();
    return suscribirVisitasPendientes(cargarPendientes);
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
      if (asigRes.status === 'fulfilled') {
        const data = asigRes.value.data;
        setAsignacion(data);
        // Merge clients from all selected routes, deduplicating by client id
        const seen = new Set<number>();
        const merged: any[] = [];
        for (const r of (data.rutas ?? [])) {
          for (const rc of (r.clientes ?? [])) {
            if (!seen.has(rc.cliente.id)) {
              seen.add(rc.cliente.id);
              merged.push({ ...rc, ruta_id: r.id });
            }
          }
        }
        setClientesRuta(merged);
      }
    } catch {}
    setCargando(false);
  };

  const iniciarParadaEnCliente = async (cliente: Cliente) => {
    if (!jornada) return;
    setClientesModal(false);
    setBusquedaClientes('');
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

      procesarVisitasPendientes().then(() => { cargarDatos(); verificarJornadaCerrada(); });
    } catch {
      Alert.alert('Error', 'No se pudo guardar la visita. Probá de nuevo.');
    } finally {
      setProcesando(false);
      enviandoRef.current = false;
    }
  };

  // Si al sincronizar la visita el backend cerró la jornada automáticamente
  // (porque ya se visitaron todos los clientes de la ruta), refleja eso en
  // la app: corta el GPS y vuelve a Inicio.
  const verificarJornadaCerrada = async () => {
    try {
      const res = await obtenerJornadaActiva();
      if (!res.data) {
        await detenerGps();
        setJornada(null);
        Alert.alert('Jornada finalizada', 'Completaste todas las visitas de la ruta. La jornada se cerró automáticamente.');
        router.replace('/(repartidor)');
      }
    } catch {}
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

  const paradasCompletadas = paradas.filter((p) => p.completada);

  const handleReordenar = (nuevos: any[]) => {
    if (busquedaClientes.trim()) return; // no reorder while filtered
    setClientesRuta(nuevos);
    const rutas: any[] = asignacion?.rutas ?? [];
    if (rutas.length === 1) {
      actualizarOrdenRuta(rutas[0].id, nuevos.map((c: any) => c.cliente.id)).catch(() => {});
    }
  };

  // Web drag state (unused on native)
  const [dragSrcIdx, setDragSrcIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

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

      {/* Lista de paradas del día */}
      {estadoFotos === 'esperando' && (
        <>
          <View style={styles.header}>
            <Text style={styles.headerTitulo}>Paradas del día</Text>
            <Text style={styles.headerCount}>{paradasCompletadas.length + pendientes.length} completadas</Text>
          </View>

          {pendientes.length > 0 && (
            <View style={styles.pendientesBanner}>
              <Text style={styles.pendientesTexto}>
                ⏳ {pendientes.length} visita{pendientes.length > 1 ? 's' : ''} pendiente{pendientes.length > 1 ? 's' : ''} de enviar — se enviarán solas cuando haya internet
              </Text>
            </View>
          )}

          <TouchableOpacity style={styles.btnNuevaParada} onPress={() => setClientesModal(true)} disabled={procesando}>
            {procesando
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnTexto}>+ Registrar llegada a cliente</Text>}
          </TouchableOpacity>

          <FlatList
            style={{ flex: 1 }}
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
                setBusquedaClientes('');
                setNuevoClienteVisible(true);
              }}>
                <Text style={styles.btnNuevoClienteTexto}>+ Nuevo cliente</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setClientesModal(false); setBusquedaClientes(''); }}>
                <Text style={styles.modalCerrar}>✕</Text>
              </TouchableOpacity>
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
          {Platform.OS === 'web' ? (
            <FlatList
              style={{ flex: 1 }}
              data={clientesRutaFiltrados}
              keyExtractor={(item: any) => String(item.cliente.id)}
              contentContainerStyle={{ padding: 16, gap: 10 }}
              renderItem={({ item, index }) => {
                const cliente = item.cliente;
                const yaVisitado = paradas.some((p) => p.cliente_id === cliente.id && p.completada)
                  || pendientes.some((p) => p.cliente_id === cliente.id);
                return (
                  // @ts-ignore — RNW passes drag events to the underlying div
                  <View
                    style={[
                      styles.clienteRow,
                      dragSrcIdx === index && { opacity: 0.4 },
                      dragOverIdx === index && styles.clienteRowDragOver,
                    ]}
                    onDragOver={(e: any) => { e.preventDefault(); setDragOverIdx(index); }}
                    onDrop={(e: any) => { e.preventDefault(); webDrop(index); }}
                    onDragLeave={() => { if (dragOverIdx === index) setDragOverIdx(null); }}
                  >
                    {!busquedaClientes.trim() && (
                      // @ts-ignore
                      <View
                        style={styles.asaWeb}
                        draggable
                        onDragStart={() => setDragSrcIdx(index)}
                        onDragEnd={() => { setDragSrcIdx(null); setDragOverIdx(null); }}
                      >
                        <Text style={styles.asaTexto}>☰</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={[styles.clienteItem, yaVisitado && styles.clienteItemVisitado]}
                      onPress={() => iniciarParadaEnCliente(cliente)}
                      disabled={yaVisitado}
                    >
                      <Text style={styles.clienteNombre}>{index + 1}. {cliente.nombre}</Text>
                      <Text style={styles.clienteDireccion}>{cliente.direccion}</Text>
                      {yaVisitado && <Text style={styles.clienteVisitado}>✓ Visitado</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnCartilla} onPress={() => {
                      setClientesModal(false);
                      setClienteCartilla(cliente);
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
          ) : (
            <DraggableFlatList
              style={{ flex: 1 }}
              data={clientesRutaFiltrados}
              keyExtractor={(item: any) => String(item.cliente.id)}
              contentContainerStyle={{ padding: 16, gap: 10 }}
              onDragEnd={({ data }) => handleReordenar(data)}
              renderItem={({ item, getIndex, drag, isActive }: RenderItemParams<any>) => {
                const index = getIndex() ?? 0;
                const cliente = item.cliente;
                const yaVisitado = paradas.some((p) => p.cliente_id === cliente.id && p.completada)
                  || pendientes.some((p) => p.cliente_id === cliente.id);
                return (
                  <View style={[styles.clienteRow, isActive && styles.clienteRowActiva]}>
                    {!busquedaClientes.trim() && (
                      <TouchableOpacity onPressIn={drag} style={styles.asa}>
                        <Text selectable={false} style={styles.asaTexto}>☰</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.clienteItem, yaVisitado && styles.clienteItemVisitado]}
                      onPress={() => iniciarParadaEnCliente(cliente)}
                      disabled={yaVisitado}
                    >
                      <Text style={styles.clienteNombre}>{index + 1}. {cliente.nombre}</Text>
                      <Text style={styles.clienteDireccion}>{cliente.direccion}</Text>
                      {yaVisitado && <Text style={styles.clienteVisitado}>✓ Visitado</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnCartilla} onPress={() => {
                      setClientesModal(false);
                      setClienteCartilla(cliente);
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
          )}
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
  fotosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
  },
  headerTitulo: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  headerCount: { fontSize: 13, color: COLORS.textLight },
  pendientesBanner: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 10,
    padding: 10,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  pendientesTexto: { fontSize: 12, color: '#92400E', fontWeight: '600' },
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
  clienteRowActiva: { opacity: 0.85 },
  asa: {
    width: 34, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  asaTexto: { fontSize: 18, color: COLORS.textLight },
  asaWeb: {
    width: 34, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
    // @ts-ignore web-only
    cursor: 'grab',
  },
  clienteRowDragOver: {
    borderTopWidth: 3,
    borderTopColor: COLORS.primary,
  },
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
