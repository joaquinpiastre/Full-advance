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
  color: string;
  onElegir: (ruta_id: number) => Promise<void>;
  onClose?: () => void;
  // Single-select mode (default, backwards compat)
  seleccionActual?: number | null;
  // Multi-select mode
  multiSelect?: boolean;
  seleccionadas?: number[];
  onConfirmar?: () => void;
};

export default function EleccionRutaModal({
  visible, opciones, color, onElegir, onClose,
  seleccionActual, multiSelect = false, seleccionadas = [], onConfirmar,
}: Props) {
  const [enviando, setEnviando] = useState<number | null>(null);

  const handleElegir = async (ruta_id: number) => {
    setEnviando(ruta_id);
    try {
      await onElegir(ruta_id);
      if (!multiSelect) {
        // single-select: parent closes the modal after onElegir resolves
      }
    } finally {
      setEnviando(null);
    }
  };

  const estaSeleccionada = (id: number) =>
    multiSelect ? seleccionadas.includes(id) : seleccionActual === id;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={[styles.header, { backgroundColor: color }]}>
          <Text style={styles.titulo}>
            {multiSelect ? '¿Qué rutas vas a hacer?' : '¿Qué ruta vas a hacer?'}
          </Text>
          <Text style={styles.sub}>
            {multiSelect
              ? 'Podés seleccionar una o más rutas. Los clientes se juntarán en una sola lista.'
              : 'Tu elección se mantiene toda la semana y se reinicia el domingo a la noche.'}
          </Text>
          {onClose && (
            <TouchableOpacity style={styles.cerrar} onPress={onClose}>
              <Text style={styles.cerrarTexto}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
          {opciones.map((r) => {
            const activa = estaSeleccionada(r.id);
            const cargando = enviando === r.id;
            return (
              <TouchableOpacity
                key={r.id}
                style={[styles.opcion, activa && { borderColor: color, backgroundColor: `${color}15` }]}
                onPress={() => handleElegir(r.id)}
                disabled={enviando !== null}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.opcionTitulo}>📍 {r.nombre}</Text>
                  {r.descripcion && <Text style={styles.opcionDesc}>{r.descripcion}</Text>}
                  <Text style={styles.opcionDesc}>{r.clientes_count ?? 0} clientes</Text>
                </View>
                {cargando
                  ? <ActivityIndicator color={color} />
                  : activa
                    ? <Text style={[styles.check, { color }]}>✓</Text>
                    : multiSelect
                      ? <View style={[styles.checkBox, { borderColor: color }]} />
                      : null}
              </TouchableOpacity>
            );
          })}
          {opciones.length === 0 && (
            <Text style={styles.vacio}>No tenés rutas habilitadas. Pedile al admin que te asigne una.</Text>
          )}
        </ScrollView>

        {multiSelect && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.btnConfirmar,
                { backgroundColor: seleccionadas.length > 0 ? color : COLORS.border },
              ]}
              onPress={onConfirmar}
              disabled={seleccionadas.length === 0}
            >
              <Text style={styles.btnConfirmarTexto}>
                {seleccionadas.length === 0
                  ? 'Elegí al menos una ruta'
                  : `Confirmar ${seleccionadas.length} ruta${seleccionadas.length > 1 ? 's' : ''}`}
              </Text>
            </TouchableOpacity>
          </View>
        )}
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
  checkBox: {
    width: 22, height: 22, borderRadius: 4, borderWidth: 2,
  },
  vacio: { textAlign: 'center', color: COLORS.textLight, marginTop: 30, fontSize: 14, paddingHorizontal: 20 },
  footer: {
    padding: 16, paddingBottom: 28,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  btnConfirmar: {
    borderRadius: 12, padding: 16, alignItems: 'center',
  },
  btnConfirmarTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
