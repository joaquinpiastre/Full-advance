import { useEffect, useRef } from 'react';
import { Cliente } from '../types';
import { COLORS, COLOR_CATEGORIA } from '../constants';

// Zona geográfica: San Rafael, Malargüe y General Alvear (Mendoza, Argentina)
const CENTER: [number, number] = [-35.05, -68.5];
const ZOOM_INICIAL = 9;
const MAX_BOUNDS: [[number, number], [number, number]] = [
  [-36.8, -71.0], // SO
  [-33.2, -66.0], // NE
];

type Props = {
  clientes: Cliente[];
  onGeocodeAll: () => void;
  geocodificando: boolean;
  progreso: { actual: number; total: number };
  onAbrirFicha?: (cliente: Cliente) => void;
};

type MapState = { map: any; markers: any[]; L: any };

function crearPopup(c: Cliente): string {
  const color = c.categoria ? COLOR_CATEGORIA[c.categoria] : COLORS.primary;
  const catBadge = c.categoria
    ? `<span style="display:inline-block;background:${color};color:#fff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:12px;margin-top:6px">Cat. ${c.categoria}</span>`
    : '';
  return `
    <div style="font-family:-apple-system,Helvetica,sans-serif;min-width:200px;max-width:270px;line-height:1.4">
      <div style="font-size:15px;font-weight:700;color:#1A1A2E;margin-bottom:3px">${c.nombre}</div>
      ${c.razon_social ? `<div style="font-size:12px;color:#6B7280;margin-bottom:5px">${c.razon_social}</div>` : ''}
      <div style="font-size:13px;margin-bottom:3px">📍 ${c.direccion}</div>
      ${(c.zona || c.departamento) ? `<div style="font-size:12px;color:#6B7280;margin-bottom:3px">${[c.departamento, c.zona].filter(Boolean).join(' · ')}</div>` : ''}
      ${c.telefono ? `<div style="font-size:13px;margin-bottom:3px">📞 ${c.telefono}</div>` : ''}
      ${c.rubro ? `<div style="font-size:12px;color:#6B7280;margin-bottom:2px">${c.rubro}</div>` : ''}
      ${c.contacto_nombre ? `<div style="font-size:12px;color:#6B7280">👤 ${c.contacto_nombre}</div>` : ''}
      ${c.forma_pago ? `<div style="font-size:12px;color:#6B7280;margin-top:2px">💳 ${c.forma_pago}</div>` : ''}
      ${catBadge}
      <div style="margin-top:8px">
        <button data-cliente-id="${c.id}" class="ver-ficha-btn" style="background:${COLORS.primary};color:#fff;border:none;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer">
          Ver ficha completa
        </button>
      </div>
    </div>
  `;
}

function actualizarMarcadores(state: MapState, clientes: Cliente[], onAbrirFicha?: (cliente: Cliente) => void) {
  const { map, L } = state;
  state.markers.forEach((m) => m.remove());
  const validos = clientes.filter((c) => c.lat && c.lng); // 0 y null son falsy
  state.markers = validos.map((c) => {
    const color = c.categoria ? COLOR_CATEGORIA[c.categoria] : COLORS.primary;
    const icon = L.divIcon({
      className: '',
      html: `<div style="background:${color};width:11px;height:11px;border-radius:50%;border:2px solid rgba(255,255,255,0.95);box-shadow:0 1px 5px rgba(0,0,0,.5);cursor:pointer;transition:transform .15s" title="${c.nombre}"></div>`,
      iconSize: [11, 11],
      iconAnchor: [5, 5],
      popupAnchor: [0, -7],
    });
    const marker = L.marker([c.lat, c.lng], { icon })
      .addTo(map)
      .bindPopup(crearPopup(c), { maxWidth: 290 });
    marker.on('popupopen', (e: any) => {
      const btn = e.popup.getElement()?.querySelector('.ver-ficha-btn');
      if (btn) btn.onclick = () => onAbrirFicha?.(c);
    });
    return marker;
  });
}

export default function MapaClientes({ clientes, onGeocodeAll, geocodificando, progreso, onAbrirFicha }: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<MapState | null>(null);
  const clientesRef = useRef(clientes);
  clientesRef.current = clientes;
  const onAbrirFichaRef = useRef(onAbrirFicha);
  onAbrirFichaRef.current = onAbrirFicha;

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
      const map = L.map(divRef.current, {
        maxBounds: MAX_BOUNDS,
        maxBoundsViscosity: 1.0,
        minZoom: 8,
      }).setView(CENTER, ZOOM_INICIAL);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      stateRef.current = { map, markers: [], L };
      actualizarMarcadores(stateRef.current, clientesRef.current, (c) => onAbrirFichaRef.current?.(c));
    }
    init().catch(() => {});
    return () => {
      cancelled = true;
      if (stateRef.current) { stateRef.current.map.remove(); stateRef.current = null; }
    };
  }, []);

  useEffect(() => {
    if (!stateRef.current) return;
    actualizarMarcadores(stateRef.current, clientes, (c) => onAbrirFichaRef.current?.(c));
  }, [clientes]);

  const sinCoords = clientes.filter((c) => !c.lat || !c.lng).length;
  const conCoords = clientes.length - sinCoords;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>

      {/* Barra superior */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '8px 16px', background: '#fff', borderBottom: '1px solid #E5E7EB',
        flexShrink: 0, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 13, color: '#6B7280', flex: 1, minWidth: 160 }}>
          {conCoords} {conCoords === 1 ? 'cliente' : 'clientes'} en el mapa
          {sinCoords > 0 ? ` · ${sinCoords} sin ubicación` : ''}
        </span>

        {/* Leyenda de categorías */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {(['A','B','C','D','E','F'] as const).map((cat) => (
            <span key={cat} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: COLOR_CATEGORIA[cat] }} />
              Cat. {cat}
            </span>
          ))}
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: COLORS.primary }} />
            Sin cat.
          </span>
        </div>

        {sinCoords > 0 && (
          <button
            onClick={() => !geocodificando && onGeocodeAll()}
            disabled={geocodificando}
            style={{
              background: geocodificando ? '#9CA3AF' : '#1A3A5C',
              color: '#fff', border: 'none', borderRadius: 8,
              cursor: geocodificando ? 'default' : 'pointer',
              padding: '7px 16px', fontSize: 12, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {geocodificando
              ? `⏳ Ubicando ${progreso.actual}/${progreso.total}...`
              : '📍 Ubicar clientes en el mapa'}
          </button>
        )}
      </div>

      {/* Mapa */}
      <div ref={divRef} style={{ flex: 1, minHeight: 400 }} />
    </div>
  );
}
