import * as Haptics from 'expo-haptics';
import {
  BookOpen,
  Check,
  ChevronRight,
  Heart,
  HeartPulse,
  Sparkles,
  type LucideIcon,
} from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AgendaEvent, CategoryId } from '@/domain/agenda';
import {
  categoryTheme,
  colors,
  fonts,
  MIN_TOUCH_SIZE,
  radii,
  spacing,
} from '@/theme/tokens';

const icons: Record<CategoryId, LucideIcon> = {
  personal: Sparkles,
  study: BookOpen,
  health: HeartPulse,
  love: Heart,
};

type EventCardProps = {
  event: AgendaEvent;
  onPress: () => void;
  onToggle: () => void;
  compact?: boolean;
};

export function EventCard({ event, onPress, onToggle, compact = false }: EventCardProps) {
  const category = categoryTheme[event.category];
  const Icon = icons[event.category];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Editar ${event.title}, às ${event.startTime}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        compact && styles.cardCompact,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={[styles.accent, { backgroundColor: category.color }]} />
      <View style={[styles.iconWrap, { backgroundColor: category.soft }]}>
        <Icon size={19} color={category.color} strokeWidth={2.2} />
      </View>

      <View style={styles.content}>
        <View style={styles.timeRow}>
          <Text style={[styles.time, { color: category.color }]}>{event.startTime}</Text>
          <View style={styles.tinyDot} />
          <Text style={styles.duration}>{event.durationMinutes} min</Text>
        </View>
        <Text
          numberOfLines={1}
          style={[styles.title, event.completed && styles.titleCompleted]}
        >
          {event.title}
        </Text>
        {!compact && event.notes ? (
          <Text numberOfLines={1} style={styles.notes}>
            {event.notes}
          </Text>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: event.completed }}
        accessibilityLabel={
          event.completed
            ? `Marcar ${event.title} como pendente`
            : `Marcar ${event.title} como concluído`
        }
        hitSlop={7}
        onPress={(pressEvent) => {
          pressEvent.stopPropagation();
          void Haptics.notificationAsync(
            event.completed
              ? Haptics.NotificationFeedbackType.Warning
              : Haptics.NotificationFeedbackType.Success,
          );
          onToggle();
        }}
        style={({ pressed }) => [
          styles.check,
          event.completed && styles.checkActive,
          pressed && styles.checkPressed,
        ]}
      >
        {event.completed ? (
          <Check size={17} color={colors.inkOnAccent} strokeWidth={3} />
        ) : null}
      </Pressable>
      <ChevronRight size={16} color={colors.textSubtle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardCompact: {
    minHeight: 78,
    paddingVertical: spacing.sm,
  },
  accent: {
    position: 'absolute',
    left: 0,
    top: 18,
    bottom: 18,
    width: 3,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  time: {
    fontFamily: fonts.bodyExtraBold,
    fontSize: 11,
    letterSpacing: 0.3,
  },
  tinyDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.textSubtle,
  },
  duration: {
    color: colors.textSubtle,
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    lineHeight: 20,
    marginTop: 2,
  },
  titleCompleted: {
    color: colors.textSubtle,
    textDecorationLine: 'line-through',
  },
  notes: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 1,
  },
  check: {
    width: MIN_TOUCH_SIZE,
    height: MIN_TOUCH_SIZE,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.borderBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkActive: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  checkPressed: {
    transform: [{ scale: 0.9 }],
  },
  cardPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.986 }],
  },
});
