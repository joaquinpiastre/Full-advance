import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Modal } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS } from '../constants';

interface Props {
  value: Date | null;
  onChange: (date: Date) => void;
}

export default function FechaVencimientoPicker({ value, onChange }: Props) {
  const [mostrar, setMostrar] = useState(false);
  const fecha = value ?? new Date();

  const formatear = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

  const onCambio = (_event: any, selected?: Date) => {
    if (Platform.OS === 'android') setMostrar(false);
    if (selected) onChange(selected);
  };

  return (
    <View>
      <TouchableOpacity style={styles.boton} onPress={() => setMostrar(true)}>
        <Text style={styles.icono}>📅</Text>
        <Text style={[styles.texto, !value && styles.textoVacio]}>
          {value ? formatear(value) : 'Seleccionar fecha'}
        </Text>
        <Text style={styles.flecha}>›</Text>
      </TouchableOpacity>

      {/* Android: el picker es un diálogo nativo */}
      {Platform.OS === 'android' && mostrar && (
        <DateTimePicker
          value={fecha}
          mode="date"
          display="calendar"
          minimumDate={new Date()}
          onChange={onCambio}
        />
      )}

      {/* iOS: mostramos en un modal con botón Listo */}
      {Platform.OS === 'ios' && (
        <Modal visible={mostrar} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCaja}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitulo}>Fecha de vencimiento</Text>
                <TouchableOpacity onPress={() => setMostrar(false)}>
                  <Text style={styles.modalListo}>Listo</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={fecha}
                mode="date"
                display="inline"
                minimumDate={new Date()}
                onChange={onCambio}
                style={{ width: '100%' }}
                locale="es-AR"
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  boton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 13,
    backgroundColor: COLORS.card,
    gap: 8,
    marginTop: 8,
  },
  icono: { fontSize: 18 },
  texto: { flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.text },
  textoVacio: { color: COLORS.textLight, fontWeight: '400' },
  flecha: { fontSize: 18, color: COLORS.textLight },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCaja: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  modalTitulo: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  modalListo: { fontSize: 16, fontWeight: '700', color: COLORS.primary },
});
