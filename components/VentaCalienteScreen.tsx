import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList,
  ScrollView, ActivityIndicator, Image, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  obtenerVentaCalienteActiva, crearVentaCaliente, unirseVentaCaliente,
  obtenerVentaCaliente, iniciarVisitaVC, subirFoto, finalizarParada,
  finalizarVentaCaliente, obtenerRutas, obtenerEncuestasActivas,
} from '../services/api';
import { obtenerUbicacionRapida } from '../services/gps';
import { useAuthStore } from '../store/authStore';
import MercaderiaVencidaForm from './MercaderiaVencidaForm';
import AccionesList from './AccionesList';
import { calcularFechaVencimiento } from '../utils/vencimiento';
import { COLORS } from '../constants';
import { Cliente, Encuesta } from '../types';

const VC = COLORS.ventaCaliente;

type Pantalla = 'cargando' | 'inicio' | 'creando' | 'uniendo' | 'sesion' | 'formulario';

export default function VentaCalienteScreen() {
  const { usuario } = useAuthStore();
  const [pantalla, setPantalla] = useState<Pantalla>('cargando');
  const [sesion, setSesion] = useState<any>(null);
  const [rutas, setRutas] = useState<any[]>([]);
  const [rutaSel, setRutaSel] = useState<number | null>(null);
  const [codigoInput, setCodigoInput] = useState('');
  const [procesando, setProcesando] = useState(false);
  const enviandoRef = useRef(false);

  // Flujo de visita
  const [clienteActual, setClienteActual] = useState<any>(null);
  const [paradaActual, setParadaActual] = useState<any>(null);
  const [fotos, setFotos] = useState<(string | null)[]>([null, null, null, null, null]);
  // Formulario
  const [nota, setNota] = useState('');
  const [tieneVencidos, setTieneVencidos] = useState(false);
  const [mercaderiaVencida, setMercaderiaVencida] = useState('');
  const [fechaVencimiento, setFechaVencimiento] = useState<Date | null>(null);
  const [notaVencido, setNotaVencido] = useState('');
  const [urgente, setUrgente] = useState(false);
  const [urgenciaDesc, setUrgenciaDesc] = useState('');
  const [accionRequerida, setAccionRequerida] = useState(false);
  const [accionDesc, setAccionDesc] = useState<string[]>(['']);
  const [oportunidades, setOportunidades] = useState<string[]>(['']);
  const [respetaPvp, setRespetaPvp] = useState(true);
  const [motivoNoPvp, setMotivoNoPvp] = useState<string[]>(['']);
  const [encuestasActivas, setEncuestasActivas] = useState<Encuesta[]>([]);
  const [respuestasEncuestas, setRespuestasEncuestas] = useState<Record<number, boolean>>({});

  const cargarSesion = useCallback(async (silent = false) => {
    try {
      const res = await obtenerVentaCalienteActiva();
      if (res.data) {
        setSesion(res.data);
        if (!silent) setPantalla('sesion');
      } else {
        setSesion(null);
        if (!silent) setPantalla('inicio');
      }
    } catch {
      if (!silent) setPantalla('inicio');
    }
  }, []);

  useEffect(() => {
    cargarSesion();
  }, [cargarSesion]);

  // Auto-refresh de la sesión cada 12s mientras está activa
  useEffect(() => {
    if (pantalla !== 'sesion') return;
    const t = setInterval(() => cargarSesion(true), 12000);
    return () => clearInterval(t);
  }, [pantalla, cargarSesion]);

  // ── Crear sesión ──
  const abrirCrear = async () => {
    setProcesando(true);
    try {
      const res = await obtenerRutas();
      setRutas(res.data);
      setRutaSel(null);
      setPantalla('creando');
    } catch {
      Alert.alert('Error', 'No se pudieron cargar las rutas.');
    }
    setProcesando(false);
  };

  const confirmarCrear = async () => {
    if (!rutaSel) { Alert.alert('Seleccioná una ruta'); return; }
    setProcesando(true);
    try {
      const res = await crearVentaCaliente(rutaSel);
      setSesion(res.data);
      setPantalla('sesion');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? 'No se pudo crear la sesión');
    }
    setProcesando(false);
  };

  // ── Unirse ──
  const confirmarUnirse = async () => {
    if (codigoInput.trim().length !== 6) { Alert.alert('El código tiene 6 caracteres'); return; }
    setProcesando(true);
    try {
      const res = await unirseVentaCaliente(codigoInput.trim());
      setSesion(res.data);
      setPantalla('sesion');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? 'No se pudo unir');
    }
    setProcesando(false);
  };

  // ── Iniciar visita ──
  const iniciarVisita = async (cliente: any) => {
    if (!sesion) return;

    // Si ya hay una visita incompleta para este cliente, retomar desde formulario
    const visitaExistente = sesion.visitas?.find(
      (v: any) => v.cliente_id === cliente.id && !v.completada
    );
    if (visitaExistente) {
      setClienteActual(cliente);
      setParadaActual(visitaExistente);
      resetFormulario();
      cargarEncuestas(cliente);
      setPantalla('formulario');
      return;
    }

    setProcesando(true);
    try {
      const { lat, lng } = await obtenerUbicacionRapida();
      const res = await iniciarVisitaVC(sesion.id, { cliente_id: cliente.id, lat, lng });
      setParadaActual(res.data);
      setClienteActual(cliente);
      resetFormulario();
      cargarEncuestas(cliente);
      setPantalla('formulario');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? 'No se pudo iniciar la visita');
    }
    setProcesando(false);
  };

  const cargarEncuestas = (cliente: any) => {
    setEncuestasActivas([]);
    obtenerEncuestasActivas(cliente?.departamento)
      .then((res) => setEncuestasActivas(res.data ?? []))
      .catch(() => setEncuestasActivas([]));
  };

  const resetFormulario = () => {
    setNota('');
    setTieneVencidos(false); setMercaderiaVencida('');
    setFechaVencimiento(null); setNotaVencido('');
    setUrgente(false); setUrgenciaDesc('');
    setAccionRequerida(false); setAccionDesc(['']);
    setOportunidades(['']);
    setRespetaPvp(true); setMotivoNoPvp(['']);
    setRespuestasEncuestas({});
    setFotos([null, null, null, null, null]);
  };

  // ── Fotos ──
  const tomarFoto = async (index: number) => {
    try {
      const permiso = await ImagePicker.requestCameraPermissionsAsync();
      if (permiso.status !== 'granted') {
        Alert.alert(
          'Permiso de cámara',
          permiso.canAskAgain
            ? 'Necesitás permitir el acceso a la cámara.'
            : 'El permiso fue denegado permanentemente. Habilitalo en Ajustes.',
          [{ text: 'OK' }]
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.3, allowsEditing: false });
      if (result.canceled) return;
      const uri = result.assets[0].uri;
      setFotos((prev) => {
        const next = [...prev];
        next[index] = uri;
        return next;
      });
    } catch {
      Alert.alert('Error', 'No se pudo abrir la cámara. Verificá los permisos.');
    }
  };

  // ── Confirmar visita ──
  const confirmarVisita = async () => {
    if (enviandoRef.current) return;
    if (!paradaActual) {
      Alert.alert('Error', 'No se encontró la visita en curso. Volvé a iniciarla.');
      return;
    }
    enviandoRef.current = true;
    setProcesando(true);
    try {
      for (let i = 0; i < fotos.length; i++) {
        const uri = fotos[i];
        if (!uri) continue;
        const f = new FormData();
        f.append('foto', { uri, type: 'image/jpeg', name: `foto${i + 1}.jpg` } as any);
        f.append('numero', String(i + 1));
        await subirFoto(paradaActual.id, f);
      }
      await finalizarParada(paradaActual.id, {
        nota: nota.trim() || undefined,
        tiene_vencidos: tieneVencidos,
        mercaderia_vencida: tieneVencidos ? mercaderiaVencida.trim() || null : null,
        fecha_vencimiento: tieneVencidos ? calcularFechaVencimiento(fechaVencimiento) : null,
        nota_vencido: tieneVencidos ? notaVencido.trim() || null : null,
        urgente,
        urgencia_descripcion: urgente ? urgenciaDesc.trim() || null : null,
        accion_requerida: accionRequerida ? accionDesc.map((a) => a.trim()).filter(Boolean).join('\n') || null : null,
        oportunidades: oportunidades.map((o) => o.trim()).filter(Boolean).join('\n') || null,
        respeta_pvp: respetaPvp,
        motivo_no_pvp: !respetaPvp ? motivoNoPvp.map((m) => m.trim()).filter(Boolean).join('\n') || null : null,
        encuesta_respuestas: encuestasActivas.map((e) => ({ encuesta_id: e.id, respuesta: !!respuestasEncuestas[e.id] })),
      });
      setClienteActual(null);
      setParadaActual(null);
      await cargarSesion(true);
      setPantalla('sesion');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? 'No se pudo confirmar la visita. Probá de nuevo.');
    } finally {
      setProcesando(false);
      enviandoRef.current = false;
    }
  };

  // ── Finalizar sesión ──
  const pedirFinalizar = () => {
    Alert.alert('Finalizar sesión', '¿Terminar la sesión de Venta Caliente?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Finalizar', style: 'destructive', onPress: async () => {
          try {
            await finalizarVentaCaliente(sesion.id);
            setSesion(null);
            setPantalla('inicio');
          } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.error ?? 'Error al finalizar');
          }
        }
      }
    ]);
  };

  // ═══════════════════════════════════════════════
  //  RENDERS
  // ═══════════════════════════════════════════════

  if (pantalla === 'cargando') {
    return <View style={s.center}><ActivityIndicator color={VC} size="large" /></View>;
  }

  // ── Pantalla de inicio (sin sesión) ──
  if (pantalla === 'inicio') {
    return (
      <View style={s.container}>
        <View style={s.heroCard}>
          <Text style={s.heroEmoji}>🔥</Text>
          <Text style={s.heroTitulo}>Venta Caliente</Text>
          <Text style={s.heroDesc}>
            Modo de trabajo en equipo: 2 personas visitan clientes juntos para vender y entregar mercadería en el momento.
          </Text>
        </View>
        <TouchableOpacity style={s.btnCrear} onPress={abrirCrear} disabled={procesando}>
          {procesando ? <ActivityIndicator color="#fff" /> : (
            <>
              <Text style={s.btnCrearIcono}>➕</Text>
              <View>
                <Text style={s.btnCrearTitulo}>Crear nueva sesión</Text>
                <Text style={s.btnCrearDesc}>Elegís la ruta y generás un código para tu compañero</Text>
              </View>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={s.btnUnirse} onPress={() => { setCodigoInput(''); setPantalla('uniendo'); }}>
          <Text style={s.btnUnirseIcono}>🔑</Text>
          <View>
            <Text style={s.btnUnirseTitulo}>Unirme con código</Text>
            <Text style={s.btnUnirseDesc}>Tu compañero ya creó la sesión y te compartió el código</Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Selección de ruta para crear ──
  if (pantalla === 'creando') {
    return (
      <View style={s.container}>
        <View style={s.modalHeader}>
          <TouchableOpacity onPress={() => setPantalla('inicio')}>
            <Text style={s.back}>← Volver</Text>
          </TouchableOpacity>
          <Text style={s.modalTitulo}>Seleccioná la ruta</Text>
        </View>
        <FlatList
          data={rutas}
          keyExtractor={(r) => String(r.id)}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.rutaCard, rutaSel === item.id && s.rutaCardSel]}
              onPress={() => setRutaSel(item.id)}
            >
              <Text style={[s.rutaNombre, rutaSel === item.id && { color: '#fff' }]}>{item.nombre}</Text>
              {item.descripcion && (
                <Text style={[s.rutaDesc, rutaSel === item.id && { color: 'rgba(255,255,255,0.8)' }]}>
                  {item.descripcion}
                </Text>
              )}
              <Text style={[s.rutaClientes, rutaSel === item.id && { color: 'rgba(255,255,255,0.9)' }]}>
                {item.clientes?.length ?? 0} clientes
              </Text>
            </TouchableOpacity>
          )}
        />
        <View style={s.footer}>
          <TouchableOpacity
            style={[s.btnConfirmar, !rutaSel && { opacity: 0.4 }]}
            onPress={confirmarCrear}
            disabled={!rutaSel || procesando}
          >
            {procesando
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnConfirmarTexto}>🔥 Crear sesión</Text>}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Ingresar código para unirse ──
  if (pantalla === 'uniendo') {
    return (
      <View style={s.container}>
        <View style={s.modalHeader}>
          <TouchableOpacity onPress={() => setPantalla('inicio')}>
            <Text style={s.back}>← Volver</Text>
          </TouchableOpacity>
          <Text style={s.modalTitulo}>Ingresá el código</Text>
        </View>
        <View style={s.codigoCentro}>
          <Text style={s.codigoLabel}>Código de 6 caracteres</Text>
          <TextInput
            style={s.codigoInput}
            placeholder="ABC123"
            placeholderTextColor={COLORS.textLight}
            value={codigoInput}
            onChangeText={(t) => setCodigoInput(t.toUpperCase())}
            maxLength={6}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <Text style={s.codigoHint}>Tu compañero te comparte el código desde su sesión</Text>
          <TouchableOpacity
            style={[s.btnConfirmar, codigoInput.length !== 6 && { opacity: 0.4 }]}
            onPress={confirmarUnirse}
            disabled={codigoInput.length !== 6 || procesando}
          >
            {procesando
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnConfirmarTexto}>🔑 Unirme</Text>}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Panel de sesión activa ──
  if (pantalla === 'sesion' && sesion) {
    const clientes: any[] = sesion.ruta?.clientes ?? [];
    const visitas: any[] = sesion.visitas ?? [];
    const completas = visitas.filter((v: any) => v.completada).length;

    return (
      <View style={s.container}>
        {/* Encabezado de sesión */}
        <View style={s.sesionHeader}>
          <View style={s.sesionCodigoCaja}>
            <Text style={s.sesionCodigoLabel}>Código</Text>
            <Text style={s.sesionCodigo}>{sesion.codigo}</Text>
          </View>
          <View style={s.sesionInfo}>
            <Text style={s.sesionRuta}>🗺️ {sesion.ruta?.nombre}</Text>
            <Text style={s.sesionUsuarios}>
              👤 {sesion.creador?.nombre}
              {sesion.socio ? ` + ${sesion.socio.nombre}` : ' · esperando compañero...'}
            </Text>
            <View style={s.sesionBarra}>
              <View style={[
                s.sesionBarraFill,
                { width: clientes.length ? `${(completas / clientes.length) * 100}%` : '0%' }
              ]} />
            </View>
            <Text style={s.sesionProgreso}>{completas} / {clientes.length} visitados</Text>
          </View>
        </View>

        <FlatList
          data={clientes}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 12, gap: 8 }}
          renderItem={({ item, index }) => {
            const visita = visitas.find((v: any) => v.cliente_id === item.id);
            const visitado = visita?.completada;
            const enProgreso = visita && !visita.completada;
            return (
              <View style={[s.clienteCard, visitado && s.clienteCardVisitado]}>
                <View style={s.clienteOrden}>
                  <Text style={s.clienteOrdenNum}>{index + 1}</Text>
                </View>
                <View style={s.clienteInfo}>
                  <Text style={s.clienteNombre}>{item.nombre}</Text>
                  <Text style={s.clienteDir}>{item.direccion}</Text>
                  {item.telefono ? <Text style={s.clienteTel}>📞 {item.telefono}</Text> : null}
                </View>
                {visitado ? (
                  <Text style={s.visitadoCheck}>✓</Text>
                ) : enProgreso ? (
                  <TouchableOpacity
                    style={s.btnEnProgreso}
                    onPress={() => iniciarVisita(item)}
                  >
                    <Text style={s.btnEnProgresoTexto}>⏳{'\n'}Retomar</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[s.btnVisitar, procesando && { opacity: 0.5 }]}
                    onPress={() => iniciarVisita(item)}
                    disabled={procesando}
                  >
                    <Text style={s.btnVisitarTexto}>🔥{'\n'}Visitar</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
          ListEmptyComponent={<Text style={s.vacio}>La ruta no tiene clientes</Text>}
        />

        <View style={s.footer}>
          <TouchableOpacity style={s.btnFinalizar} onPress={pedirFinalizar}>
            <Text style={s.btnFinalizarTexto}>Finalizar sesión</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Flujo de visita (formulario) ──
  return (
    <View style={s.container}>
      {/* Header del cliente */}
      <View style={s.visitaHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.visitaCliente}>{clienteActual?.nombre}</Text>
          <Text style={s.visitaDir}>{clienteActual?.direccion}</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            Alert.alert('Cancelar visita', '¿Cancelar el registro de esta visita?', [
              { text: 'No', style: 'cancel' },
              { text: 'Sí, cancelar', style: 'destructive', onPress: () => {
                setClienteActual(null);
                setPantalla('sesion');
              }},
            ]);
          }}
        >
          <Text style={s.visitaCerrar}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Paso Formulario */}
      {pantalla === 'formulario' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.formularioContent} showsVerticalScrollIndicator={false}>
          {/* Fotos */}
          <Text style={s.pasoTitulo}>📷 Fotos (opcional)</Text>
          <Text style={s.informeDesc}>
            Tocá un casillero para sacar esa foto. Podés sacarlas en el orden que quieras, incluso al final.
          </Text>
          <View style={s.fotosGrid}>
            {fotos.map((f, i) => (
              <TouchableOpacity key={i} style={s.fotoSlot} onPress={() => tomarFoto(i)}>
                {f ? (
                  <Image source={{ uri: f }} style={s.fotoSlotImg} />
                ) : (
                  <Text style={s.fotoSlotIcono}>📷</Text>
                )}
                <View style={s.fotoSlotBadge}>
                  <Text style={s.fotoSlotBadgeTexto}>{i + 1}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Respeta PVP */}
          <TouchableOpacity
            style={[s.toggleRow, !respetaPvp && s.toggleRowPvp]}
            onPress={() => setRespetaPvp((v) => !v)}
            activeOpacity={0.7}
          >
            <Text style={s.toggleEmoji}>🏷️</Text>
            <Text style={[s.toggleLabel, !respetaPvp && { color: '#F59E0B', fontWeight: '700' }]}>
              Respeta PVP
            </Text>
            <View style={[s.toggleBubble, respetaPvp ? s.toggleBubbleSi : s.toggleBubblePvp]}>
              <Text style={s.toggleBubbleTexto}>{respetaPvp ? 'SÍ' : 'NO'}</Text>
            </View>
          </TouchableOpacity>
          {!respetaPvp && (
            <View style={[s.subForm, s.subFormPvp]}>
              <AccionesList
                acciones={motivoNoPvp}
                onChange={setMotivoNoPvp}
                label="¿Por qué no respeta el PVP?"
                placeholder="Ej: vende más caro / más barato que el precio sugerido..."
                agregarTexto="+ Agregar motivo"
                color="#F59E0B"
              />
            </View>
          )}

          {/* Mercadería vencida */}
          <TouchableOpacity
            style={[s.toggleRow, tieneVencidos && s.toggleRowVenc]}
            onPress={() => setTieneVencidos((v) => !v)}
            activeOpacity={0.7}
          >
            <Text style={s.toggleEmoji}>📦</Text>
            <Text style={s.toggleLabel}>Mercadería vencida</Text>
            <View style={[s.toggleBubble, tieneVencidos && { backgroundColor: '#F59E0B' }]}>
              <Text style={s.toggleBubbleTexto}>{tieneVencidos ? 'SÍ' : 'NO'}</Text>
            </View>
          </TouchableOpacity>
          {tieneVencidos && (
            <View style={s.subForm}>
              <MercaderiaVencidaForm
                mercaderia={mercaderiaVencida}
                onMercaderiaChange={setMercaderiaVencida}
                fecha={fechaVencimiento}
                onFechaChange={setFechaVencimiento}
                nota={notaVencido}
                onNotaChange={setNotaVencido}
              />
            </View>
          )}

          {/* Urgente */}
          <TouchableOpacity
            style={[s.toggleRow, urgente && s.toggleRowUrgente]}
            onPress={() => setUrgente((v) => !v)}
            activeOpacity={0.7}
          >
            <Text style={s.toggleEmoji}>🚨</Text>
            <Text style={[s.toggleLabel, urgente && { color: COLORS.danger, fontWeight: '700' }]}>
              Atención urgente requerida
            </Text>
            <View style={[s.toggleBubble, urgente && { backgroundColor: COLORS.danger }]}>
              <Text style={s.toggleBubbleTexto}>{urgente ? 'SÍ' : 'NO'}</Text>
            </View>
          </TouchableOpacity>
          {urgente && (
            <View style={[s.subForm, { borderColor: COLORS.danger }]}>
              <Text style={s.subLabel}>¿Qué necesita urgente?</Text>
              <TextInput
                style={[s.input, s.inputMulti]}
                placeholder="Ej: falta producto, problema..."
                placeholderTextColor={COLORS.textLight}
                value={urgenciaDesc}
                onChangeText={setUrgenciaDesc}
                multiline
              />
            </View>
          )}

          {/* Acciones para administración/supervisor */}
          <TouchableOpacity
            style={[s.toggleRow, accionRequerida && s.toggleRowAccion]}
            onPress={() => setAccionRequerida((v) => !v)}
            activeOpacity={0.7}
          >
            <Text style={s.toggleEmoji}>📋</Text>
            <Text style={[s.toggleLabel, accionRequerida && { color: COLORS.secondary, fontWeight: '700' }]}>
              Acciones
            </Text>
            <View style={[s.toggleBubble, accionRequerida && s.toggleBubbleAccion]}>
              <Text style={s.toggleBubbleTexto}>{accionRequerida ? 'SÍ' : 'NO'}</Text>
            </View>
          </TouchableOpacity>
          {accionRequerida && (
            <View style={[s.subForm, s.subFormAccion]}>
              <AccionesList acciones={accionDesc} onChange={setAccionDesc} />
            </View>
          )}

          {/* Oportunidades */}
          <View style={s.informeBox}>
            <Text style={s.informeTitulo}>💡 Oportunidades</Text>
            <Text style={s.informeDesc}>Registrá oportunidades de venta u otras observaciones</Text>
            <AccionesList
              acciones={oportunidades}
              onChange={setOportunidades}
              label=""
              placeholder="Ej: cliente interesado en nueva línea de productos..."
              agregarTexto="+ Agregar oportunidad"
              color="#1D4ED8"
            />
          </View>

          {/* Encuestas configurables por el admin */}
          {encuestasActivas.map((e) => {
            const valor = !!respuestasEncuestas[e.id];
            return (
              <TouchableOpacity
                key={e.id}
                style={[s.toggleRow, valor && s.toggleRowComerco]}
                onPress={() => setRespuestasEncuestas((prev) => ({ ...prev, [e.id]: !prev[e.id] }))}
                activeOpacity={0.7}
              >
                <Text style={s.toggleEmoji}>📊</Text>
                <Text style={[s.toggleLabel, valor && { color: COLORS.success, fontWeight: '700' }]}>
                  {e.pregunta}
                </Text>
                <View style={[s.toggleBubble, valor && s.toggleBubbleSi]}>
                  <Text style={s.toggleBubbleTexto}>{valor ? 'SÍ' : 'NO'}</Text>
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Nota */}
          <View>
            <Text style={s.subLabel}>Nota (opcional)</Text>
            <TextInput
              style={[s.input, s.inputMulti]}
              placeholder="Observaciones..."
              placeholderTextColor={COLORS.textLight}
              multiline
              value={nota}
              onChangeText={setNota}
            />
          </View>

          <TouchableOpacity
            style={[s.btnConfirmar, procesando && { opacity: 0.6 }]}
            onPress={confirmarVisita}
            disabled={procesando}
          >
            {procesando
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnConfirmarTexto}>✓ Confirmar visita</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Inicio
  heroCard: {
    backgroundColor: VC,
    margin: 16,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  heroEmoji: { fontSize: 48 },
  heroTitulo: { fontSize: 22, fontWeight: '800', color: '#fff' },
  heroDesc: { fontSize: 13, color: 'rgba(255,255,255,0.9)', textAlign: 'center', lineHeight: 18 },
  btnCrear: {
    backgroundColor: VC,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
  },
  btnCrearIcono: { fontSize: 28 },
  btnCrearTitulo: { fontSize: 16, fontWeight: '800', color: '#fff' },
  btnCrearDesc: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  btnUnirse: {
    backgroundColor: COLORS.card,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 2,
    borderColor: VC,
  },
  btnUnirseIcono: { fontSize: 28 },
  btnUnirseTitulo: { fontSize: 16, fontWeight: '800', color: VC },
  btnUnirseDesc: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },

  // Crear / Unirse
  modalHeader: {
    padding: 16,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  back: { fontSize: 14, color: VC, fontWeight: '600' },
  modalTitulo: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  rutaCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: COLORS.border,
    gap: 4,
  },
  rutaCardSel: { borderColor: VC, backgroundColor: VC },
  rutaNombre: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  rutaDesc: { fontSize: 12, color: COLORS.textLight },
  rutaClientes: { fontSize: 12, color: VC, fontWeight: '600' },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.card },
  btnConfirmar: {
    backgroundColor: VC,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  btnConfirmarTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },

  // Código
  codigoCentro: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
  codigoLabel: { fontSize: 14, fontWeight: '700', color: COLORS.textLight, textTransform: 'uppercase' },
  codigoInput: {
    backgroundColor: COLORS.card,
    borderWidth: 2,
    borderColor: VC,
    borderRadius: 14,
    padding: 18,
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    letterSpacing: 8,
  },
  codigoHint: { fontSize: 13, color: COLORS.textLight, textAlign: 'center' },

  // Sesión activa
  sesionHeader: {
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    padding: 14,
    gap: 12,
    alignItems: 'flex-start',
  },
  sesionCodigoCaja: {
    backgroundColor: VC,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    minWidth: 70,
  },
  sesionCodigoLabel: { fontSize: 9, color: 'rgba(255,255,255,0.8)', fontWeight: '700', textTransform: 'uppercase' },
  sesionCodigo: { fontSize: 20, fontWeight: '900', color: '#fff', letterSpacing: 3 },
  sesionInfo: { flex: 1, gap: 4 },
  sesionRuta: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  sesionUsuarios: { fontSize: 12, color: COLORS.textLight },
  sesionBarra: { height: 6, backgroundColor: COLORS.border, borderRadius: 3, marginTop: 4 },
  sesionBarraFill: { height: 6, backgroundColor: VC, borderRadius: 3 },
  sesionProgreso: { fontSize: 11, color: COLORS.textLight, fontWeight: '600' },

  // Clientes
  clienteCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderLeftWidth: 4,
    borderLeftColor: VC,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  clienteCardVisitado: { borderLeftColor: COLORS.success, opacity: 0.75 },
  clienteOrden: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: VC, justifyContent: 'center', alignItems: 'center',
  },
  clienteOrdenNum: { color: '#fff', fontWeight: '700', fontSize: 12 },
  clienteInfo: { flex: 1 },
  clienteNombre: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  clienteDir: { fontSize: 12, color: COLORS.textLight, marginTop: 1 },
  clienteTel: { fontSize: 11, color: COLORS.textLight, marginTop: 1 },
  visitadoCheck: { fontSize: 22, color: COLORS.success, fontWeight: '700' },
  btnVisitar: {
    backgroundColor: VC, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center',
  },
  btnVisitarTexto: { color: '#fff', fontWeight: '700', fontSize: 12, textAlign: 'center' },
  btnEnProgreso: {
    backgroundColor: '#FEF3C7', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center',
    borderWidth: 1, borderColor: '#F59E0B',
  },
  btnEnProgresoTexto: { color: '#92400E', fontWeight: '700', fontSize: 11, textAlign: 'center' },
  vacio: { textAlign: 'center', color: COLORS.textLight, marginTop: 40, fontSize: 14 },
  btnFinalizar: {
    backgroundColor: COLORS.card,
    borderRadius: 12, padding: 14, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.danger,
  },
  btnFinalizarTexto: { color: COLORS.danger, fontWeight: '700', fontSize: 15 },

  // Flujo de visita
  visitaHeader: {
    backgroundColor: VC,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  visitaCliente: { fontSize: 16, fontWeight: '800', color: '#fff' },
  visitaDir: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  visitaCerrar: { fontSize: 22, color: '#fff', fontWeight: '700', padding: 4 },
  pasoTitulo: { fontSize: 18, fontWeight: '800', color: VC },
  formularioContent: { padding: 16, gap: 12 },

  // Formulario toggles
  toggleRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 12, padding: 14, gap: 10,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  toggleRowVenc: { borderColor: '#F59E0B', backgroundColor: '#FFFBEB' },
  toggleRowUrgente: { borderColor: COLORS.danger, backgroundColor: '#FEF2F2' },
  toggleRowPvp: { borderColor: '#F59E0B', backgroundColor: '#FFFBEB' },
  toggleRowAccion: { borderColor: COLORS.secondary, backgroundColor: '#EFF6FF' },
  toggleRowComerco: { borderColor: COLORS.success, backgroundColor: '#F0FDF4' },
  toggleEmoji: { fontSize: 22 },
  toggleLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.text },
  toggleBubble: {
    backgroundColor: COLORS.border, borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  toggleBubbleSi: { backgroundColor: COLORS.success },
  toggleBubblePvp: { backgroundColor: '#F59E0B' },
  toggleBubbleAccion: { backgroundColor: COLORS.secondary },
  toggleBubbleTexto: { fontSize: 11, fontWeight: '800', color: '#fff' },
  subForm: {
    backgroundColor: COLORS.background, borderRadius: 10,
    padding: 12, gap: 6, borderWidth: 1, borderColor: '#F59E0B',
  },
  subFormPvp: { borderColor: '#F59E0B' },
  subFormAccion: { borderColor: COLORS.secondary },
  fotosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  fotoSlot: {
    width: 70, height: 70, borderRadius: 10,
    backgroundColor: COLORS.background,
    borderWidth: 1.5, borderColor: COLORS.border, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  fotoSlotImg: { width: '100%', height: '100%' },
  fotoSlotIcono: { fontSize: 24 },
  fotoSlotBadge: {
    position: 'absolute', top: 2, left: 2,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8,
    width: 16, height: 16, justifyContent: 'center', alignItems: 'center',
  },
  fotoSlotBadgeTexto: { color: '#fff', fontSize: 10, fontWeight: '700' },
  subLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textLight, textTransform: 'uppercase' },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    padding: 12, fontSize: 14, color: COLORS.text, backgroundColor: COLORS.card,
  },
  inputMulti: { minHeight: 70, textAlignVertical: 'top' },
  informeBox: {
    backgroundColor: '#EFF6FF', borderRadius: 12,
    padding: 14, gap: 6, borderWidth: 1, borderColor: '#BFDBFE',
  },
  informeTitulo: { fontSize: 14, fontWeight: '700', color: '#1D4ED8' },
  informeDesc: { fontSize: 12, color: '#3B82F6', marginBottom: 4 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7, backgroundColor: COLORS.card,
  },
  chipTexto: { fontSize: 13, fontWeight: '600', color: COLORS.textLight },
});
