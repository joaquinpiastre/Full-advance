import { useEffect, useRef } from 'react';
import { UbicacionLive } from '../types';
import { COLORS } from '../constants';
import { format } from 'date-fns';

const CENTER: [number, number] = [-34.6177, -68.3301]; // San Rafael, Mendoza

type MapState = { map: any; markers: any[]; L: any };

function colorRol(rol: string) {
  if (rol === 'repartidor') return COLORS.repartidor;
  if (rol === 'supervisor') return COLORS.supervisor;
  return COLORS.preventista;
}

function emojiRol(rol: string) {
  if (rol === 'repartidor') return '🚚';
  if (rol === 'supervisor') return '🛡️';
  return '👔';
}

function labelRol(rol: string) {
  if (rol === 'repartidor') return 'Repartidor';
  if (rol === 'supervisor') return 'Supervisor';
  return 'Preventista';
}

function dibujarMarcadores(state: MapState, ubicaciones: UbicacionLive[]) {
  const { map, L } = state;
  state.markers.forEach((m) => m.remove());
  state.markers = ubicaciones.map((u) => {
    const color = colorRol(u.rol);
    const emoji = emojiRol(u.rol);
    const firstName = u.nombre.split(' ')[0];

    const icono = L.divIcon({
      className: '',
      html: `
        <div style="display:flex;flex-direction:column;align-items:center;gap:3px">
          <div style="
            background:${color};
            width:32px;height:32px;
            border-radius:50%;
            border:3px solid #fff;
            box-shadow:0 2px 8px rgba(0,0,0,.4);
            display:flex;align-items:center;justify-content:center;
            font-size:15px;line-height:1
          ">${emoji}</div>
          <div style="
            background:rgba(12,12,12,.82);
            color:#fff;
            font-size:10px;
            padding:2px 7px;
            border-radius:4px;
            white-space:nowrap;
            font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
            font-weight:700;
            letter-spacing:.3px;
            box-shadow:0 1px 4px rgba(0,0,0,.3);
            border:1px solid ${color}44
          ">${firstName}</div>
        </div>
      `,
      iconSize: [80, 52],
      iconAnchor: [40, 14],
      popupAnchor: [0, -14],
    });

    const hora = format(new Date(u.timestamp), 'HH:mm:ss');
    const popup = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-width:160px">
        <div style="font-weight:700;font-size:14px;color:#111;margin-bottom:3px">${u.nombre}</div>
        <div style="font-size:12px;color:#555;margin-bottom:6px">${emoji} ${labelRol(u.rol)}</div>
        <div style="
          font-size:11px;color:#888;
          display:flex;align-items:center;gap:5px
        ">
          <span style="
            width:7px;height:7px;border-radius:50%;
            background:${color};display:inline-block;flex-shrink:0
          "></span>
          Última señal: ${hora}
        </div>
      </div>
    `;

    return L.marker([u.lat, u.lng], { icon: icono })
      .addTo(map)
      .bindPopup(popup, { maxWidth: 240 });
  });

  if (ubicaciones.length > 1) {
    map.fitBounds(
      L.latLngBounds(ubicaciones.map((u) => [u.lat, u.lng])),
      { padding: [60, 60] }
    );
  } else if (ubicaciones.length === 1) {
    map.setView([ubicaciones[0].lat, ubicaciones[0].lng], 15);
  }
}

export default function MapaLive({ ubicaciones }: { ubicaciones: UbicacionLive[] }) {
  const divRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<MapState | null>(null);
  const ubicacionesRef = useRef(ubicaciones);
  ubicacionesRef.current = ubicaciones;

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
          if (document.querySelector('script[src*="leaflet@1.9"]')) {
            resolve();
            return;
          }
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          script.onload = () => resolve();
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      if (cancelled || !divRef.current) return;

      const L = (window as any).L;
      const map = L.map(divRef.current).setView(CENTER, 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      stateRef.current = { map, markers: [], L };
      dibujarMarcadores(stateRef.current, ubicacionesRef.current);
    }

    init().catch(() => {});

    return () => {
      cancelled = true;
      if (stateRef.current) {
        stateRef.current.map.remove();
        stateRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!stateRef.current) return;
    dibujarMarcadores(stateRef.current, ubicaciones);
  }, [ubicaciones]);

  return (
    <div
      ref={divRef as any}
      style={{ width: '100%', height: '100%', minHeight: 400 }}
    />
  );
}
