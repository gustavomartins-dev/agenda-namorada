import { Tabs } from 'expo-router';

import { BottomNav } from '@/components/BottomNav';
import { useAgenda } from '@/store/AgendaProvider';
import { colors } from '@/theme/tokens';

export default function TabsLayout() {
  const { preferences } = useAgenda();
  return (
    <Tabs
      backBehavior="history"
      tabBar={(props) => <BottomNav {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.canvas },
        animation: preferences.reduceMotion ? 'none' : 'fade',
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Hoje' }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendário' }} />
      <Tabs.Screen name="assistant" options={{ title: 'Assistente' }} />
      <Tabs.Screen name="corner" options={{ title: 'Cantinho' }} />
    </Tabs>
  );
}
