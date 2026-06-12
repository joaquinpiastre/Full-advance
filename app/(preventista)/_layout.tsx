import { Tabs } from 'expo-router';
import { COLORS } from '../../constants';
import { Text } from 'react-native';

export default function PreventistaLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.preventista },
        headerTintColor: '#fff',
        tabBarActiveTintColor: COLORS.preventista,
        tabBarInactiveTintColor: COLORS.textLight,
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: COLORS.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🏠</Text>,
          headerTitle: 'Full Advance — Preventista',
        }}
      />
      <Tabs.Screen
        name="ruta"
        options={{
          title: 'Mi Ruta',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🗺️</Text>,
          headerTitle: 'Ruta del Día',
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
      <Tabs.Screen
        name="noticias"
        options={{
          title: 'Noticias',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📰</Text>,
          headerTitle: 'Noticias',
        }}
      />
    </Tabs>
  );
}
