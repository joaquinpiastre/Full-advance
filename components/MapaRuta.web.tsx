import { useEffect, useRef } from 'react';
import { Cliente } from '../types';
import { COLORS } from '../constants';

// San Rafael, Mendoza como centro inicial
const CENTER: [number, number] = [-35.05, -68.5];
const ZOOM_INICIAL = 9;

type Props = {
  clientes: Cliente[];
  visitados: Set<number>;
  color: string;
};

type MapState = { map: any; markers: any[]; polyline: any; L: any };

function crearPopup(c: Cliente, index: number, visitado: boolean, color: string): string {
  return `
    <div style="font-family:-apple-system,Helvetica,sans-serif;min-width:160px;line-height:1.4">
      <div style="font-size:14px;font-weight:700;color:#1A1A2E;margin-bottom:3px">${index + 1}. ${c.nombre}</div>
      ${c.direccion ? `<div style="font-size:12px;color:#6B7280">📍 ${c.direccion}</div>` : ''}
      ${c.telefono ? `<div style="font-size:12px;color:#6B7280">📞 ${c.telefono}</div>` : ''}
      <div style="font-size:12px;font-weight:700;margin-top:6px;color:${visitado ? COLORS.success : color}">
        ${visitado ? 'Visitado' : 'Pendiente'}
      </div>
    </div>
  `;
}

function actualizarMapa(state: MapState, clientes: Cliente[], visitados: Set<number>, color: string) {
  const { map, L } = state;
  state.markers.forEach((m) => m.remove());
  if (state.polyline) state.polyline.remove();

  const validos = clientes.filter((c) => c.lat != null && c.lng != null && !(c.lat === 0 && c.lng === 0));

  state.markers = validos.map((c, index) => {
    const visitado = visitados.has(c.id);
    const markerColor = visitado ? COLORS.success : color;
    const icon = L.divIcon({
      className: '',
      html: `<div style="background:${markerColor};width:30px;height:30px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:13px">${visitado ? '✓' : index + 1}</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -15],
    });
    return L.marker([c.lat, c.lng], { icon })
      .addTo(map)
      .bindPopup(crearPopup(c, index, visitado, color));
  });

  if (validos.length > 1) {
    state.polyline = L.polyline(validos.map((c) => [c.lat, c.lng]), { color, weight: 4 }).addTo(map);
    map.fitBounds(L.latLngBounds(validos.map((c) => [c.lat, c.lng])), { padding: [60, 60] });
  } else if (validos.length === 1) {
    state.polyline = null;
    map.setView([validos[0].lat, validos[0].lng], 14);
  } else {
    state.polyline = null;
  }
}

export default function MapaRuta({ clientes, visitados, color }: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<MapState | null>(null);
  const clientesRef = useRef(clientes);
  clientesRef.current = clientes;
  const visitadosRef = useRef(visitados);
  visitadosRef.current = visitados;

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!document.querySelector('link[href*="leaflet@1.9"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }
      if (!(window as any).L) {
        await new Promise<void>((resolve, reject) => {
          if (document.querySelector('script[src*="leaflet@1.9"]')) { resolve(); return; }
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          script.onload = () => resolve();
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }
      if (cancelled || !divRef.current) return;
      const L = (window as any).L;
      const map = L.map(divRef.current).setView(CENTER, ZOOM_INICIAL);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      stateRef.current = { map, markers: [], polyline: null, L };
      actualizarMapa(stateRef.current, clientesRef.current, visitadosRef.current, color);
    }
    init().catch(() => {});
    return () => {
      cancelled = true;
      if (stateRef.current) { stateRef.current.map.remove(); stateRef.current = null; }
    };
  }, []);

  useEffect(() => {
    if (!stateRef.current) return;
    actualizarMapa(stateRef.current, clientes, visitados, color);
  }, [clientes, visitados, color]);

  return <div ref={divRef} style={{ width: '100%', height: '100%', minHeight: 400 }} />;
}
