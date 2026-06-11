import { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { COLORS } from '../constants';

interface Props {
  opciones: string[];
  valor: string;
  onSeleccionar: (v: string) => void;
  color?: string;
  puedeAgregar?: boolean;
  onAgregar?: (nombre: string) => Promise<void>;
  placeholderNuevo?: string;
}

export default function SelectorConAgregar({
  opciones, valor, onSeleccionar, color = COLORS.primary,
  puedeAgregar = false, onAgregar, placeholderNuevo = 'Nombre nuevo',
}: Props) {
  const [agregando, setAgregando] = useState(false);
  const [nuevo, setNuevo] = useState('');
  const [guardando, setGuardando] = useState(false);

  const confirmarAgregar = async () => {
    const nombre = nuevo.trim();
    if (!nombre) {
      setAgregando(false);
      return;
    }
    setGuardando(true);
    try {
      await onAgregar?.(nombre);
      onSeleccionar(nombre);
      setNuevo('');
      setAgregando(false);
    } catch {}
    setGuardando(false);
  };

  return (
    <View>
      <View style={styles.chipsRow}>
        {opciones.map((op) => {
          const activo = valor === op;
          return (
            <TouchableOpacity
              key={op}
              style={[styles.chip, { borderColor: color }, activo && { backgroundColor: color }]}
              onPress={() => onSeleccionar(activo ? '' : op)}
            >
              <Text style={[styles.chipTexto, { color: activo ? '#fff' : color }]}>{op}</Text>
            </TouchableOpacity>
          );
        })}
        {puedeAgregar && !agregando && (
          <TouchableOpacity
            style={[styles.chip, styles.chipAgregar, { borderColor: color }]}
            onPress={() => setAgregando(true)}
          >
            <Text style={[styles.chipTexto, { color }]}>+ Nuevo</Text>
          </TouchableOpacity>
        )}
      </View>
      {agregando && (
        <View style={styles.nuevoRow}>
          <TextInput
            style={styles.nuevoInput}
            placeholder={placeholderNuevo}
            placeholderTextColor={COLORS.textLight}
            value={nuevo}
            onChangeText={setNuevo}
            autoFocus
          />
          <TouchableOpacity style={[styles.btnConfirmar, { backgroundColor: color }]} onPress={confirmarAgregar} disabled={guardando}>
            {guardando ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnConfirmarTexto}>OK</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnCancelar} onPress={() => { setAgregando(false); setNuevo(''); }}>
            <Text style={styles.btnCancelarTexto}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  chipTexto: { fontWeight: '700', fontSize: 13 },
  chipAgregar: { borderStyle: 'dashed' },
  nuevoRow: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' },
  nuevoInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: COLORS.card,
  },
  btnConfirmar: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  btnConfirmarTexto: { color: '#fff', fontWeight: '700', fontSize: 13 },
  btnCancelar: { padding: 8 },
  btnCancelarTexto: { fontSize: 16, color: COLORS.textLight },
});
