import { useEffect, useRef } from 'react';
import { UbicacionLive } from '../types';
import { COLORS } from '../constants';
import { format } from 'date-fns';

const CENTER: [number, number] = [-34.6177, -68.3301]; // San Rafael, Mendoza

type MapState = { map: any; markers: any[]; L: any };

function dibujarMarcadores(state: MapState, ubicaciones: UbicacionLive[]) {
  const { map, L } = state;
  state.markers.forEach((m) => m.remove());
  state.markers = ubicaciones.map((u) => {
    const color = u.rol === 'repartidor' ? COLORS.repartidor : COLORS.preventista;
    const icono = L.divIcon({
      className: '',
      html: `<div style="background:${color};width:18px;height:18px;border-radius:50%;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
      popupAnchor: [0, -9],
    });
    const emoji = u.rol === 'repartidor' ? '🚚 Repartidor' : '👔 Preventista';
    return L.marker([u.lat, u.lng], { icon: icono })
      .addTo(map)
      .bindPopup(`<strong>${u.nombre}</strong><br>${emoji}<br>${format(new Date(u.timestamp), 'HH:mm:ss')}`);
  });
  if (ubicaciones.length > 1) {
    map.fitBounds(
      L.latLngBounds(ubicaciones.map((u) => [u.lat, u.lng])),
      { padding: [50, 50] }
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
