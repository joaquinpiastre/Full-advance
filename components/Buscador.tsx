import { TextInput, TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { COLORS } from '../constants';

// Barra de búsqueda simple para filtrar listas largas (clientes, usuarios, etc) sin scrollear todo.
export default function Buscador({
  valor,
  onCambiar,
  placeholder = 'Buscar...',
}: {
  valor: string;
  onCambiar: (texto: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.icono}>🔍</Text>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textLight}
        value={valor}
        onChangeText={onCambiar}
      />
      {valor.length > 0 && (
        <TouchableOpacity onPress={() => onCambiar('')} style={styles.btnLimpiar}>
          <Text style={styles.btnLimpiarTexto}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    gap: 8,
  },
  icono: { fontSize: 14 },
  input: { flex: 1, paddingVertical: 10, fontSize: 14, color: COLORS.text },
  btnLimpiar: { padding: 4 },
  btnLimpiarTexto: { fontSize: 14, color: COLORS.textLight, fontWeight: '700' },
});
