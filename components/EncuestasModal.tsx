import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, TextInput,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import {
  obtenerEncuestas, crearEncuesta, actualizarEncuesta, eliminarEncuesta, obtenerDepartamentos,
} from '../services/api';
import { COLORS } from '../constants';
import { Encuesta } from '../types';
import SelectorModalMultiple from './SelectorModalMultiple';

interface Props {
  visible: boolean;
  onClose: () => void;
  onCambios?: () => void;
}

export default function EncuestasModal({ visible, onClose, onCambios }: Props) {
  const [encuestas, setEncuestas] = useState<Encuesta[]>([]);
  const [departamentos, setDepartamentos] = useState<{ id: number; nombre: string }[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [pregunta, setPregunta] = useState('');
  const [zonas, setZonas] = useState<string[]>([]);

  useEffect(() => {
    if (!visible) return;
    cargar();
    obtenerDepartamentos().then((res) => setDepartamentos(res.data)).catch(() => {});
  }, [visible]);

  const cargar = async () => {
    setCargando(true);
    try {
      const res = await obtenerEncuestas();
      setEncuestas(res.data ?? []);
    } catch {}
    setCargando(false);
  };

  const crear = async () => {
    if (!pregunta.trim()) {
      Alert.alert('Error', 'La pregunta es obligatoria');
      return;
    }
    setGuardando(true);
    try {
      await crearEncuesta({ pregunta: pregunta.trim(), zonas });
      setPregunta('');
      setZonas([]);
      await cargar();
      onCambios?.();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? 'No se pudo crear la encuesta');
    }
    setGuardando(false);
  };

  const toggleActiva = async (encuesta: Encuesta) => {
    setEncuestas((prev) => prev.map((e) => (e.id === encuesta.id ? { ...e, activa: !e.activa } : e)));
    try {
      await actualizarEncuesta(encuesta.id, { activa: !encuesta.activa });
      onCambios?.();
    } catch {
      setEncuestas((prev) => prev.map((e) => (e.id === encuesta.id ? { ...e, activa: encuesta.activa } : e)));
      Alert.alert('Error', 'No se pudo actualizar la encuesta');
    }
  };

  const eliminar = (encuesta: Encuesta) => {
    Alert.alert('Eliminar encuesta', `¿Eliminar "${encuesta.pregunta}"? Se borrarán también sus respuestas.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        try {
          await eliminarEncuesta(encuesta.id);
          setEncuestas((prev) => prev.filter((e) => e.id !== encuesta.id));
          onCambios?.();
        } catch {
          Alert.alert('Error', 'No se pudo eliminar la encuesta');
        }
      }},
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modal}>
        <View style={[styles.header, { backgroundColor: COLORS.primary }]}>
          <Text style={styles.headerTitulo}>Encuestas</Text>
          <TouchableOpacity onPress={onClose} style={styles.btnCerrar}>
            <Text style={styles.cerrar}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.form}>
          <Text style={styles.seccionTitulo}>Nueva encuesta</Text>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Pregunta (sí/no)</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: ¿Le compra a COMERCO?"
              placeholderTextColor={COLORS.textLight}
              value={pregunta}
              onChangeText={setPregunta}
            />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Zonas (vacío = todas las zonas)</Text>
            <SelectorModalMultiple
              titulo="Zonas"
              opciones={departamentos.map((d) => d.nombre)}
              valores={zonas}
              onCambiar={setZonas}
              color={COLORS.primary}
              placeholder="Todas las zonas"
            />
          </View>
          <TouchableOpacity style={[styles.btnGuardar, { backgroundColor: COLORS.primary }]} onPress={crear} disabled={guardando}>
            {guardando ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnGuardarTexto}>Crear encuesta</Text>}
          </TouchableOpacity>

          <Text style={[styles.seccionTitulo, { marginTop: 8 }]}>Encuestas configuradas</Text>
          {cargando ? (
            <ActivityIndicator color={COLORS.primary} />
          ) : encuestas.length === 0 ? (
            <Text style={styles.vacio}>No hay encuestas configuradas</Text>
          ) : (
            encuestas.map((e) => (
              <View key={e.id} style={styles.encuestaCard}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.encuestaPregunta}>{e.pregunta}</Text>
                  <Text style={styles.encuestaZonas}>
                    {e.zonas && e.zonas.length ? e.zonas.join(', ') : 'Todas las zonas'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.btnActiva, e.activa ? styles.btnActivaOn : styles.btnActivaOff]}
                  onPress={() => toggleActiva(e)}
                >
                  <Text style={styles.btnActivaTexto}>{e.activa ? 'Activa' : 'Inactiva'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnEliminar} onPress={() => eliminar(e)}>
                  <Text style={styles.btnEliminarTexto}>🗑️</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
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
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 24,
  },
  headerTitulo: { fontSize: 18, fontWeight: '800', color: '#fff' },
  btnCerrar: { marginLeft: 4, padding: 4 },
  cerrar: { fontSize: 20, color: '#fff', fontWeight: '700' },
  form: { padding: 16, gap: 14, paddingBottom: 40 },
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
  btnGuardar: { borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 4 },
  btnGuardarTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },
  vacio: { fontSize: 13, color: COLORS.textLight, textAlign: 'center', paddingVertical: 12 },
  encuestaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  encuestaPregunta: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  encuestaZonas: { fontSize: 12, color: COLORS.textLight },
  btnActiva: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  btnActivaOn: { backgroundColor: COLORS.success },
  btnActivaOff: { backgroundColor: COLORS.border },
  btnActivaTexto: { color: '#fff', fontWeight: '700', fontSize: 11 },
  btnEliminar: { padding: 6 },
  btnEliminarTexto: { fontSize: 18 },
});
