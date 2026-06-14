import { Tabs, router } from 'expo-router';
import { COLORS } from '../../constants';
import { Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';

type IconName = keyof typeof Ionicons.glyphMap;

const tabIcon = (active: IconName, inactive: IconName) =>
  ({ color, focused, size }: { color: string; focused: boolean; size: number }) => (
    <Ionicons name={focused ? active : inactive} size={size ?? 22} color={color} />
  );

export default function AdminLayout() {
  const { logout } = useAuthStore();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.primary, elevation: 0, shadowOpacity: 0 },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: COLORS.divider,
          height: 62,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerRight: () => (
          <TouchableOpacity
            onPress={() => { logout(); router.replace('/(auth)/login'); }}
            style={{ marginRight: 16, flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <Ionicons name="log-out-outline" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Salir</Text>
          </TouchableOpacity>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Mapa',
          tabBarIcon: tabIcon('map', 'map-outline'),
          headerTitle: 'Mapa de Clientes',
        }}
      />
      <Tabs.Screen
        name="usuarios"
        options={{
          title: 'Usuarios',
          tabBarIcon: tabIcon('people', 'people-outline'),
          headerTitle: 'Repartidores y Preventistas',
        }}
      />
      <Tabs.Screen
        name="asignaciones"
        options={{
          title: 'Asignaciones',
          tabBarIcon: tabIcon('clipboard', 'clipboard-outline'),
          headerTitle: 'Asignaciones',
        }}
      />
      <Tabs.Screen
        name="clientes"
        options={{
          title: 'Clientes',
          tabBarIcon: tabIcon('business', 'business-outline'),
          headerTitle: 'Clientes',
        }}
      />
      <Tabs.Screen
        name="rutas"
        options={{
          title: 'Rutas',
          tabBarIcon: tabIcon('trail-sign', 'trail-sign-outline'),
          headerTitle: 'Rutas',
        }}
      />
      <Tabs.Screen
        name="estadisticas"
        options={{
          title: 'Estadísticas',
          tabBarIcon: tabIcon('stats-chart', 'stats-chart-outline'),
          headerTitle: 'Estadísticas de Clientes',
        }}
      />
      <Tabs.Screen
        name="historial"
        options={{
          title: 'Historial',
          tabBarIcon: tabIcon('time', 'time-outline'),
          headerTitle: 'Historial',
        }}
      />
      <Tabs.Screen
        name="alertas"
        options={{
          title: 'Alertas',
          tabBarIcon: tabIcon('alert-circle', 'alert-circle-outline'),
          headerTitle: 'Alertas — Urgentes y Vencimientos',
        }}
      />
      <Tabs.Screen
        name="noticias"
        options={{
          title: 'Noticias',
          tabBarIcon: tabIcon('newspaper', 'newspaper-outline'),
          headerTitle: 'Noticias',
        }}
      />
      <Tabs.Screen
        name="tareas"
        options={{
          title: 'Tareas',
          tabBarIcon: tabIcon('checkbox', 'checkbox-outline'),
          headerTitle: 'Tareas',
        }}
      />
    </Tabs>
  );
}
