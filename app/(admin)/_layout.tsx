import { Tabs } from 'expo-router';
import { COLORS } from '../../constants';
import { Text } from 'react-native';

export default function AdminLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.primary },
        headerTintColor: '#fff',
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textLight,
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: COLORS.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Mapa',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🗺️</Text>,
          headerTitle: 'Full Advance — Mapa en vivo',
        }}
      />
      <Tabs.Screen
        name="usuarios"
        options={{
          title: 'Usuarios',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🪪</Text>,
          headerTitle: 'Repartidores y Preventistas',
        }}
      />
      <Tabs.Screen
        name="asignaciones"
        options={{
          title: 'Asignaciones',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📋</Text>,
          headerTitle: 'Asignaciones',
        }}
      />
      <Tabs.Screen
        name="clientes"
        options={{
          title: 'Clientes',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>👥</Text>,
          headerTitle: 'Clientes',
        }}
      />
      <Tabs.Screen
        name="rutas"
        options={{
          title: 'Rutas',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🛣️</Text>,
          headerTitle: 'Rutas',
        }}
      />
      <Tabs.Screen
        name="historial"
        options={{
          title: 'Historial',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📊</Text>,
          headerTitle: 'Historial',
        }}
      />
    </Tabs>
  );
}
