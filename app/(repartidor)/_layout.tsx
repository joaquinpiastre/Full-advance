import { Tabs } from 'expo-router';
import { COLORS } from '../../constants';
import { Text } from 'react-native';

export default function RepartidorLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.primary },
        headerTintColor: '#fff',
        tabBarActiveTintColor: COLORS.repartidor,
        tabBarInactiveTintColor: COLORS.textLight,
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: COLORS.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🏠</Text>,
          headerTitle: 'Full Advance — Repartidor',
        }}
      />
      <Tabs.Screen
        name="jornada"
        options={{
          title: 'Jornada',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🚚</Text>,
          headerTitle: 'Jornada Activa',
        }}
      />
      <Tabs.Screen
        name="historial"
        options={{
          title: 'Historial',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📋</Text>,
          headerTitle: 'Mi Historial',
        }}
      />
      <Tabs.Screen
        name="ventas"
        options={{
          title: 'Ventas',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🔥</Text>,
          headerTitle: 'Venta Caliente',
          tabBarActiveTintColor: '#EA580C',
        }}
      />
    </Tabs>
  );
}
