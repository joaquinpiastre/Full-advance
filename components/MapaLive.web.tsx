import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { UbicacionLive } from '../types';
import { COLORS } from '../constants';
import { format } from 'date-fns';

const crearIcono = (color: string) => L.divIcon({
  className: '',
  html: `<div style="background:${color};width:18px;height:18px;border-radius:50%;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -9],
});

const iconoRepartidor = crearIcono(COLORS.repartidor);
const iconoPreventista = crearIcono(COLORS.preventista);

export default function MapaLive({ ubicaciones }: { ubicaciones: UbicacionLive[] }) {
  return (
    <MapContainer
      center={[-34.6037, -58.3816]}
      zoom={12}
      style={{ flex: 1, width: '100%', height: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {ubicaciones.map((u) => (
        <Marker
          key={u.usuario_id}
          position={[u.lat, u.lng]}
          icon={u.rol === 'repartidor' ? iconoRepartidor : iconoPreventista}
        >
          <Popup>
            <strong>{u.nombre}</strong><br />
            {u.rol === 'repartidor' ? '🚚 Repartidor' : '👔 Preventista'}<br />
            {format(new Date(u.timestamp), 'HH:mm:ss')}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
