import { Tabs, router } from 'expo-router';
import { COLORS } from '../../constants';
import { Text, TouchableOpacity } from 'react-native';
import { useAuthStore } from '../../store/authStore';

export default function AdminLayout() {
  const { logout } = useAuthStore();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.primary },
        headerTintColor: '#fff',
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textLight,
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: COLORS.border },
        headerRight: () => (
          <TouchableOpacity
            onPress={() => { logout(); router.replace('/(auth)/login'); }}
            style={{ marginRight: 16 }}
          >
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Salir</Text>
          </TouchableOpacity>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Mapa',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🗺️</Text>,
          headerTitle: 'Mapa de Clientes',
        }}
      />
      <Tabs.Screen
        name="usuarios"
        options={{
          title: 'Usuarios',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🧑‍🤝‍🧑</Text>,
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
        name="estadisticas"
        options={{
          title: 'Estadísticas',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📈</Text>,
          headerTitle: 'Estadísticas de Clientes',
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
      <Tabs.Screen
        name="alertas"
        options={{
          title: 'Alertas',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🚨</Text>,
          headerTitle: 'Alertas — Urgentes y Vencimientos',
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
