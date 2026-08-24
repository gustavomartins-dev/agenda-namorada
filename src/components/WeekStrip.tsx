import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getDayLabel, isTodayDate, toDateKey } from '@/utils/date';
import { colors, fonts, radii, spacing } from '@/theme/tokens';

type WeekStripProps = {
  days: Date[];
  selectedDate: string;
  eventCountByDate: Record<string, number>;
  onSelect: (dateKey: string) => void;
};

export function WeekStrip({
  days,
  selectedDate,
  eventCountByDate,
  onSelect,
}: WeekStripProps) {
  return (
    <View style={styles.container}>
      {days.map((day) => {
        const dateKey = toDateKey(day);
        const selected = selectedDate === dateKey;
        const eventCount = eventCountByDate[dateKey] ?? 0;

        return (
          <Pressable
            key={dateKey}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${getDayLabel(day)}, dia ${day.getDate()}${
              eventCount ? `, ${eventCount} compromissos` : ', sem compromissos'
            }`}
            onPress={() => {
              void Haptics.selectionAsync();
              onSelect(dateKey);
            }}
            style={({ pressed }) => [
              styles.day,
              selected && styles.daySelected,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.weekday, selected && styles.weekdaySelected]}>
              {getDayLabel(day).slice(0, 1)}
            </Text>
            <Text style={[styles.date, selected && styles.dateSelected]}>
              {day.getDate()}
            </Text>
            <View style={styles.indicatorSlot}>
              {eventCount > 0 ? (
                <View style={[styles.dot, selected && styles.dotSelected]} />
              ) : isTodayDate(day) ? (
                <View style={styles.todayRing} />
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 5,
    padding: 7,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(26, 17, 35, 0.82)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  day: {
    flex: 1,
    minHeight: 69,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    paddingVertical: spacing.xs,
  },
  daySelected: {
    backgroundColor: colors.primary,
  },
  weekday: {
    color: colors.textSubtle,
    fontFamily: fonts.bodyExtraBold,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  weekdaySelected: {
    color: colors.inkOnAccent,
  },
  date: {
    color: colors.text,
    fontFamily: fonts.displaySemiBold,
    fontSize: 17,
    lineHeight: 23,
  },
  dateSelected: {
    color: colors.inkOnAccent,
  },
  indicatorSlot: {
    height: 6,
    justifyContent: 'center',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.hotPink,
  },
  dotSelected: {
    backgroundColor: colors.inkOnAccent,
  },
  todayRing: {
    width: 5,
    height: 5,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.97 }],
  },
});
