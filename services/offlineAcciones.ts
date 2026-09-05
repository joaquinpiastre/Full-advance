import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { elegirRuta, actualizarOrdenRuta, agregarClienteExistenteARuta, crearCliente } from './api';

const STORAGE_KEY = 'acciones_pendientes_v1';
const INTERVALO_MS = 20000;

// Cuántas veces reintentamos una acción que el servidor rechaza con un error
// suyo (5xx). Con el ciclo de 20 s da ~10 minutos de tolerancia: alcanza para
// que el backend se reinicie o se termine de desplegar sin perder trabajo, y
// evita que una acción rota bloquee la cola para siempre.
const MAX_INTENTOS_SERVIDOR = 30;

export interface AccionElegirRuta {
  localId: string;
  tipo: 'elegir_ruta';
  payload: { ruta_id: number };
  creadoEn: number;
  intentos?: number;
}

export interface AccionReordenarRuta {
  localId: string;
  tipo: 'reordenar_ruta';
  payload: { ruta_id: number; clientes: number[] };
  creadoEn: number;
  intentos?: number;
}

export interface AccionAgregarClienteExistente {
  localId: string;
  tipo: 'agregar_cliente_existente';
  payload: { ruta_id: number; cliente_id: number };
  creadoEn: number;
  intentos?: number;
}

export interface AccionCrearCliente {
  localId: string;
  tipo: 'crear_cliente';
  payload: { datos: any; tempId: number };
  creadoEn: number;
  intentos?: number;
}

export type AccionPendiente =
  | AccionElegirRuta
  | AccionReordenarRuta
  | AccionAgregarClienteExistente
  | AccionCrearCliente;

// Se declara explícito (no vía Omit<AccionPendiente, ...>) para que TS
// conserve la correlación entre `tipo` y `payload` al angostar el tipo.
export type NuevaAccion =
  | { tipo: 'elegir_ruta'; payload: AccionElegirRuta['payload'] }
  | { tipo: 'reordenar_ruta'; payload: AccionReordenarRuta['payload'] }
  | { tipo: 'agregar_cliente_existente'; payload: AccionAgregarClienteExistente['payload'] }
  | { tipo: 'crear_cliente'; payload: AccionCrearCliente['payload'] };

let cola: AccionPendiente[] = [];
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

export function suscribirAccionesPendientes(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export async function obtenerAccionesPendientes(): Promise<AccionPendiente[]> {
  await cargarCola();
  return [...cola];
}

export async function encolarAccion(item: NuevaAccion) {
  await cargarCola();
  // Reordenar es "el último gana": si ya hay un reorden pendiente de la misma
  // ruta, lo reemplazamos en vez de apilar reórdenes intermedios.
  if (item.tipo === 'reordenar_ruta') {
    cola = cola.filter((a) => !(a.tipo === 'reordenar_ruta' && a.payload.ruta_id === item.payload.ruta_id));
  }
  const pendiente = {
    ...item,
    localId: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    creadoEn: Date.now(),
  } as AccionPendiente;
  cola.push(pendiente);
  await guardarCola();
  return pendiente.localId;
}

function esErrorDeRed(e: any) {
  return !e?.response;
}

// Un 5xx (o 408/429) no significa que la acción esté mal: el backend puede
// estar reiniciando o saturado. En esos casos conviene reintentar, no tirar el
// trabajo del usuario. Solo los 4xx "de verdad" (datos inválidos, ya existe,
// sin permiso) son definitivos.
function esErrorTemporalDelServidor(e: any) {
  const status = e?.response?.status;
  return status >= 500 || status === 408 || status === 429;
}

// Procesa la cola de acciones pendientes (elegir ruta, reordenar, agregar y
// crear cliente). Igual criterio que offlineVisitas: sin conexión se detiene y
// reintenta más tarde; con un error temporal del servidor reintenta hasta
// MAX_INTENTOS_SERVIDOR; con un rechazo definitivo (4xx) descarta esa acción
// puntual para no bloquear la sincronización del resto.
export async function procesarAccionesPendientes() {
  if (procesando) return;
  procesando = true;
  try {
    await cargarCola();
    let i = 0;
    while (i < cola.length) {
      const item = cola[i];
      try {
        if (item.tipo === 'elegir_ruta') {
          await elegirRuta(item.payload.ruta_id);
        } else if (item.tipo === 'reordenar_ruta') {
          await actualizarOrdenRuta(item.payload.ruta_id, item.payload.clientes);
        } else if (item.tipo === 'agregar_cliente_existente') {
          await agregarClienteExistenteARuta(item.payload.ruta_id, item.payload.cliente_id);
        } else if (item.tipo === 'crear_cliente') {
          // datos incluye client_uid: si el envío original sí había llegado al
          // servidor y solo se perdió la respuesta, el backend devuelve el
          // cliente ya creado en vez de duplicarlo.
          await crearCliente(item.payload.datos);
        }
        cola.splice(i, 1);
        await guardarCola();
      } catch (e: any) {
        if (esErrorDeRed(e)) {
          // Sin conexión: se reintenta en el próximo ciclo, sin perder nada.
          return;
        }
        if (esErrorTemporalDelServidor(e)) {
          item.intentos = (item.intentos ?? 0) + 1;
          if (item.intentos < MAX_INTENTOS_SERVIDOR) {
            // El backend está caído o reiniciando: dejamos la acción en la cola
            // y frenamos acá para no quemar los intentos de las demás.
            await guardarCola();
            return;
          }
        }
        // Rechazo definitivo del servidor (datos inválidos, ya existe, sin
        // permiso) o demasiados reintentos: descartamos esta acción para no
        // bloquear la sincronización de las demás.
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

export function iniciarSincronizacionAcciones() {
  if (iniciado) return;
  iniciado = true;
  procesarAccionesPendientes();
  setInterval(procesarAccionesPendientes, INTERVALO_MS);
  AppState.addEventListener('change', (estado) => {
    if (estado === 'active') procesarAccionesPendientes();
  });
}
