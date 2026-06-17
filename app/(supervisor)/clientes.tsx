import { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { obtenerClientes } from '../../services/api';
import { COLORS, COLOR_CATEGORIA } from '../../constants';
import { Cliente, CategoriaCliente } from '../../types';
import Buscador from '../../components/Buscador';
import { coincideBusqueda } from '../../utils/busqueda';
import { esSoloCitric } from '../../utils/marcas';

const COLOR_CITRIC = '#F97316';

export default function ClientesSupervisor() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<CategoriaCliente | null>(null);
  const [estadoFiltro, setEstadoFiltro] = useState<'activos' | 'inactivos'>('activos');
  const [soloCitric, setSoloCitric] = useState(false);

  useEffect(() => {
    cargar();
  }, [estadoFiltro]);

  const cargar = async () => {
    setCargando(true);
    try {
      const res = await obtenerClientes(estadoFiltro);
      setClientes(res.data);
    } catch {}
    setCargando(false);
  };

  const clientesFiltrados = useMemo(() => {
    return clientes.filter((c) => {
      const coincideTexto = coincideBusqueda(
        busqueda,
        c.nombre, c.numero_cliente, c.direccion, c.rubro, c.razon_social, c.zona, c.departamento,
        c.telefono, c.email, c.contacto_nombre, c.cuit, c.notas
      );
      const coincideCategoria = !categoriaFiltro || c.categoria === categoriaFiltro;
      const coincideCitric = !soloCitric || esSoloCitric(c);
      return coincideTexto && coincideCategoria && coincideCitric;
    });
  }, [clientes, busqueda, categoriaFiltro, soloCitric]);

  if (cargando) return <View style={styles.center}><ActivityIndicator color={COLORS.supervisor} size="large" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <Text style={styles.total}>{clientesFiltrados.length} de {clientes.length} clientes</Text>
      </View>

      <View style={styles.filtros}>
        <Buscador valor={busqueda} onCambiar={setBusqueda} placeholder="Buscar por nombre, dirección, rubro, zona..." />
        <View style={styles.estadoFila}>
          {([
            { key: 'activos', label: 'Activos' },
            { key: 'inactivos', label: 'Inactivos' },
          ] as const).map((op) => {
            const activo = estadoFiltro === op.key;
            return (
              <TouchableOpacity
                key={op.key}
                style={[styles.estadoChip, activo && styles.estadoChipActivo]}
                onPress={() => setEstadoFiltro(op.key)}
              >
                <Text style={[styles.estadoChipTexto, activo && styles.estadoChipTextoActivo]}>{op.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.categoriasFila}>
          {(['A', 'B', 'C', 'D', 'E', 'F'] as CategoriaCliente[]).map((cat) => {
            const activo = categoriaFiltro === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoriaChip,
                  { borderColor: COLOR_CATEGORIA[cat] },
                  activo && { backgroundColor: COLOR_CATEGORIA[cat] },
                ]}
                onPress={() => setCategoriaFiltro(activo ? null : cat)}
              >
                <Text style={[styles.categoriaChipTexto, { color: activo ? '#fff' : COLOR_CATEGORIA[cat] }]}>{cat}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.estadoFila}>
          <TouchableOpacity
            style={[
              styles.citricChip,
              soloCitric && { backgroundColor: COLOR_CITRIC, borderColor: COLOR_CITRIC },
            ]}
            onPress={() => setSoloCitric((v) => !v)}
          >
            <Text style={[styles.citricChipTexto, soloCitric && { color: '#fff' }]}>
              🍊 Citric (exclusivo)
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={clientesFiltrados}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item }) => (
          <View style={[styles.card, !item.activo && styles.cardInactivo]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardNombre}>
                {item.nombre}
                {item.numero_cliente ? <Text style={styles.cardNumero}> · #{item.numero_cliente}</Text> : null}
              </Text>
              {item.categoria && (
                <View style={[styles.badge, { backgroundColor: COLOR_CATEGORIA[item.categoria] }]}>
                  <Text style={styles.badgeTexto}>{item.categoria}</Text>
                </View>
              )}
            </View>
            <Text style={styles.cardDir}>{item.direccion}</Text>
            {item.telefono && <Text style={styles.cardTel}>📞 {item.telefono}</Text>}
            {item.rubro && <Text style={styles.cardTel}>🏷️ {item.rubro}</Text>}
            {(item.departamento || item.zona) && (
              <Text style={styles.cardTel}>📍 {[item.departamento, item.zona].filter(Boolean).join(' · ')}</Text>
            )}
            {item.marcas?.length ? (
              <Text style={styles.cardTel}>🛒 Marcas: {item.marcas.join(', ')}</Text>
            ) : null}
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.vacio}>
            {estadoFiltro === 'inactivos' ? 'No hay clientes inactivos' : 'No se encontraron clientes con ese filtro'}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  total: { fontSize: 14, color: COLORS.text, fontWeight: '600' },
  filtros: { paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
  estadoFila: { flexDirection: 'row', gap: 8 },
  estadoChip: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: COLORS.card,
  },
  estadoChipActivo: { borderColor: COLORS.supervisor, backgroundColor: COLORS.supervisor },
  estadoChipTexto: { fontWeight: '700', fontSize: 13, color: COLORS.textLight },
  estadoChipTextoActivo: { color: '#fff' },
  categoriasFila: { flexDirection: 'row', gap: 8 },
  categoriaChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.card,
  },
  categoriaChipTexto: { fontWeight: '800', fontSize: 14 },
  citricChip: {
    borderWidth: 1.5,
    borderColor: COLOR_CITRIC,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: COLORS.card,
  },
  citricChipTexto: { fontWeight: '700', fontSize: 13, color: COLOR_CITRIC },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.supervisor,
  },
  cardInactivo: { borderLeftColor: COLORS.textLight, opacity: 0.7 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardNombre: { fontSize: 15, fontWeight: '700', color: COLORS.text, flex: 1 },
  cardNumero: { fontSize: 13, fontWeight: '400', color: COLORS.textLight },
  cardDir: { fontSize: 13, color: COLORS.textLight },
  cardTel: { fontSize: 12, color: COLORS.textLight },
  badge: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3, marginLeft: 8 },
  badgeTexto: { color: '#fff', fontWeight: '800', fontSize: 13 },
  vacio: { textAlign: 'center', color: COLORS.textLight, marginTop: 60, fontSize: 14 },
});
