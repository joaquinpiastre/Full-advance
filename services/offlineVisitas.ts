import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import { registrarParada, subirFoto, finalizarParada } from './api';

const STORAGE_KEY = 'visitas_pendientes_v1';
const INTERVALO_MS = 20000;

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
            // Error del servidor al subir esta foto puntual: la descartamos
            // pero seguimos con el resto de la visita y la finalizamos igual,
            // para no dejar la parada incompleta para siempre.
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
        // Error del servidor (ej. datos inválidos): descartamos esta visita
        // para no bloquear la sincronización de las demás.
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
