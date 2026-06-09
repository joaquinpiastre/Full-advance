import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Modal, ScrollView, Image,
} from 'react-native';
import {
  obtenerHistorialJornadas, obtenerDetalleJornada,
  obtenerUsuarios, obtenerVentasCalientesAdmin, obtenerVentaCaliente,
} from '../../services/api';
import { descargarFoto, descargarReporteJornada } from '../../services/descargas';
import { COLORS, urlFoto } from '../../constants';
import SelectorPersonas from '../../components/SelectorPersonas';
import { format, differenceInMinutes, isToday, isThisWeek, isThisMonth } from 'date-fns';
import { es } from 'date-fns/locale';

const VC = COLORS.ventaCaliente;

const RANGOS = [
  { key: 'todo', label: 'Todo' },
  { key: 'hoy', label: 'Hoy' },
  { key: 'semana', label: 'Semana' },
  { key: 'mes', label: 'Mes' },
] as const;
type RangoKey = typeof RANGOS[number]['key'];
type Tipo = 'jornadas' | 'vc';

const enRango = (fecha: string, rango: RangoKey) => {
  if (rango === 'todo') return true;
  const d = new Date(fecha);
  if (rango === 'hoy') return isToday(d);
  if (rango === 'semana') return isThisWeek(d, { weekStartsOn: 1 });
  return isThisMonth(d);
};

