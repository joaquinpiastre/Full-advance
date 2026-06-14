import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { COLORS } from '../constants';

type Props = {
  acciones: string[];
  onChange: (acciones: string[]) => void;
  label?: string;
  placeholder?: string;
  agregarTexto?: string;
  color?: string;
};

export default function AccionesList({
  acciones, onChange,
  label = '¿Qué acciones tiene que hacer?',
  placeholder = 'Ej: contactar al cliente, revisar precio, gestionar pedido...',
  agregarTexto = '+ Agregar acción',
  color = COLORS.secondary,
}: Props) {
  const actualizar = (i: number, texto: string) => {
    const copia = [...acciones];
    copia[i] = texto;
    onChange(copia);
  };

  const agregar = () => onChange([...acciones, '']);

  const quitar = (i: number) => onChange(acciones.filter((_, idx) => idx !== i));

  return (
    <View style={styles.contenedor}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      {acciones.map((accion, i) => (
        <View key={i} style={styles.fila}>
          <TextInput
            style={styles.input}
            placeholder={placeholder}
            placeholderTextColor={COLORS.textLight}
            value={accion}
            onChangeText={(texto) => actualizar(i, texto)}
            multiline
          />
          {acciones.length > 1 && (
            <TouchableOpacity style={styles.quitar} onPress={() => quitar(i)}>
              <Text style={styles.quitarTexto}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
      <TouchableOpacity style={[styles.agregar, { borderColor: color }]} onPress={agregar}>
        <Text style={[styles.agregarTexto, { color }]}>{agregarTexto}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { gap: 8 },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.textLight, textTransform: 'uppercase' },
  fila: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: COLORS.background,
    minHeight: 50,
    textAlignVertical: 'top',
  },
  quitar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quitarTexto: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  agregar: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderColor: COLORS.secondary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  agregarTexto: { fontSize: 13, fontWeight: '700', color: COLORS.secondary },
});
