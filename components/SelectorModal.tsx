import { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet,
  Modal, FlatList, ActivityIndicator,
} from 'react-native';
import { COLORS } from '../constants';

interface Props {
  titulo: string;
  opciones: string[];
  valor: string;
  onSeleccionar: (v: string) => void;
  color?: string;
  placeholder?: string;
  iconos?: Record<string, string>;
  puedeAgregar?: boolean;
  onAgregar?: (nombre: string) => Promise<void>;
  placeholderNuevo?: string;
  vacioTexto?: string;
}

export default function SelectorModal({
  titulo, opciones, valor, onSeleccionar, color = COLORS.primary,
  placeholder = 'Seleccionar...', iconos, puedeAgregar = false, onAgregar,
  placeholderNuevo = 'Nombre nuevo', vacioTexto = 'No hay opciones disponibles',
}: Props) {
  const [visible, setVisible] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [agregando, setAgregando] = useState(false);
  const [nuevo, setNuevo] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cerrar = () => {
    setVisible(false);
    setBusqueda('');
    setAgregando(false);
    setNuevo('');
  };

  const elegir = (op: string) => {
    onSeleccionar(valor === op ? '' : op);
    cerrar();
  };

  const confirmarAgregar = async () => {
    const nombre = nuevo.trim();
    if (!nombre) { setAgregando(false); return; }
    setGuardando(true);
    try {
      await onAgregar?.(nombre);
      onSeleccionar(nombre);
      setNuevo('');
      cerrar();
    } catch {}
    setGuardando(false);
  };

  const q = busqueda.trim().toLowerCase();
  const opcionesFiltradas = q ? opciones.filter((op) => op.toLowerCase().includes(q)) : opciones;

  return (
    <>
      <TouchableOpacity style={[styles.campo, { borderColor: color }]} onPress={() => setVisible(true)}>
        <Text style={[styles.campoTexto, !valor && styles.campoPlaceholder]} numberOfLines={1}>
          {valor ? `${iconos?.[valor] ? `${iconos[valor]} ` : ''}${valor}` : placeholder}
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
              const activo = valor === op;
              return (
                <TouchableOpacity
                  style={[styles.opcion, activo && { borderColor: color, backgroundColor: `${color}15` }]}
                  onPress={() => elegir(op)}
                >
                  <Text style={[styles.opcionTexto, activo && { color, fontWeight: '800' }]}>
                    {iconos?.[op] ? `${iconos[op]} ` : ''}{op}
                  </Text>
                  {activo && <Text style={[styles.check, { color }]}>✓</Text>}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={<Text style={styles.vacio}>{vacioTexto}</Text>}
          />

          {puedeAgregar && (
            <View style={styles.footer}>
              {agregando ? (
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
              ) : (
                <TouchableOpacity style={[styles.btnAgregar, { borderColor: color }]} onPress={() => setAgregando(true)}>
                  <Text style={[styles.btnAgregarTexto, { color }]}>+ Nuevo</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
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
  btnAgregar: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 10, padding: 12, alignItems: 'center' },
  btnAgregarTexto: { fontWeight: '700', fontSize: 14 },
  nuevoRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  nuevoInput: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12, fontSize: 14, color: COLORS.text, backgroundColor: COLORS.background },
  btnConfirmar: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  btnConfirmarTexto: { color: '#fff', fontWeight: '700', fontSize: 13 },
  btnCancelar: { padding: 8 },
  btnCancelarTexto: { fontSize: 16, color: COLORS.textLight },
});
