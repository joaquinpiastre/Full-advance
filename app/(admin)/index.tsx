import { useState, useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { obtenerClientes, actualizarCoordenadas } from '../../services/api';
import MapaClientes from '../../components/MapaClientes';
import CartillaModal from '../../components/CartillaModal';
import { Cliente } from '../../types';
import { COLORS } from '../../constants';

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const UA = 'FullAdvance/1.0 (joacopiastre@gmail.com)';
const DELAY_MS = 1100;

async function geocodificar(c: Cliente): Promise<[number, number] | null> {
  const ciudad = c.departamento ?? 'San Rafael';
  const q = encodeURIComponent(`${c.direccion}, ${ciudad}, Mendoza, Argentina`);
  try {
    const res = await fetch(`${NOMINATIM}?q=${q}&format=json&limit=1&countrycodes=ar`, {
      headers: { 'User-Agent': UA },
    });
    const data = await res.json();
    if (!data.length) return null;
    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    // Descartar resultados fuera de la zona (Mendoza ≈ lat -32 a -37, lng -65 a -71)
    if (lat < -37 || lat > -32 || lng < -71 || lng > -65) return null;
    return [lat, lng];
  } catch {
    return null;
  }
}

export default function AdminMapa() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [geocodificando, setGeocodificando] = useState(false);
  const [progreso, setProgreso] = useState({ actual: 0, total: 0 });
  const [clienteFicha, setClienteFicha] = useState<Cliente | null>(null);
  const cancelRef = useRef(false);

  const cargar = async () => {
    setCargando(true);
    try {
      const res = await obtenerClientes();
      setClientes(res.data);
    } catch {}
    setCargando(false);
  };

  useEffect(() => {
    cargar();
    return () => { cancelRef.current = true; };
  }, []);

  const geocodeAll = async () => {
    const sinCoords = clientes.filter(
      (c) => !c.lat || !c.lng || (c.lat === 0 && c.lng === 0)
    );
    if (!sinCoords.length) return;

    cancelRef.current = false;
    setGeocodificando(true);
    setProgreso({ actual: 0, total: sinCoords.length });

    for (let i = 0; i < sinCoords.length; i++) {
      if (cancelRef.current) break;
      const cliente = sinCoords[i];
      const coords = await geocodificar(cliente);
      if (coords) {
        try {
          await actualizarCoordenadas(cliente.id, coords[0], coords[1]);
          setClientes((prev) =>
            prev.map((c) =>
              c.id === cliente.id ? { ...c, lat: coords[0], lng: coords[1] } : c
            )
          );
        } catch {}
      }
      setProgreso({ actual: i + 1, total: sinCoords.length });
      if (i < sinCoords.length - 1) {
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }
    }

    setGeocodificando(false);
  };

  if (cargando) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapaClientes
        clientes={clientes}
        onGeocodeAll={geocodeAll}
        geocodificando={geocodificando}
        progreso={progreso}
        onAbrirFicha={setClienteFicha}
      />
      <CartillaModal
        cliente={clienteFicha}
        visible={!!clienteFicha}
        onClose={() => setClienteFicha(null)}
        onGuardado={(actualizado) => {
          setClientes((prev) => prev.map((c) => (c.id === actualizado.id ? actualizado : c)));
          setClienteFicha(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
