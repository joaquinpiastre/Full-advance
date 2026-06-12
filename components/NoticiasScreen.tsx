import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { obtenerAnuncios, crearAnuncio, eliminarAnuncio } from '../services/api';
import { Anuncio } from '../types';
import { COLORS } from '../constants';
import { useAuthStore } from '../store/authStore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type Props = {
  color?: string;
};

export default function NoticiasScreen({ color = COLORS.primary }: Props) {
  const { usuario } = useAuthStore();
  const puedePublicar = usuario?.rol === 'admin' || usuario?.rol === 'supervisor';
  const [anuncios, setAnuncios] = useState<Anuncio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [tipo, setTipo] = useState<'info' | 'oferta'>('info');
  const [publicando, setPublicando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const res = await obtenerAnuncios();
      setAnuncios(res.data);
    } catch {}
    setCargando(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const publicar = async () => {
    if (!mensaje.trim()) {
      Alert.alert('Error', 'Escribí un mensaje');
      return;
    }
    setPublicando(true);
    try {
      await crearAnuncio({ titulo: titulo.trim() || undefined, mensaje: mensaje.trim(), tipo });
      setTitulo('');
      setMensaje('');
      setTipo('info');
      cargar();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? 'No se pudo publicar el anuncio');
    }
    setPublicando(false);
  };

  const eliminar = (id: number) => {
    Alert.alert('Eliminar', '¿Eliminar este anuncio?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          try {
            await eliminarAnuncio(id);
            setAnuncios((prev) => prev.filter((a) => a.id !== id));
          } catch {
            Alert.alert('Error', 'No se pudo eliminar');
          }
        },
      },
    ]);
  };

  if (cargando) return <View style={styles.center}><ActivityIndicator color={color} size="large" /></View>;

  return (
    <FlatList
      data={anuncios}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.lista}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargar(); }} />
      }
      ListHeaderComponent={
        puedePublicar ? (
          <View style={styles.form}>
            <Text style={styles.formTitulo}>Publicar noticia</Text>
            <View style={styles.tipoRow}>
              {([
                { key: 'info', label: '📢 Información' },
                { key: 'oferta', label: '🎁 Oferta' },
              ] as { key: 'info' | 'oferta'; label: string }[]).map((op) => {
                const activo = tipo === op.key;
                return (
                  <TouchableOpacity
                    key={op.key}
                    style={[styles.tipoChip, { borderColor: color }, activo && { backgroundColor: color }]}
                    onPress={() => setTipo(op.key)}
                  >
                    <Text style={[styles.tipoChipTexto, { color: activo ? '#fff' : color }]}>{op.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TextInput
              style={styles.input}
              placeholder="Título (opcional)"
              placeholderTextColor={COLORS.textLight}
              value={titulo}
              onChangeText={setTitulo}
            />
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="Escribí el mensaje para repartidores y preventistas..."
              placeholderTextColor={COLORS.textLight}
              multiline
              value={mensaje}
              onChangeText={setMensaje}
            />
            <TouchableOpacity
              style={[styles.btnPublicar, { backgroundColor: color }]}
              onPress={publicar}
              disabled={publicando}
            >
              {publicando ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPublicarTexto}>Publicar</Text>}
            </TouchableOpacity>
          </View>
        ) : null
      }
      renderItem={({ item }) => (
        <View style={[styles.card, item.tipo === 'oferta' ? styles.cardOferta : styles.cardInfo]}>
          <View style={styles.cardHeader}>
            <View style={[styles.pill, item.tipo === 'oferta' ? styles.pillOferta : styles.pillInfo]}>
              <Text style={styles.pillTexto}>{item.tipo === 'oferta' ? '🎁 OFERTA' : '📢 INFO'}</Text>
            </View>
            {puedePublicar && (
              <TouchableOpacity onPress={() => eliminar(item.id)}>
                <Text style={styles.eliminar}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
          {item.titulo ? <Text style={styles.cardTitulo}>{item.titulo}</Text> : null}
          <Text style={styles.cardMensaje}>{item.mensaje}</Text>
          <Text style={styles.cardFooter}>
            {item.autor_nombre} · {format(new Date(item.created_at), "d MMM, HH:mm", { locale: es })}
          </Text>
        </View>
      )}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      ListEmptyComponent={
        <View style={styles.vacio}>
          <Text style={styles.vacioEmoji}>📭</Text>
          <Text style={styles.vacioTexto}>Sin noticias por el momento</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  lista: { padding: 16, paddingBottom: 32, flexGrow: 1, backgroundColor: COLORS.background },

  form: {
    backgroundColor: COLORS.card, borderRadius: 14, padding: 14, gap: 10, marginBottom: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  formTitulo: { fontSize: 13, fontWeight: '800', color: COLORS.text, textTransform: 'uppercase', letterSpacing: 0.5 },
  tipoRow: { flexDirection: 'row', gap: 8 },
  tipoChip: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  tipoChipTexto: { fontWeight: '700', fontSize: 13 },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    padding: 12, fontSize: 15, color: COLORS.text, backgroundColor: COLORS.background,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  btnPublicar: { borderRadius: 12, padding: 14, alignItems: 'center' },
  btnPublicarTexto: { color: '#fff', fontWeight: '700', fontSize: 15 },

  card: {
    backgroundColor: COLORS.card, borderRadius: 12, padding: 14, gap: 6,
    borderLeftWidth: 4, elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4,
  },
  cardInfo: { borderLeftColor: COLORS.secondary },
  cardOferta: { borderLeftColor: '#F59E0B', backgroundColor: '#FFFBEB' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pill: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  pillInfo: { backgroundColor: COLORS.secondary },
  pillOferta: { backgroundColor: '#F59E0B' },
  pillTexto: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  eliminar: { fontSize: 16, color: COLORS.textLight, fontWeight: '700' },
  cardTitulo: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  cardMensaje: { fontSize: 14, color: COLORS.text, lineHeight: 20 },
  cardFooter: { fontSize: 11, color: COLORS.textLight, marginTop: 4, textTransform: 'capitalize' },

  vacio: { alignItems: 'center', paddingTop: 60, gap: 10 },
  vacioEmoji: { fontSize: 40 },
  vacioTexto: { fontSize: 14, color: COLORS.textLight, textAlign: 'center' },
});
