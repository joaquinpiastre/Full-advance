import { Tabs } from 'expo-router';
import { COLORS } from '../../constants';
import { Ionicons } from '@expo/vector-icons';

type IconName = keyof typeof Ionicons.glyphMap;

const tabIcon = (active: IconName, inactive: IconName) =>
  ({ color, focused, size }: { color: string; focused: boolean; size: number }) => (
    <Ionicons name={focused ? active : inactive} size={size ?? 22} color={color} />
  );

export default function SupervisorLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.supervisor, elevation: 0, shadowOpacity: 0 },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        tabBarActiveTintColor: COLORS.supervisor,
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
          headerTitle: 'Full Advance — Supervisor',
        }}
      />
      <Tabs.Screen
        name="ruta"
        options={{
          title: 'Equipo',
          tabBarIcon: tabIcon('radio', 'radio-outline'),
          headerTitle: 'Seguimiento en vivo',
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
        name="alertas"
        options={{
          title: 'Alertas',
          tabBarIcon: tabIcon('alert-circle', 'alert-circle-outline'),
          headerTitle: 'Alertas y Acciones',
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
    </Tabs>
  );
}
