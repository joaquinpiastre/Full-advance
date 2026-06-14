import { View, Text, StyleSheet, TextInput } from 'react-native';
import FechaVencimientoPicker from './FechaVencimientoPicker';
import { COLORS } from '../constants';

type Props = {
  mercaderia: string;
  onMercaderiaChange: (texto: string) => void;
  fecha: Date | null;
  onFechaChange: (fecha: Date) => void;
  nota: string;
  onNotaChange: (texto: string) => void;
};

export default function MercaderiaVencidaForm({
  mercaderia, onMercaderiaChange, fecha, onFechaChange, nota, onNotaChange,
}: Props) {
  return (
    <View style={styles.contenedor}>
      <Text style={styles.label}>¿Qué mercadería?</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej: yogur marca X, galletitas..."
        placeholderTextColor={COLORS.textLight}
        value={mercaderia}
        onChangeText={onMercaderiaChange}
      />

      <Text style={[styles.label, { marginTop: 10 }]}>Fecha</Text>
      <FechaVencimientoPicker value={fecha} onChange={onFechaChange} />

      <Text style={[styles.label, { marginTop: 10 }]}>Nota</Text>
      <TextInput
        style={[styles.input, styles.inputMultiline]}
        placeholder="Detalles adicionales..."
        placeholderTextColor={COLORS.textLight}
        value={nota}
        onChangeText={onNotaChange}
        multiline
      />
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { gap: 4 },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.textLight, textTransform: 'uppercase' },
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
});
