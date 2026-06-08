import { ScrollView, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { addDays, format, isSameDay, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { COLORS } from '../constants';

// Tira horizontal de fechas para elegir un día sin tener que escribirlo.
// Pensada para listas que dependen de "qué día quiero ver" (asignaciones, historial, etc).
export default function SelectorFechas({
  fecha,
  onCambiar,
  diasAtras = 7,
  diasAdelante = 7,
}: {
  fecha: string; // yyyy-MM-dd
  onCambiar: (fecha: string) => void;
  diasAtras?: number;
  diasAdelante?: number;
}) {
  const hoy = new Date();
  const seleccionada = new Date(fecha + 'T00:00:00');
  const dias = [];
  for (let i = -diasAtras; i <= diasAdelante; i++) {
    dias.push(addDays(hoy, i));
  }

  return (
    <View style={styles.container}>
      <View style={styles.accionesRow}>
        <TouchableOpacity style={styles.btnHoy} onPress={() => onCambiar(format(hoy, 'yyyy-MM-dd'))}>
          <Text style={styles.btnHoyTexto}>📅 Hoy</Text>
        </TouchableOpacity>
        <Text style={styles.fechaActual}>
          {format(seleccionada, "EEEE d 'de' MMMM", { locale: es })}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tira}
      >
        {dias.map((d) => {
          const valor = format(d, 'yyyy-MM-dd');
          const activo = isSameDay(d, seleccionada);
          return (
            <TouchableOpacity
              key={valor}
              style={[styles.dia, activo && styles.diaActivo, isToday(d) && !activo && styles.diaHoy]}
              onPress={() => onCambiar(valor)}
            >
              <Text style={[styles.diaNombre, activo && styles.diaTextoActivo]}>
                {format(d, 'EEE', { locale: es })}
              </Text>
              <Text style={[styles.diaNumero, activo && styles.diaTextoActivo]}>
                {format(d, 'd')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingTop: 12, paddingBottom: 10 },
  accionesRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, marginBottom: 10 },
  btnHoy: { backgroundColor: COLORS.background, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: COLORS.border },
  btnHoyTexto: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  fechaActual: { fontSize: 14, fontWeight: '700', color: COLORS.text, textTransform: 'capitalize', flex: 1 },
  tira: { paddingHorizontal: 16, gap: 8 },
  dia: {
    width: 52,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  diaActivo: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  diaHoy: { borderColor: COLORS.primary },
  diaNombre: { fontSize: 11, color: COLORS.textLight, fontWeight: '600', textTransform: 'capitalize' },
  diaNumero: { fontSize: 16, color: COLORS.text, fontWeight: '800', marginTop: 2 },
  diaTextoActivo: { color: '#fff' },
});