export default function HistorialAdmin() {
  const [tipo, setTipo] = useState<Tipo>('jornadas');
  const [jornadas, setJornadas] = useState<any[]>([]);
  const [sesionesVC, setSesionesVC] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [detalle, setDetalle] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [usuarioFiltro, setUsuarioFiltro] = useState<number | null>(null);
  const [rango, setRango] = useState<RangoKey>('todo');

  useEffect(() => {
    obtenerUsuarios().then((res) => setUsuarios(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setCargando(true);
    if (tipo === 'jornadas') {
      obtenerHistorialJornadas(usuarioFiltro ?? undefined)
        .then((res) => setJornadas(res.data))
        .catch(() => {})
        .finally(() => setCargando(false));
    } else {
      obtenerVentasCalientesAdmin(usuarioFiltro ?? undefined)
        .then((res) => setSesionesVC(res.data))
        .catch(() => {})
        .finally(() => setCargando(false));
    }
  }, [tipo, usuarioFiltro]);

  const verDetalleJornada = async (id: number) => {
    try {
      const res = await obtenerDetalleJornada(id);
      setDetalle({ tipo: 'jornada', ...res.data });
      setModalVisible(true);
    } catch {}
  };

  const verDetalleVC = async (id: number) => {
    try {
      const res = await obtenerVentaCaliente(id);
      setDetalle({ tipo: 'vc', ...res.data });
      setModalVisible(true);
    } catch {}
  };

  const jornadasFiltradas = useMemo(
    () => jornadas.filter((j) => enRango(j.fecha_inicio, rango)),
    [jornadas, rango]
  );
  const vcFiltradas = useMemo(
    () => sesionesVC.filter((s) => enRango(s.fecha, rango)),
    [sesionesVC, rango]
  );

  const personasNoAdmin = usuarios.filter((u) => u.rol !== 'admin');
  const lista = tipo === 'jornadas' ? jornadasFiltradas : vcFiltradas;
  const total = lista.length;

  return (
    <View style={styles.container}>
      {/* Selector de usuario */}
      {personasNoAdmin.length > 0 && (
        <View style={styles.filtroBar}>
          <SelectorPersonas
            personas={personasNoAdmin}
            seleccionado={usuarioFiltro}
            onSeleccionar={setUsuarioFiltro}
          />
        </View>
      )}

      {/* Tabs tipo */}
      <View style={styles.tipoBar}>
        <TouchableOpacity
          style={[styles.tipoTab, tipo === 'jornadas' && styles.tipoTabActivo]}
          onPress={() => setTipo('jornadas')}
        >
          <Text style={[styles.tipoTexto, tipo === 'jornadas' && styles.tipoTextoActivo]}>🚚 Jornadas</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tipoTab, tipo === 'vc' && { borderBottomColor: VC }]}
          onPress={() => setTipo('vc')}
        >
          <Text style={[styles.tipoTexto, tipo === 'vc' && { color: VC, fontWeight: '800' }]}>🔥 Venta Caliente</Text>
        </TouchableOpacity>
      </View>

      {/* Chips de rango + contador */}
      <View style={styles.rangoBar}>
        {RANGOS.map((r) => {
          const activo = rango === r.key;
          return (
            <TouchableOpacity
              key={r.key}
              style={[styles.rangoChip, activo && (tipo === 'vc' ? styles.rangoChipVC : styles.rangoChipActivo)]}
              onPress={() => setRango(r.key)}
            >
              <Text style={[styles.rangoTexto, activo && styles.rangoTextoActivo]}>{r.label}</Text>
            </TouchableOpacity>
          );
        })}
        <Text style={styles.total}>{total} {tipo === 'vc' ? 'sesión(es)' : 'jornada(s)'}</Text>
      </View>

      {cargando ? (
        <View style={styles.center}><ActivityIndicator color={tipo === 'vc' ? VC : COLORS.primary} size="large" /></View>
      ) : (
        <FlatList
          data={lista}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => {
            if (tipo === 'vc') {
              return (
                <TouchableOpacity
                  style={[styles.card, styles.cardVC]}
                  onPress={() => verDetalleVC(item.id)}
                >
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardNombre} numberOfLines={1}>
                        {item.creador.nombre}
                        {item.socio ? ` + ${item.socio.nombre}` : ''}
                      </Text>
                      <Text style={styles.cardRol}>
                        {item.creador.rol}{item.socio ? ` · ${item.socio.rol}` : ''}
                      </Text>
                    </View>
                    <View style={[styles.vcPill, !item.activa && styles.vcPillInactiva]}>
                      <Text style={styles.vcPillTexto}>{item.activa ? '🔥 ACTIVA' : '✓ FINALIZADA'}</Text>
                    </View>
                  </View>
                  <Text style={styles.cardFecha}>
                    {format(new Date(item.fecha), "EEEE d 'de' MMMM", { locale: es })}
                  </Text>
                  <Text style={styles.cardDato}>🗺️ {item.ruta ?? '—'}</Text>
                  <View style={styles.cardRow}>
                    <Text style={styles.cardDato}>Código: <Text style={{ fontWeight: '700', letterSpacing: 2 }}>{item.codigo}</Text></Text>
                    <Text style={[styles.cardParadas, { color: VC }]}>
                      {item.visitas.completas} / {item.visitas.total} visitas
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }

            const duracion = item.fecha_fin
              ? differenceInMinutes(new Date(item.fecha_fin), new Date(item.fecha_inicio))
              : null;
            const esRepartidor = item.usuario?.rol === 'repartidor';
            return (
              <TouchableOpacity
                style={[styles.card, { borderLeftColor: esRepartidor ? COLORS.repartidor : COLORS.preventista }]}
                onPress={() => verDetalleJornada(item.id)}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardNombre}>{item.usuario?.nombre}</Text>
                  <Text style={styles.cardRol}>
                    {esRepartidor ? '🚚' : '👔'} {item.usuario?.rol}
                  </Text>
                </View>
                <Text style={styles.cardFecha}>
                  {format(new Date(item.fecha_inicio), "EEEE d 'de' MMMM", { locale: es })}
                </Text>
                <View style={styles.cardRow}>
                  <Text style={styles.cardDato}>
                    🕐 {format(new Date(item.fecha_inicio), 'HH:mm')}
                    {item.fecha_fin ? ` → ${format(new Date(item.fecha_fin), 'HH:mm')}` : ' (en curso)'}
                  </Text>
                  {duracion !== null && <Text style={styles.cardDato}>⏱ {duracion} min</Text>}
                </View>
                <Text style={styles.cardParadas}>{item.total_paradas ?? 0} paradas</Text>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.vacio}>No hay {tipo === 'vc' ? 'sesiones de Venta Caliente' : 'jornadas'} para este filtro</Text>
          }
        />
      )}

      {/* Modal detalle */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              {detalle?.tipo === 'vc' ? (
                <>
                  <Text style={styles.modalTitulo}>🔥 Venta Caliente</Text>
                  <Text style={styles.modalSub}>
                    {detalle?.creador?.nombre}{detalle?.socio ? ` + ${detalle.socio.nombre}` : ''}
                    {' · '}{detalle?.ruta?.nombre}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.modalTitulo}>{detalle?.usuario?.nombre}</Text>
                  <Text style={styles.modalSub}>
                    {detalle?.fecha_inicio && format(new Date(detalle.fecha_inicio), "d 'de' MMMM yyyy", { locale: es })}
                  </Text>
                </>
              )}
            </View>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCerrar}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Botón PDF solo para jornadas */}
          {detalle?.tipo === 'jornada' && detalle && (
            <TouchableOpacity style={styles.btnPdf} onPress={() => descargarReporteJornada(detalle)}>
              <Text style={styles.btnPdfTexto}>📄 Descargar reporte en PDF</Text>
            </TouchableOpacity>
          )}

          <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
            {/* Detalle VC */}
            {detalle?.tipo === 'vc' && (
              <>
                <View style={styles.vcInfoCaja}>
                  <View style={styles.vcInfoFila}>
                    <Text style={styles.vcInfoLabel}>CÓDIGO</Text>
                    <Text style={styles.vcInfoValor}>{detalle.codigo}</Text>
                  </View>
                  <View style={styles.vcInfoFila}>
                    <Text style={styles.vcInfoLabel}>FECHA</Text>
                    <Text style={styles.vcInfoValor}>
                      {format(new Date(detalle.fecha), "d 'de' MMMM yyyy", { locale: es })}
                    </Text>
                  </View>
                  <View style={styles.vcInfoFila}>
                    <Text style={styles.vcInfoLabel}>ESTADO</Text>
                    <Text style={[styles.vcInfoValor, { color: detalle.activa ? VC : COLORS.success }]}>
                      {detalle.activa ? '🔥 Activa' : '✓ Finalizada'}
                    </Text>
                  </View>
                </View>
                {detalle.visitas?.map((v: any) => (
                  <View key={v.id} style={styles.paradaCard}>
                    <View style={styles.paradaHeaderRow}>
                      <Text style={styles.paradaNombre}>{v.cliente?.nombre ?? 'Sin cliente'}</Text>
                      {v.completada
                        ? <Text style={styles.vcVisitaOk}>✓ Completada</Text>
                        : <Text style={styles.vcVisitaPend}>⏳ Pendiente</Text>}
                    </View>
                    {v.cliente?.direccion ? <Text style={styles.paradaDireccion}>{v.cliente.direccion}</Text> : null}
                    {v.timestamp_llegada ? (
                      <Text style={styles.paradaHora}>
                        {format(new Date(v.timestamp_llegada), 'HH:mm')}
                        {v.timestamp_salida ? ` → ${format(new Date(v.timestamp_salida), 'HH:mm')}` : ''}
                      </Text>
                    ) : null}
                    {(v.foto1_uri || v.foto2_uri) && (
                      <View style={styles.fotosRow}>
                        {v.foto1_uri && (
                          <View>
                            <Text style={styles.fotoLabel}>Foto 1</Text>
                            <Image source={{ uri: urlFoto(v.foto1_uri) }} style={styles.foto} />
                            <TouchableOpacity style={styles.btnDescargar} onPress={() => descargarFoto(v.foto1_uri)}>
                              <Text style={styles.btnDescargarTexto}>📥 Guardar</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                        {v.foto2_uri && (
                          <View>
                            <Text style={styles.fotoLabel}>Foto 2</Text>
                            <Image source={{ uri: urlFoto(v.foto2_uri) }} style={styles.foto} />
                            <TouchableOpacity style={styles.btnDescargar} onPress={() => descargarFoto(v.foto2_uri)}>
                              <Text style={styles.btnDescargarTexto}>📥 Guardar</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    )}
                    {v.urgente && (
                      <View style={styles.vcUrgenteCaja}>
                        <Text style={styles.vcUrgenteTexto}>🚨 {v.urgencia_descripcion ?? 'Urgente'}</Text>
                      </View>
                    )}
                    {v.tiene_vencidos && v.mercaderia_vencida && (
                      <Text style={styles.vcVencText}>
                        📦 {v.mercaderia_vencida}
                        {v.fecha_vencimiento ? ` · ${v.fecha_vencimiento === 'Vencida' ? 'Ya vencida' : v.fecha_vencimiento}` : ''}
                      </Text>
                    )}
                    {v.nota ? <Text style={styles.nota}>📝 {v.nota}</Text> : null}
                  </View>
                ))}
              </>
            )}

            {/* Detalle jornada */}
            {detalle?.tipo === 'jornada' && detalle?.paradas?.map((p: any) => (
              <View key={p.id} style={styles.paradaCard}>
                <View style={styles.paradaHeaderRow}>
                  <Text style={styles.paradaNombre}>{p.cliente?.nombre ?? 'Sin cliente'}</Text>
                  <Text style={styles.paradaHora}>{format(new Date(p.timestamp_llegada), 'HH:mm')}</Text>
                </View>
                <Text style={styles.paradaDireccion}>{p.cliente?.direccion}</Text>
                {(p.foto1_uri || p.foto2_uri) && (
                  <View style={styles.fotosRow}>
                    {p.foto1_uri && (
                      <View>
                        <Text style={styles.fotoLabel}>Foto 1</Text>
                        <Image source={{ uri: urlFoto(p.foto1_uri) }} style={styles.foto} />
                        <TouchableOpacity style={styles.btnDescargar} onPress={() => descargarFoto(p.foto1_uri)}>
                          <Text style={styles.btnDescargarTexto}>📥 Guardar</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    {p.foto2_uri && (
                      <View>
                        <Text style={styles.fotoLabel}>Foto 2</Text>
                        <Image source={{ uri: urlFoto(p.foto2_uri) }} style={styles.foto} />
                        <TouchableOpacity style={styles.btnDescargar} onPress={() => descargarFoto(p.foto2_uri)}>
                          <Text style={styles.btnDescargarTexto}>📥 Guardar</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
                {p.nota ? <Text style={styles.nota}>📝 {p.nota}</Text> : null}
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  filtroBar: {
    backgroundColor: COLORS.card,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  // Tipo tabs
  tipoBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tipoTab: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tipoTabActivo: { borderBottomColor: COLORS.primary },
  tipoTexto: { fontSize: 14, fontWeight: '600', color: COLORS.textLight },
  tipoTextoActivo: { color: COLORS.primary, fontWeight: '800' },

  // Rango chips
  rangoBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  rangoChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 16, backgroundColor: COLORS.card,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  rangoChipActivo: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  rangoChipVC: { backgroundColor: VC, borderColor: VC },
  rangoTexto: { fontSize: 12, fontWeight: '600', color: COLORS.text },
  rangoTextoActivo: { color: '#fff' },
  total: { marginLeft: 'auto', fontSize: 12, color: COLORS.textLight, fontWeight: '600' },

  // Cards
  card: {
    backgroundColor: COLORS.card, borderRadius: 14, padding: 16, gap: 6,
    borderLeftWidth: 4, shadowColor: '#000', shadowOpacity: 0.05,
    shadowRadius: 6, elevation: 2,
  },
  cardVC: { borderLeftColor: VC },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardNombre: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  cardRol: { fontSize: 12, color: COLORS.textLight },
  cardFecha: { fontSize: 13, color: COLORS.text, textTransform: 'capitalize' },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardDato: { fontSize: 13, color: COLORS.textLight },
  cardParadas: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  vcPill: {
    backgroundColor: VC, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  vcPillInactiva: { backgroundColor: COLORS.success },
  vcPillTexto: { color: '#fff', fontSize: 10, fontWeight: '800' },

  vacio: { textAlign: 'center', color: COLORS.textLight, marginTop: 60, fontSize: 14 },

  // Modal
  modal: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, backgroundColor: COLORS.card,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  modalTitulo: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  modalSub: { fontSize: 13, color: COLORS.textLight, textTransform: 'capitalize', marginTop: 2 },
  modalCerrar: { fontSize: 20, color: COLORS.textLight },
  btnPdf: {
    margin: 16, marginBottom: 0, backgroundColor: COLORS.primary,
    borderRadius: 10, paddingVertical: 12, alignItems: 'center',
  },
  btnPdfTexto: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // VC info caja
  vcInfoCaja: {
    backgroundColor: COLORS.card, borderRadius: 12,
    padding: 14, gap: 10,
    borderLeftWidth: 3, borderLeftColor: VC,
  },
  vcInfoFila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  vcInfoLabel: { fontSize: 10, fontWeight: '800', color: COLORS.textLight, textTransform: 'uppercase' },
  vcInfoValor: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  vcVisitaOk: { fontSize: 12, fontWeight: '700', color: COLORS.success },
  vcVisitaPend: { fontSize: 12, fontWeight: '700', color: COLORS.warning },
  vcUrgenteCaja: { backgroundColor: '#FEF2F2', borderRadius: 8, padding: 8 },
  vcUrgenteTexto: { fontSize: 13, color: COLORS.danger, fontWeight: '600' },
  vcVencText: { fontSize: 13, color: COLORS.warning, fontWeight: '600' },

  // Paradas
  paradaCard: {
    backgroundColor: COLORS.card, borderRadius: 14, padding: 16, gap: 8,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  paradaHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  paradaNombre: { fontSize: 15, fontWeight: '700', color: COLORS.text, flex: 1 },
  paradaHora: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  paradaDireccion: { fontSize: 13, color: COLORS.textLight },
  fotosRow: { flexDirection: 'row', gap: 16 },
  fotoLabel: { fontSize: 11, color: COLORS.textLight, fontWeight: '600', marginBottom: 4 },
  foto: { width: 130, height: 130, borderRadius: 8 },
  btnDescargar: {
    marginTop: 6, backgroundColor: COLORS.background, borderRadius: 8,
    paddingVertical: 6, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  btnDescargarTexto: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  nota: { fontSize: 13, color: COLORS.text, fontStyle: 'italic' },
});
