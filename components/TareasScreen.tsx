import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  obtenerUsuariosAsignables, obtenerTareasAsignadas, obtenerTareasCreadas,
  crearTarea, completarTarea,
} from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Tarea } from '../types';
import { COLORS } from '../constants';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type Props = {
  color?: string;
};

const ROL_LABEL: Record<string, string> = {
  repartidor: 'Repartidor',
  preventista: 'Preventista',
  supervisor: 'Supervisor',
  admin: 'Admin',
};

export default function TareasScreen({ color = COLORS.primary }: Props) {
  const { usuario } = useAuthStore();
  const puedeRecibirTareas = usuario?.rol === 'repartidor' || usuario?.rol === 'preventista';
  const [usuarios, setUsuarios] = useState<{ id: number; nombre: string; rol: string }[]>([]);
  const [asignadas, setAsignadas] = useState<Tarea[]>([]);
  const [creadas, setCreadas] = useState<Tarea[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [destinoId, setDestinoId] = useState<number | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [marcando, setMarcando] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [resUsuarios, resAsignadas, resCreadas] = await Promise.all([
        obtenerUsuariosAsignables(), obtenerTareasAsignadas(), obtenerTareasCreadas(),
      ]);
      setUsuarios(resUsuarios.data);
      setAsignadas(resAsignadas.data);
      setCreadas(resCreadas.data);
    } catch {}
    setCargando(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const enviar = async () => {
    if (!destinoId) {
      Alert.alert('Error', 'Elegí a quién le asignás la tarea');
      return;
    }
    if (!mensaje.trim()) {
      Alert.alert('Error', 'Escribí la tarea');
      return;
    }
    setEnviando(true);
    try {
      await crearTarea({ asignado_id: destinoId, mensaje: mensaje.trim() });
      setMensaje('');
      setDestinoId(null);
      cargar();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? 'No se pudo asignar la tarea');
    }
    setEnviando(false);
  };

  const marcarRealizada = async (tarea: Tarea) => {
    setMarcando(tarea.id);
    try {
      await completarTarea(tarea.id);
      setAsignadas((prev) => prev.map((t) => (t.id === tarea.id ? { ...t, completada: true, completada_at: new Date().toISOString() } : t)));
    } catch {
      Alert.alert('Error', 'No se pudo marcar la tarea como realizada');
    }
    setMarcando(null);
  };

  if (cargando) return <View style={styles.center}><ActivityIndicator color={color} size="large" /></View>;

  const pendientes = asignadas.filter((t) => !t.completada);
  const realizadas = asignadas.filter((t) => t.completada);

  return (
    <FlatList
      data={puedeRecibirTareas ? pendientes : []}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.lista}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargar(); }} />
      }
      ListHeaderComponent={
        <View style={{ gap: 16 }}>
          <View style={styles.form}>
            <Text style={styles.formTitulo}>Asignar tarea</Text>
            {usuarios.length === 0 ? (
              <Text style={styles.vacioTexto}>No hay otros repartidores/preventistas para asignar tareas.</Text>
            ) : (
              <>
                <View style={styles.chipsRow}>
                  {usuarios.map((u) => {
                    const activo = destinoId === u.id;
                    return (
                      <TouchableOpacity
                        key={u.id}
                        style={[styles.chip, { borderColor: color }, activo && { backgroundColor: color }]}
                        onPress={() => setDestinoId(u.id)}
                      >
                        <Text style={[styles.chipTexto, { color: activo ? '#fff' : color }]}>
                          {u.nombre} · {ROL_LABEL[u.rol] ?? u.rol}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  placeholder="Describí la tarea..."
                  placeholderTextColor={COLORS.textLight}
                  multiline
                  value={mensaje}
                  onChangeText={setMensaje}
                />
                <TouchableOpacity
                  style={[styles.btnEnviar, { backgroundColor: color }]}
                  onPress={enviar}
                  disabled={enviando}
                >
                  {enviando ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnEnviarTexto}>Asignar tarea</Text>}
                </TouchableOpacity>
              </>
            )}
          </View>

          {creadas.length > 0 && (
            <View>
              <Text style={styles.seccionTitulo}>Tareas que asigné</Text>
              <View style={{ gap: 8 }}>
                {creadas.map((t) => (
                  <View key={t.id} style={[styles.card, t.completada ? styles.cardRealizada : styles.cardCreada]}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardDestino}>{t.asignado_nombre} · {ROL_LABEL[t.asignado_rol ?? ''] ?? t.asignado_rol}</Text>
                      <View style={[styles.pill, t.completada ? styles.pillRealizada : styles.pillPendiente]}>
                        <Text style={styles.pillTexto}>{t.completada ? '✓ REALIZADA' : '⏳ PENDIENTE'}</Text>
                      </View>
                    </View>
                    <Text style={styles.cardMensaje}>{t.mensaje}</Text>
                    <Text style={styles.cardFooter}>
                      {format(new Date(t.created_at), "d MMM, HH:mm", { locale: es })}
                      {t.completada && t.completada_at ? ` · Realizada ${format(new Date(t.completada_at), "d MMM, HH:mm", { locale: es })}` : ''}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {puedeRecibirTareas && <Text style={styles.seccionTitulo}>Mis tareas pendientes</Text>}
        </View>
      }
      renderItem={({ item }) => (
        <View style={[styles.card, styles.cardPendiente]}>
          <Text style={styles.cardDestino}>De: {item.autor_nombre} · {ROL_LABEL[item.autor_rol ?? ''] ?? item.autor_rol}</Text>
          <Text style={styles.cardMensaje}>{item.mensaje}</Text>
          <Text style={styles.cardFooter}>{format(new Date(item.created_at), "d MMM, HH:mm", { locale: es })}</Text>
          <TouchableOpacity
            style={[styles.btnRealizada, { backgroundColor: COLORS.success }]}
            onPress={() => marcarRealizada(item)}
            disabled={marcando === item.id}
          >
            {marcando === item.id ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnEnviarTexto}>✓ Marcar como realizada</Text>}
          </TouchableOpacity>
        </View>
      )}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      ListEmptyComponent={
        puedeRecibirTareas ? (
          <View style={styles.vacio}>
            <Text style={styles.vacioEmoji}>✅</Text>
            <Text style={styles.vacioTexto}>No tenés tareas pendientes</Text>
          </View>
        ) : null
      }
      ListFooterComponent={
        puedeRecibirTareas && realizadas.length > 0 ? (
          <View style={{ marginTop: 16, gap: 8 }}>
            <Text style={styles.seccionTitulo}>Realizadas</Text>
            {realizadas.map((t) => (
              <View key={t.id} style={[styles.card, styles.cardRealizada]}>
                <Text style={styles.cardDestino}>De: {t.autor_nombre} · {ROL_LABEL[t.autor_rol ?? ''] ?? t.autor_rol}</Text>
                <Text style={styles.cardMensaje}>{t.mensaje}</Text>
                <Text style={styles.cardFooter}>
                  Realizada {t.completada_at ? format(new Date(t.completada_at), "d MMM, HH:mm", { locale: es }) : ''}
                </Text>
              </View>
            ))}
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  lista: { padding: 16, paddingBottom: 32, flexGrow: 1, backgroundColor: COLORS.background },

  form: {
    backgroundColor: COLORS.card, borderRadius: 14, padding: 14, gap: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  formTitulo: { fontSize: 13, fontWeight: '800', color: COLORS.text, textTransform: 'uppercase', letterSpacing: 0.5 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  chipTexto: { fontWeight: '700', fontSize: 13 },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    padding: 12, fontSize: 15, color: COLORS.text, backgroundColor: COLORS.background,
  },
  inputMultiline: { minHeight: 70, textAlignVertical: 'top' },
  btnEnviar: { borderRadius: 12, padding: 14, alignItems: 'center' },
  btnEnviarTexto: { color: '#fff', fontWeight: '700', fontSize: 14 },

  seccionTitulo: { fontSize: 13, fontWeight: '800', color: COLORS.text, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },

  card: {
    backgroundColor: COLORS.card, borderRadius: 12, padding: 14, gap: 6,
    borderLeftWidth: 4, elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4,
  },
  cardPendiente: { borderLeftColor: COLORS.warning, backgroundColor: '#FFFBEB' },
  cardCreada: { borderLeftColor: COLORS.secondary },
  cardRealizada: { borderLeftColor: COLORS.success, opacity: 0.8 },

  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardDestino: { fontSize: 12, fontWeight: '700', color: COLORS.text, flex: 1 },
  cardMensaje: { fontSize: 14, color: COLORS.text, lineHeight: 20 },
  cardFooter: { fontSize: 11, color: COLORS.textLight, marginTop: 2, textTransform: 'capitalize' },

  pill: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  pillPendiente: { backgroundColor: COLORS.warning },
  pillRealizada: { backgroundColor: COLORS.success },
  pillTexto: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  btnRealizada: { borderRadius: 10, padding: 10, alignItems: 'center', marginTop: 4 },

  vacio: { alignItems: 'center', paddingTop: 40, gap: 10 },
  vacioEmoji: { fontSize: 40 },
  vacioTexto: { fontSize: 14, color: COLORS.textLight, textAlign: 'center' },
});
