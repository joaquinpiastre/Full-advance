import { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet, Modal, FlatList,
} from 'react-native';
import { COLORS } from '../constants';

interface Props {
  titulo: string;
  opciones: string[];
  valores: string[];
  onCambiar: (v: string[]) => void;
  color?: string;
  placeholder?: string;
  vacioTexto?: string;
}

export default function SelectorModalMultiple({
  titulo, opciones, valores, onCambiar, color = COLORS.primary,
  placeholder = 'Seleccionar...', vacioTexto = 'No hay opciones disponibles',
}: Props) {
  const [visible, setVisible] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  const cerrar = () => {
    setVisible(false);
    setBusqueda('');
  };

  const toggle = (op: string) => {
    onCambiar(valores.includes(op) ? valores.filter((v) => v !== op) : [...valores, op]);
  };

  const q = busqueda.trim().toLowerCase();
  const opcionesFiltradas = q ? opciones.filter((op) => op.toLowerCase().includes(q)) : opciones;

  return (
    <>
      <TouchableOpacity style={[styles.campo, { borderColor: color }]} onPress={() => setVisible(true)}>
        <Text style={[styles.campoTexto, valores.length === 0 && styles.campoPlaceholder]} numberOfLines={1}>
          {valores.length > 0 ? valores.join(', ') : placeholder}
        </Text>
        <Text style={[styles.flecha, { color }]}>▼</Text>
      </TouchableOpacity>

      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={cerrar}>
        <View style={styles.modal}>
          <View style={[styles.header, { backgroundColor: color }]}>
            <Text style={styles.headerTitulo}>{titulo}</Text>
            <TouchableOpacity onPress={cerrar} style={styles.btnCerrar}>
              <Text style={styles.cerrar}>✕</Text>
            </TouchableOpacity>
          </View>

          {opciones.length > 6 && (
            <View style={styles.buscadorCont}>
              <TextInput
                style={styles.buscador}
                placeholder="Buscar..."
                placeholderTextColor={COLORS.textLight}
                value={busqueda}
                onChangeText={setBusqueda}
                autoCapitalize="none"
              />
            </View>
          )}

          <FlatList
            data={opcionesFiltradas}
            keyExtractor={(op) => op}
            contentContainerStyle={styles.lista}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: op }) => {
              const activo = valores.includes(op);
              return (
                <TouchableOpacity
                  style={[styles.opcion, activo && { borderColor: color, backgroundColor: `${color}15` }]}
                  onPress={() => toggle(op)}
                >
                  <Text style={[styles.opcionTexto, activo && { color, fontWeight: '800' }]}>{op}</Text>
                  {activo && <Text style={[styles.check, { color }]}>✓</Text>}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={<Text style={styles.vacio}>{vacioTexto}</Text>}
          />

          <View style={styles.footer}>
            <TouchableOpacity style={[styles.btnListo, { backgroundColor: color }]} onPress={cerrar}>
              <Text style={styles.btnListoTexto}>Listo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  campo: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: COLORS.card,
  },
  campoTexto: { fontSize: 14, fontWeight: '700', color: COLORS.text, flex: 1 },
  campoPlaceholder: { color: COLORS.textLight, fontWeight: '400' },
  flecha: { fontSize: 12, marginLeft: 8 },
  modal: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, paddingTop: 24,
  },
  headerTitulo: { fontSize: 18, fontWeight: '800', color: '#fff' },
  btnCerrar: { marginLeft: 4, padding: 4 },
  cerrar: { fontSize: 20, color: '#fff', fontWeight: '700' },
  buscadorCont: { padding: 16, paddingBottom: 8 },
  buscador: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    padding: 12, fontSize: 15, color: COLORS.text, backgroundColor: COLORS.card,
  },
  lista: { padding: 16, paddingTop: 8, gap: 8, flexGrow: 1 },
  opcion: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 14, backgroundColor: COLORS.card,
  },
  opcionTexto: { fontSize: 15, color: COLORS.text, flex: 1 },
  check: { fontSize: 16, fontWeight: '800', marginLeft: 8 },
  vacio: { textAlign: 'center', color: COLORS.textLight, marginTop: 30, fontSize: 14 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.card },
  btnListo: { borderRadius: 10, padding: 14, alignItems: 'center' },
  btnListoTexto: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
