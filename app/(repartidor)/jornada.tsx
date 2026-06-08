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
import { COLORS, urlFoto } from '../../constants';
import { Parada, Cliente } from '../../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type EstadoFotos = 'esperando' | 'foto1' | 'foto2' | 'nota' | 'completado';

export default function JornadaRepartidor() {
  const { jornada, paradaActual, setParadaActual } = useJornadaStore();
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [asignacion, setAsignacion] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [estadoFotos, setEstadoFotos] = useState<EstadoFotos>('esperando');
  const [foto1, setFoto1] = useState<string | null>(null);
  const [foto2, setFoto2] = useState<string | null>(null);
  const [nota, setNota] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [clientesModal, setClientesModal] = useState(false);
  const [clienteCartilla, setClienteCartilla] = useState<Cliente | null>(null);

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
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const res = await registrarParada({
        jornada_id: jornada.id,
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        cliente_id: cliente.id,
      });
      setParadaActual(res.data);
      setEstadoFotos('foto1');
      setFoto1(null);
      setFoto2(null);
      setNota('');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? 'No se pudo registrar la parada');
    }
    setProcesando(false);
  };

  const tomarFoto = async (numero: 1 | 2) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitás permitir el acceso a la cámara');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      allowsEditing: false,
    });
    if (result.canceled) return;
    const uri = result.assets[0].uri;
    if (numero === 1) {
      setFoto1(uri);
      setEstadoFotos('foto2');
    } else {
      setFoto2(uri);
      setEstadoFotos('nota');
    }
  };

  const confirmarParada = async () => {
    if (!paradaActual) return;
    setProcesando(true);
    try {
      if (foto1) {
        const form1 = new FormData();
        form1.append('foto', { uri: foto1, type: 'image/jpeg', name: 'foto1.jpg' } as any);
        form1.append('numero', '1');
        await subirFoto(paradaActual.id, form1);
      }
      if (foto2) {
        const form2 = new FormData();
        form2.append('foto', { uri: foto2, type: 'image/jpeg', name: 'foto2.jpg' } as any);
        form2.append('numero', '2');
        await subirFoto(paradaActual.id, form2);
      }
      await finalizarParada(paradaActual.id, nota.trim() || undefined);
      setEstadoFotos('esperando');
      setParadaActual(null);
      setFoto1(null);
      setFoto2(null);
      setNota('');
      await cargarDatos();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? 'No se pudo completar la parada');
    }
    setProcesando(false);
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

  return (
    <View style={styles.container}>
      {/* Panel de flujo de fotos */}
      {estadoFotos !== 'esperando' && paradaActual && (
        <View style={styles.fotoPanel}>
          <Text style={styles.fotoPanelCliente}>
            {paradaActual.cliente?.nombre ?? 'Cliente'}
          </Text>

          {estadoFotos === 'foto1' && (
            <>
              <Text style={styles.fotoPanelTitulo}>Foto 1 de 2</Text>
              <Text style={styles.fotoPanelDesc}>Sacá la primera foto del cliente</Text>
              {foto1
                ? <Image source={{ uri: foto1 }} style={styles.fotoPreview} />
                : (
                  <TouchableOpacity style={styles.btnFoto} onPress={() => tomarFoto(1)}>
                    <Text style={styles.btnFotoIcono}>📷</Text>
                    <Text style={styles.btnFotoTexto}>Tomar Foto 1</Text>
                  </TouchableOpacity>
                )}
            </>
          )}

          {estadoFotos === 'foto2' && (
            <>
              <Text style={styles.fotoPanelTitulo}>Foto 2 de 2</Text>
              <Text style={styles.fotoPanelDesc}>Sacá la segunda foto</Text>
              <View style={styles.fotosRow}>
                {foto1 && <Image source={{ uri: foto1 }} style={styles.fotoMini} />}
                <TouchableOpacity style={styles.btnFoto} onPress={() => tomarFoto(2)}>
                  <Text style={styles.btnFotoIcono}>📷</Text>
                  <Text style={styles.btnFotoTexto}>Tomar Foto 2</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {estadoFotos === 'nota' && (
            <>
              <View style={styles.fotosRow}>
                {foto1 && <Image source={{ uri: foto1 }} style={styles.fotoMini} />}
                {foto2 && <Image source={{ uri: foto2 }} style={styles.fotoMini} />}
              </View>
              <Text style={styles.fotoPanelTitulo}>Nota (opcional)</Text>
              <TextInput
                style={styles.notaInput}
                placeholder="Agregar observación..."
                placeholderTextColor={COLORS.textLight}
                multiline
                value={nota}
                onChangeText={setNota}
              />
              <TouchableOpacity style={styles.btnConfirmar} onPress={confirmarParada} disabled={procesando}>
                {procesando
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnTexto}>Confirmar parada ✓</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* Lista de paradas del día */}
      {estadoFotos === 'esperando' && (
        <>
          <View style={styles.header}>
            <Text style={styles.headerTitulo}>Paradas del día</Text>
            <Text style={styles.headerCount}>{paradas.length} completadas</Text>
          </View>

          <TouchableOpacity style={styles.btnNuevaParada} onPress={() => setClientesModal(true)} disabled={procesando}>
            {procesando
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnTexto}>+ Registrar llegada a cliente</Text>}
          </TouchableOpacity>

          <FlatList
            data={paradas}
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
            <TouchableOpacity onPress={() => setClientesModal(false)}>
              <Text style={styles.modalCerrar}>✕</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={clientesRuta}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ padding: 16, gap: 10 }}
            renderItem={({ item }) => {
              const yaVisitado = paradas.some((p) => p.cliente_id === item.id);
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
                  <TouchableOpacity style={styles.btnCartilla} onPress={() => setClienteCartilla(item)}>
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
        onClose={() => setClienteCartilla(null)}
        onGuardado={cargarDatos}
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
  fotosRow: { flexDirection: 'row', gap: 10 },
  fotoMini: { width: 90, height: 90, borderRadius: 8 },
  btnFoto: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  btnFotoIcono: { fontSize: 32 },
  btnFotoTexto: { color: '#fff', fontWeight: '700', fontSize: 15 },
  notaInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: COLORS.text,
    minHeight: 80,
    backgroundColor: COLORS.background,
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
