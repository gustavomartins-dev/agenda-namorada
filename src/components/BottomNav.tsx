import * as Haptics from 'expo-haptics';
import { Tabs } from 'expo-router';
import { Bot, CalendarDays, Heart, Home, type LucideIcon } from 'lucide-react-native';
import { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  colors,
  fonts,
  MIN_TOUCH_SIZE,
  radii,
  shadows,
  spacing,
} from '@/theme/tokens';

type TabRoute = {
  key: string;
  name: string;
};

type TabBarRenderer = NonNullable<ComponentProps<typeof Tabs>['tabBar']>;
type BottomNavProps = Parameters<TabBarRenderer>[0];

const navMeta: Record<string, { label: string; icon: LucideIcon }> = {
  index: { label: 'Hoje', icon: Home },
  calendar: { label: 'Calendário', icon: CalendarDays },
  corner: { label: 'Cantinho', icon: Heart },
};

function NavItem({
  route,
  selected,
  navigation,
}: {
  route: TabRoute;
  selected: boolean;
  navigation: BottomNavProps['navigation'];
}) {
  const meta = navMeta[route.name] ?? navMeta.index;
  const Icon = meta.icon;

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={meta.label}
      onPress={() => {
        const event = navigation.emit({
          type: 'tabPress',
          target: route.key,
          canPreventDefault: true,
        });
        if (!selected && !event.defaultPrevented) {
          void Haptics.selectionAsync();
          navigation.navigate(route.name);
        }
      }}
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
    >
      <View style={[styles.iconWrap, selected && styles.iconWrapSelected]}>
        <Icon
          size={21}
          color={selected ? colors.softPink : colors.textSubtle}
          fill={selected && route.name === 'corner' ? colors.hotPink : 'transparent'}
          strokeWidth={selected ? 2.5 : 2}
        />
      </View>
      <Text style={[styles.label, selected && styles.labelSelected]}>{meta.label}</Text>
    </Pressable>
  );
}

export function BottomNav({ state, navigation }: BottomNavProps) {
  const insets = useSafeAreaInsets();
  const home = state.routes.find((route) => route.name === 'index') ?? state.routes[0];
  const calendar =
    state.routes.find((route) => route.name === 'calendar') ?? state.routes[0];
  const assistant =
    state.routes.find((route) => route.name === 'assistant') ?? state.routes[0];
  const corner =
    state.routes.find((route) => route.name === 'corner') ?? state.routes[0];
  const activeRoute = state.routes[state.index]?.name;

  return (
    <View style={[styles.shell, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.borderGlow} />
      <NavItem route={home} selected={activeRoute === home.name} navigation={navigation} />
      <NavItem
        route={calendar}
        selected={activeRoute === calendar.name}
        navigation={navigation}
      />

      <View style={styles.fabSlot}>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: activeRoute === assistant.name }}
          accessibilityLabel="Assistente"
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            navigation.navigate(assistant.name);
          }}
          style={({ pressed }) => [
            styles.fab,
            activeRoute === assistant.name && styles.fabSelected,
            pressed && styles.fabPressed,
          ]}
        >
          <Bot size={25} color={colors.inkOnAccent} strokeWidth={2.7} />
          <View style={styles.fabShine} />
        </Pressable>
        <Text
          style={[
            styles.fabLabel,
            activeRoute === assistant.name && styles.labelSelected,
          ]}
        >
          Assistente
        </Text>
      </View>

      <NavItem
        route={corner}
        selected={activeRoute === corner.name}
        navigation={navigation}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(20, 12, 28, 0.98)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 8,
    paddingHorizontal: spacing.sm,
  },
  borderGlow: {
    position: 'absolute',
    top: -1,
    width: 80,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(183, 120, 255, 0.3)',
  },
  item: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  iconWrap: {
    minWidth: 38,
    height: 30,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapSelected: {
    backgroundColor: 'rgba(183, 120, 255, 0.15)',
  },
  label: {
    color: colors.textSubtle,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
  },
  labelSelected: {
    color: colors.lavender,
  },
  itemPressed: {
    opacity: 0.62,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.canvasSoft,
    marginTop: -25,
    transform: [{ rotate: '8deg' }],
    ...shadows.glow,
  },
  fabSlot: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  fabSelected: {
    borderColor: colors.softPink,
  },
  fabLabel: {
    color: colors.textSubtle,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    marginTop: 1,
  },
  fabShine: {
    position: 'absolute',
    width: 12,
    height: 5,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
    top: 8,
    left: 11,
    transform: [{ rotate: '-20deg' }],
  },
  fabPressed: {
    opacity: 0.86,
    transform: [{ rotate: '4deg' }, { scale: 0.94 }],
  },
});
