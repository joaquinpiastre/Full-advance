import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import MapView, { Marker, Polyline, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import { Cliente } from '../types';
import { COLORS } from '../constants';

// San Rafael, Mendoza como centro inicial
const REGION_INICIAL = {
  latitude: -35.05,
  longitude: -68.5,
  latitudeDelta: 3.5,
  longitudeDelta: 3.5,
};

type Props = {
  clientes: Cliente[];
  visitados: Set<number>;
  color: string;
};

export default function MapaRuta({ clientes, visitados, color }: Props) {
  const mapRef = useRef<MapView>(null);

  const validos = clientes.filter((c) => c.lat != null && c.lng != null && !(c.lat === 0 && c.lng === 0));

  useEffect(() => {
    if (!validos.length || !mapRef.current) return;
    const timeout = setTimeout(() => {
      mapRef.current?.fitToCoordinates(
        validos.map((c) => ({ latitude: c.lat, longitude: c.lng })),
        { edgePadding: { top: 60, right: 60, bottom: 60, left: 60 }, animated: true }
      );
    }, 400);
    return () => clearTimeout(timeout);
  }, [validos.length]);

  return (
    <MapView
      ref={mapRef}
      style={styles.mapa}
      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
      initialRegion={
        validos.length
          ? { latitude: validos[0].lat, longitude: validos[0].lng, latitudeDelta: 0.3, longitudeDelta: 0.3 }
          : REGION_INICIAL
      }
      showsUserLocation
      showsMyLocationButton
    >
      {validos.length > 1 && (
        <Polyline
          coordinates={validos.map((c) => ({ latitude: c.lat, longitude: c.lng }))}
          strokeColor={color}
          strokeWidth={4}
        />
      )}
      {validos.map((c, index) => {
        const visitado = visitados.has(c.id);
        return (
          <Marker
            key={c.id}
            coordinate={{ latitude: c.lat, longitude: c.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={[styles.pin, { backgroundColor: visitado ? COLORS.success : color }]}>
              <Text style={styles.pinTexto}>{visitado ? '✓' : index + 1}</Text>
            </View>
            <Callout style={styles.callout}>
              <Text style={styles.calloutNombre}>{index + 1}. {c.nombre}</Text>
              {c.direccion ? <Text style={styles.calloutDato}>📍 {c.direccion}</Text> : null}
              {c.telefono ? <Text style={styles.calloutDato}>📞 {c.telefono}</Text> : null}
              <Text style={[styles.calloutEstado, { color: visitado ? COLORS.success : color }]}>
                {visitado ? 'Visitado' : 'Pendiente'}
              </Text>
            </Callout>
          </Marker>
        );
      })}
    </MapView>
  );
}

const styles = StyleSheet.create({
  mapa: { flex: 1 },
  pin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  pinTexto: { color: '#fff', fontWeight: '800', fontSize: 13 },
  callout: { minWidth: 160, padding: 4 },
  calloutNombre: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  calloutDato: { fontSize: 12, color: COLORS.textLight },
  calloutEstado: { fontSize: 12, fontWeight: '700', marginTop: 6 },
});
