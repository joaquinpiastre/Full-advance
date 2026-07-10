import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import { UbicacionLive } from '../types';
import { COLORS } from '../constants';
import { format } from 'date-fns';

const CENTER = { latitude: -34.6177, longitude: -68.3301 }; // San Rafael, Mendoza

function colorRol(rol: string) {
  if (rol === 'repartidor') return COLORS.repartidor;
  if (rol === 'supervisor') return COLORS.supervisor;
  return COLORS.preventista;
}

function labelRol(rol: string) {
  if (rol === 'repartidor') return 'Repartidor';
  if (rol === 'supervisor') return 'Supervisor';
  return 'Preventista';
}

export default function MapaLive({ ubicaciones }: { ubicaciones: UbicacionLive[] }) {
  return (
    <MapView
      style={{ flex: 1 }}
      initialRegion={
        ubicaciones.length
          ? {
              latitude: ubicaciones[0].lat,
              longitude: ubicaciones[0].lng,
              latitudeDelta: 0.08,
              longitudeDelta: 0.08,
            }
          : { ...CENTER, latitudeDelta: 0.08, longitudeDelta: 0.08 }
      }
      showsUserLocation={false}
    >
      {ubicaciones.map((u) => {
        const color = colorRol(u.rol);
        const firstName = u.nombre.split(' ')[0];
        return (
          <Marker
            key={u.usuario_id}
            coordinate={{ latitude: u.lat, longitude: u.lng }}
          >
            {/* Custom marker: colored circle + name label */}
            <View style={styles.markerWrap}>
              <View style={[styles.markerDot, { backgroundColor: color }]}>
                <Text style={styles.markerEmoji}>
                  {u.rol === 'repartidor' ? '🚚' : u.rol === 'supervisor' ? '🛡️' : '👔'}
                </Text>
              </View>
              <View style={[styles.markerLabel, { borderColor: color }]}>
                <Text style={styles.markerLabelText}>{firstName}</Text>
              </View>
            </View>

            <Callout tooltip={false}>
              <View style={styles.callout}>
                <Text style={styles.calloutNombre}>{u.nombre}</Text>
                <Text style={styles.calloutRol}>{labelRol(u.rol)}</Text>
                <Text style={styles.calloutHora}>
                  Última señal: {format(new Date(u.timestamp), 'HH:mm:ss')}
                </Text>
              </View>
            </Callout>
          </Marker>
        );
      })}
    </MapView>
  );
}

const styles = StyleSheet.create({
  markerWrap: {
    alignItems: 'center',
  },
  markerDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 5,
  },
  markerEmoji: {
    fontSize: 16,
    lineHeight: 20,
  },
  markerLabel: {
    marginTop: 3,
    backgroundColor: 'rgba(10,10,10,0.78)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  markerLabelText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  callout: {
    padding: 10,
    minWidth: 160,
  },
  calloutNombre: {
    fontWeight: '700',
    fontSize: 14,
    color: '#111',
    marginBottom: 2,
  },
  calloutRol: {
    fontSize: 12,
    color: '#555',
    marginBottom: 4,
  },
  calloutHora: {
    fontSize: 11,
    color: '#888',
  },
});
