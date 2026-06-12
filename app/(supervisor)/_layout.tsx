import { Tabs } from 'expo-router';
import { COLORS } from '../../constants';
import { Text } from 'react-native';

export default function SupervisorLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.supervisor },
        headerTintColor: '#fff',
        tabBarActiveTintColor: COLORS.supervisor,
        tabBarInactiveTintColor: COLORS.textLight,
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: COLORS.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🏠</Text>,
          headerTitle: 'Full Advance — Supervisor',
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
        name="alertas"
        options={{
          title: 'Alertas',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🚨</Text>,
          headerTitle: 'Alertas y Acciones',
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
