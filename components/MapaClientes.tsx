import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import { Cliente } from '../types';
import { COLORS, COLOR_CATEGORIA } from '../constants';

// San Rafael, Mendoza como centro inicial
const REGION_INICIAL = {
  latitude: -35.05,
  longitude: -68.5,
  latitudeDelta: 3.5,
  longitudeDelta: 3.5,
};

type Props = {
  clientes: Cliente[];
  onGeocodeAll: () => void;
  geocodificando: boolean;
  progreso: { actual: number; total: number };
  onAbrirFicha?: (cliente: Cliente) => void;
};

export default function MapaClientes({ clientes, onAbrirFicha }: Props) {
  const validos = clientes.filter((c) => c.lat != null && c.lng != null && !(c.lat === 0 && c.lng === 0));

  return (
    <MapView style={styles.mapa} initialRegion={REGION_INICIAL}>
      {validos.map((c) => (
        <Marker
          key={c.id}
          coordinate={{ latitude: c.lat, longitude: c.lng }}
          pinColor={c.activo === false ? '#000000' : c.categoria ? COLOR_CATEGORIA[c.categoria] : COLORS.primary}
        >
          <Callout style={styles.callout} onPress={() => onAbrirFicha?.(c)}>
            <Text style={styles.calloutNombre}>{c.nombre}</Text>
            {c.direccion ? <Text style={styles.calloutDato}>📍 {c.direccion}</Text> : null}
            {c.telefono ? <Text style={styles.calloutDato}>📞 {c.telefono}</Text> : null}
            {c.zona ? <Text style={styles.calloutDato}>{c.zona}</Text> : null}
            <Text style={styles.calloutLink}>Ver ficha completa</Text>
          </Callout>
        </Marker>
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  mapa: { flex: 1 },
  callout: { minWidth: 160, padding: 4 },
  calloutNombre: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  calloutDato: { fontSize: 12, color: COLORS.textLight },
  calloutLink: { fontSize: 12, color: COLORS.primary, fontWeight: '700', marginTop: 6 },
});
