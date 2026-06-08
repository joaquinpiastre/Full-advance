import { ScrollView, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { COLORS } from '../constants';

type Persona = { id: number; nombre: string; rol?: string };

const ICONO_ROL: Record<string, string> = { repartidor: '🚚', preventista: '👔', admin: '⭐' };

// Tira horizontal de chips para elegir un repartidor/preventista sin scrollear
// una lista vertical larga. Incluye un chip "Todos" para limpiar el filtro.
export default function SelectorPersonas({
  personas,
  seleccionado,
  onSeleccionar,
  incluirTodos = true,
}: {
  personas: Persona[];
  seleccionado: number | null;
  onSeleccionar: (id: number | null) => void;
  incluirTodos?: boolean;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fila}>
      {incluirTodos && (
        <TouchableOpacity
          style={[styles.chip, seleccionado === null && styles.chipActivo]}
          onPress={() => onSeleccionar(null)}
        >
          <Text style={[styles.chipTexto, seleccionado === null && styles.chipTextoActivo]}>Todos</Text>
        </TouchableOpacity>
      )}
      {personas.map((p) => {
        const activo = seleccionado === p.id;
        return (
          <TouchableOpacity
            key={p.id}
            style={[styles.chip, activo && styles.chipActivo]}
            onPress={() => onSeleccionar(activo ? null : p.id)}
          >
            <Text style={[styles.chipTexto, activo && styles.chipTextoActivo]}>
              {p.rol ? `${ICONO_ROL[p.rol] ?? ''} ` : ''}{p.nombre}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fila: { gap: 8, paddingHorizontal: 16 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  chipActivo: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipTexto: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  chipTextoActivo: { color: '#fff' },
});
