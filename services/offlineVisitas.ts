import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import { registrarParada, subirFoto, finalizarParada } from './api';

const STORAGE_KEY = 'visitas_pendientes_v1';
const INTERVALO_MS = 20000;

// Cuántas veces reintentamos una visita que el servidor rechaza con un error
// suyo (5xx). Con el ciclo de 20 s da ~10 minutos de tolerancia: alcanza para
// que el backend se reinicie o se termine de desplegar sin perder el trabajo
// del día, y evita que una visita rota bloquee la cola para siempre.
const MAX_INTENTOS_SERVIDOR = 30;

export interface FinalizarDataPendiente {
  nota?: string;
  tiene_vencidos?: boolean;
  mercaderia_vencida?: string | null;
  fecha_vencimiento?: string | null;
  nota_vencido?: string | null;
  urgente?: boolean;
  urgencia_descripcion?: string | null;
  accion_requerida?: string | null;
  oportunidades?: string | null;
  respeta_pvp?: boolean | null;
  motivo_no_pvp?: string | null;
  encuesta_respuestas?: { encuesta_id: number; respuesta: boolean }[];
}

export interface FotoPendiente {
  numero: number;
  uri: string;
}

export interface VisitaPendiente {
  localId: string;
  jornada_id: number;
  cliente_id: number;
  cliente_nombre?: string;
  cliente_direccion?: string;
  lat: number;
  lng: number;
  parada_id?: number;
  fotos: FotoPendiente[];
  finalizar: FinalizarDataPendiente;
  creadoEn: number;
  intentos?: number;
  intentosFoto?: number;
}

let cola: VisitaPendiente[] = [];
let cargada = false;
let procesando = false;
const listeners = new Set<() => void>();

function notificar() {
  listeners.forEach((fn) => fn());
}

async function cargarCola() {
  if (cargada) return cola;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    cola = raw ? JSON.parse(raw) : [];
  } catch {
    cola = [];
  }
  cargada = true;
  return cola;
}

async function guardarCola() {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cola));
  } catch {}
  notificar();
}

export function suscribirVisitasPendientes(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export async function obtenerVisitasPendientes(jornada_id?: number): Promise<VisitaPendiente[]> {
  await cargarCola();
  return jornada_id ? cola.filter((v) => v.jornada_id === jornada_id) : [...cola];
}

export async function agregarVisitaPendiente(item: Omit<VisitaPendiente, 'localId' | 'creadoEn'>) {
  await cargarCola();
  const pendiente: VisitaPendiente = {
    ...item,
    localId: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    creadoEn: Date.now(),
  };
  cola.push(pendiente);
  await guardarCola();
  return pendiente.localId;
}

function esErrorDeRed(e: any) {
  return !e?.response;
}

// Un 5xx (o 408/429) no significa que la visita esté mal: el backend puede
// estar reiniciando o saturado. Conviene reintentar en vez de descartar el
// trabajo del repartidor. Solo los 4xx son rechazos definitivos.
function esErrorTemporalDelServidor(e: any) {
  const status = e?.response?.status;
  return status >= 500 || status === 408 || status === 429;
}

// Procesa la cola de visitas pendientes: registra la parada si falta,
// sube las fotos y finaliza. Si encuentra un error de red, se detiene
// (se reintentará más tarde). Si el error es del servidor al registrar la
// parada o finalizarla, descarta esa visita para no bloquear el resto; si es
// al subir una foto puntual, descarta solo esa foto pero sigue finalizando
// la visita (para que no quede una parada incompleta para siempre).
export async function procesarVisitasPendientes() {
  if (procesando) return;
  procesando = true;
  try {
    await cargarCola();
    let i = 0;
    while (i < cola.length) {
      const item = cola[i];
      try {
        if (!item.parada_id) {
          const res = await registrarParada({
            jornada_id: item.jornada_id,
            lat: item.lat,
            lng: item.lng,
            cliente_id: item.cliente_id,
          });
          item.parada_id = res.data.id;
          await guardarCola();
        }
        const paradaId: number = item.parada_id!;

        while (item.fotos.length) {
          const foto = item.fotos[0];
          try {
            const form = new FormData();
            if (Platform.OS === 'web') {
              // En web, foto.uri es una blob: URL del navegador; FormData
              // necesita el Blob real, no el objeto {uri,type,name} de RN.
              // Si la blob: URL ya no es válida (ej. se recargó la página),
              // no hay forma de recuperarla: se descarta solo esta foto.
              let blob: Blob;
              try {
                blob = await (await fetch(foto.uri)).blob();
              } catch {
                item.fotos.shift();
                await guardarCola();
                continue;
              }
              form.append('foto', blob, `foto${foto.numero}.jpg`);
            } else {
              form.append('foto', { uri: foto.uri, type: 'image/jpeg', name: `foto${foto.numero}.jpg` } as any);
            }
            form.append('numero', String(foto.numero));
            await subirFoto(paradaId, form);
          } catch (e: any) {
            if (esErrorDeRed(e)) {
              // Sin conexión: se reintenta esta foto en el próximo ciclo,
              // sin perder ni descartar el resto de la visita.
              return;
            }
            if (esErrorTemporalDelServidor(e)) {
              // Contador propio de las fotos, para no gastar los intentos que
              // le quedan a la visita en sí (registrar parada / finalizar).
              item.intentosFoto = (item.intentosFoto ?? 0) + 1;
              if (item.intentosFoto < MAX_INTENTOS_SERVIDOR) {
                // Backend caído: reintentamos esta foto más tarde en vez de
                // perderla.
                await guardarCola();
                return;
              }
            }
            // Rechazo definitivo (foto inválida, demasiado grande) o demasiados
            // reintentos: descartamos solo esta foto y seguimos finalizando la
            // visita, para no dejar la parada incompleta para siempre.
          }
          item.fotos.shift();
          await guardarCola();
        }

        await finalizarParada(paradaId, item.finalizar);
        cola.splice(i, 1);
        await guardarCola();
      } catch (e: any) {
        if (esErrorDeRed(e)) {
          // Sin conexión: se reintenta en el próximo ciclo.
          return;
        }
        if (esErrorTemporalDelServidor(e)) {
          item.intentos = (item.intentos ?? 0) + 1;
          if (item.intentos < MAX_INTENTOS_SERVIDOR) {
            // Backend caído o reiniciando: la visita queda en la cola y
            // frenamos acá para no quemar los intentos de las demás.
            await guardarCola();
            return;
          }
        }
        // Rechazo definitivo del servidor (datos inválidos) o demasiados
        // reintentos: descartamos esta visita para no bloquear las demás.
        cola.splice(i, 1);
        await guardarCola();
        continue;
      }
      i++;
    }
  } finally {
    procesando = false;
  }
}

let iniciado = false;

export function iniciarSincronizacionAutomatica() {
  if (iniciado) return;
  iniciado = true;
  procesarVisitasPendientes();
  setInterval(procesarVisitasPendientes, INTERVALO_MS);
  AppState.addEventListener('change', (estado) => {
    if (estado === 'active') procesarVisitasPendientes();
  });
}
