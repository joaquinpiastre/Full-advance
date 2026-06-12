import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { COLORS } from '../constants';

export type OpcionRuta = {
  id: number;
  nombre: string;
  descripcion?: string;
  clientes_count?: number;
};

type Props = {
  visible: boolean;
  opciones: OpcionRuta[];
  seleccionActual?: number | null;
  color: string;
  onElegir: (ruta_id: number) => Promise<void>;
  onClose?: () => void;
};

export default function EleccionRutaModal({ visible, opciones, seleccionActual, color, onElegir, onClose }: Props) {
  const [enviando, setEnviando] = useState(false);

  const handleElegir = async (ruta_id: number) => {
    setEnviando(true);
    try {
      await onElegir(ruta_id);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={[styles.header, { backgroundColor: color }]}>
          <Text style={styles.titulo}>¿Qué ruta vas a hacer?</Text>
          <Text style={styles.sub}>
            Tu elección se mantiene toda la semana y se reinicia el domingo a la noche.
          </Text>
          {onClose && (
            <TouchableOpacity style={styles.cerrar} onPress={onClose}>
              <Text style={styles.cerrarTexto}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
          {opciones.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={[styles.opcion, seleccionActual === r.id && { borderColor: color, backgroundColor: '#F5F5FF' }]}
              onPress={() => handleElegir(r.id)}
              disabled={enviando}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.opcionTitulo}>📍 {r.nombre}</Text>
                {r.descripcion && <Text style={styles.opcionDesc}>{r.descripcion}</Text>}
                <Text style={styles.opcionDesc}>{r.clientes_count ?? 0} clientes</Text>
              </View>
              {seleccionActual === r.id && <Text style={[styles.check, { color }]}>✓</Text>}
              {enviando && <ActivityIndicator color={color} />}
            </TouchableOpacity>
          ))}
          {opciones.length === 0 && (
            <Text style={styles.vacio}>No tenés rutas habilitadas. Pedile al admin que te asigne una.</Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { padding: 20, paddingTop: 24 },
  titulo: { fontSize: 18, fontWeight: '800', color: '#fff' },
  sub: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 6 },
  cerrar: { position: 'absolute', top: 20, right: 16 },
  cerrarTexto: { fontSize: 20, color: '#fff', fontWeight: '700' },
  opcion: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  opcionTitulo: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  opcionDesc: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  check: { fontSize: 20, fontWeight: '800' },
  vacio: { textAlign: 'center', color: COLORS.textLight, marginTop: 30, fontSize: 14, paddingHorizontal: 20 },
});
