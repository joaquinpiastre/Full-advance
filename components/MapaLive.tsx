import { View, Text } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import { UbicacionLive } from '../types';
import { COLORS } from '../constants';
import { format } from 'date-fns';

export default function MapaLive({ ubicaciones }: { ubicaciones: UbicacionLive[] }) {
  return (
    <MapView
      style={{ flex: 1 }}
      initialRegion={{
        latitude: -34.6037,
        longitude: -58.3816,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }}
      showsUserLocation={false}
    >
      {ubicaciones.map((u) => (
        <Marker
          key={u.usuario_id}
          coordinate={{ latitude: u.lat, longitude: u.lng }}
          pinColor={u.rol === 'repartidor' ? COLORS.repartidor : COLORS.preventista}
        >
          <Callout>
            <View style={{ padding: 8 }}>
              <Text style={{ fontWeight: '700' }}>{u.nombre}</Text>
              <Text style={{ fontSize: 12, color: COLORS.textLight }}>
                {u.rol === 'repartidor' ? '🚚 Repartidor' : '👔 Preventista'}
              </Text>
              <Text style={{ fontSize: 11 }}>{format(new Date(u.timestamp), 'HH:mm:ss')}</Text>
            </View>
          </Callout>
        </Marker>
      ))}
    </MapView>
  );
}
