import { Tabs } from 'expo-router';
import { COLORS } from '../../constants';
import { Ionicons } from '@expo/vector-icons';

type IconName = keyof typeof Ionicons.glyphMap;

const tabIcon = (active: IconName, inactive: IconName) =>
  ({ color, focused, size }: { color: string; focused: boolean; size: number }) => (
    <Ionicons name={focused ? active : inactive} size={size ?? 22} color={color} />
  );

export default function PreventistaLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.preventista, elevation: 0, shadowOpacity: 0 },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        tabBarActiveTintColor: COLORS.preventista,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: COLORS.divider,
          height: 62,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: tabIcon('home', 'home-outline'),
          headerTitle: 'Full Advance — Preventista',
        }}
      />
      <Tabs.Screen
        name="ruta"
        options={{
          title: 'Mi Ruta',
          tabBarIcon: tabIcon('list', 'list-outline'),
          headerTitle: 'Ruta del Día',
        }}
      />
      <Tabs.Screen
        name="mapa"
        options={{
          title: 'Mapa',
          tabBarIcon: tabIcon('location', 'location-outline'),
          headerTitle: 'Mapa de la Ruta',
        }}
      />
      <Tabs.Screen
        name="historial"
        options={{
          title: 'Historial',
          tabBarIcon: tabIcon('time', 'time-outline'),
          headerTitle: 'Mi Historial',
        }}
      />
      <Tabs.Screen
        name="ventas"
        options={{
          title: 'Ventas',
          tabBarIcon: tabIcon('flame', 'flame-outline'),
          headerTitle: 'Venta Caliente',
          tabBarActiveTintColor: COLORS.ventaCaliente,
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
      <Tabs.Screen
        name="pagos"
        options={{
          title: 'Pagos',
          tabBarIcon: tabIcon('cash', 'cash-outline'),
          headerTitle: 'Pagos y Cobranzas',
        }}
      />
    </Tabs>
  );
}
