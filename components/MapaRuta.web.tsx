import { View, Text, StyleSheet } from 'react-native';
import { Cliente } from '../types';
import { COLORS } from '../constants';

type Props = {
  clientes: Cliente[];
  visitados: Set<number>;
  color: string;
};

export default function MapaRuta(_props: Props) {
  return (
    <View style={styles.center}>
      <Text style={styles.texto}>El mapa no está disponible en la versión web.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  texto: { textAlign: 'center', color: COLORS.textLight, fontSize: 14 },
});
