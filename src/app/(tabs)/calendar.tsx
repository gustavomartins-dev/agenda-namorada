import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  addDays,
  addMonths,
  addWeeks,
  format,
  startOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarHeart,
  ChevronLeft,
  ChevronRight,
  Plus,
  Sparkles,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/AppScreen';
import { EmptyAgendaCard } from '@/components/EmptyAgendaCard';
import { EventCard } from '@/components/EventCard';
import { PageHeader } from '@/components/PageHeader';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SectionHeader } from '@/components/SectionHeader';
import { useAgenda } from '@/store/AgendaProvider';
import {
  colors,
  fonts,
  gradients,
  MIN_TOUCH_SIZE,
  radii,
  spacing,
} from '@/theme/tokens';
import {
  eventSortValue,
  formatLongDate,
  formatMonthTitle,
  fromDateKey,
  getDayLabel,
  getMonthGrid,
  getWeekDays,
  isSameDay,
  isSameMonth,
  isTodayDate,
  toDateKey,
} from '@/utils/date';

type CalendarMode = 'month' | 'week' | 'day';

const weekLabels = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

export default function CalendarScreen() {
  const router = useRouter();
  const { events, toggleEvent } = useAgenda();
  const today = useMemo(() => new Date(), []);
  const [mode, setMode] = useState<CalendarMode>('month');
  const [anchor, setAnchor] = useState(today);
  const [selectedDate, setSelectedDate] = useState(toDateKey(today));

  const eventsByDate = useMemo(
    () =>
      events.reduce<Record<string, number>>((counts, event) => {
        counts[event.date] = (counts[event.date] ?? 0) + 1;
        return counts;
      }, {}),
    [events],
  );

  const selectedEvents = useMemo(
    () =>
      events
        .filter((event) => event.date === selectedDate)
        .sort((a, b) =>
          eventSortValue(a.date, a.startTime).localeCompare(
            eventSortValue(b.date, b.startTime),
          ),
        ),
    [events, selectedDate],
  );

  const selectedDateObject = fromDateKey(selectedDate);
  const monthDays = useMemo(() => getMonthGrid(anchor), [anchor]);
  const weekDays = useMemo(() => getWeekDays(anchor), [anchor]);

  const movePeriod = (direction: -1 | 1) => {
    const next =
      mode === 'month'
        ? addMonths(anchor, direction)
        : mode === 'week'
          ? addWeeks(anchor, direction)
          : addDays(anchor, direction);
    setAnchor(next);
    setSelectedDate(toDateKey(next));
    void Haptics.selectionAsync();
  };

  const selectDay = (day: Date) => {
    setSelectedDate(toDateKey(day));
    setAnchor(day);
    void Haptics.selectionAsync();
  };

  const changeMode = (nextMode: CalendarMode) => {
    setMode(nextMode);
    setAnchor(selectedDateObject);
    void Haptics.selectionAsync();
  };

  const openNewEvent = () => {
    router.push({
      pathname: '/event/[id]',
      params: { id: 'new', date: selectedDate },
    });
  };

  const periodTitle =
    mode === 'month'
      ? formatMonthTitle(anchor)
      : mode === 'week'
        ? `${format(startOfWeek(anchor, { weekStartsOn: 1 }), 'd MMM', {
            locale: ptBR,
          })} — ${format(addDays(startOfWeek(anchor, { weekStartsOn: 1 }), 6), 'd MMM', {
            locale: ptBR,
          })}`
        : formatLongDate(anchor);

  return (
    <AppScreen contentContainerStyle={styles.screenContent}>
      <View style={styles.content}>
        <PageHeader
          eyebrow="Seu tempo, sua magia"
          subtitle="Veja tudo sem perder a leveza"
          title="Calendário mágico"
        />

        <View style={styles.modeSelector} accessibilityRole="tablist">
          {(
            [
              ['month', 'Mês'],
              ['week', 'Semana'],
              ['day', 'Dia'],
            ] as const
          ).map(([value, label]) => {
            const selected = mode === value;
            return (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                key={value}
                onPress={() => changeMode(value)}
                style={({ pressed }) => [
                  styles.modeButton,
                  selected && styles.modeButtonSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.modeText, selected && styles.modeTextSelected]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <Pressable
              accessibilityLabel="Período anterior"
              accessibilityRole="button"
              onPress={() => movePeriod(-1)}
              style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}
            >
              <ChevronLeft size={21} color={colors.lavender} />
            </Pressable>

            <View style={styles.periodTitleWrap}>
              <Sparkles size={15} color={colors.hotPink} />
              <Text numberOfLines={1} style={styles.periodTitle}>
                {periodTitle}
              </Text>
            </View>

            <Pressable
              accessibilityLabel="Próximo período"
              accessibilityRole="button"
              onPress={() => movePeriod(1)}
              style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}
            >
              <ChevronRight size={21} color={colors.lavender} />
            </Pressable>
          </View>

          {mode === 'month' ? (
            <>
              <View style={styles.weekLabels}>
                {weekLabels.map((label, index) => (
                  <Text key={`${label}-${index}`} style={styles.weekLabel}>
                    {label}
                  </Text>
                ))}
              </View>
              <View style={styles.monthGrid}>
                {monthDays.map((day) => {
                  const dateKey = toDateKey(day);
                  const selected = isSameDay(day, selectedDateObject);
                  const todayDate = isTodayDate(day);
                  const inMonth = isSameMonth(day, anchor);
                  const count = eventsByDate[dateKey] ?? 0;

                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`${formatLongDate(day)}${
                        count ? `, ${count} compromissos` : ', sem compromissos'
                      }`}
                      key={dateKey}
                      onPress={() => selectDay(day)}
                      style={({ pressed }) => [
                        styles.monthCell,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View
                        style={[
                          styles.dayNumberWrap,
                          todayDate && styles.todayWrap,
                          selected && styles.selectedDayWrap,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayNumber,
                            !inMonth && styles.outsideMonth,
                            todayDate && styles.todayText,
                            selected && styles.selectedDayText,
                          ]}
                        >
                          {day.getDate()}
                        </Text>
                      </View>
                      <View style={styles.dotRow}>
                        {Array.from({ length: Math.min(count, 3) }, (_, dotIndex) => (
                          <View
                            key={dotIndex}
                            style={[
                              styles.eventDot,
                              selected && styles.eventDotSelected,
                            ]}
                          />
                        ))}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          {mode === 'week' ? (
            <View style={styles.weekGrid}>
              {weekDays.map((day) => {
                const dateKey = toDateKey(day);
                const selected = isSameDay(day, selectedDateObject);
                const count = eventsByDate[dateKey] ?? 0;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={dateKey}
                    onPress={() => selectDay(day)}
                    style={({ pressed }) => [
                      styles.weekCell,
                      selected && styles.weekCellSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.weekDayName, selected && styles.weekTextSelected]}>
                      {getDayLabel(day)}
                    </Text>
                    <Text style={[styles.weekDayNumber, selected && styles.weekTextSelected]}>
                      {day.getDate()}
                    </Text>
                    <View style={[styles.countBadge, selected && styles.countBadgeSelected]}>
                      <Text style={[styles.countText, selected && styles.countTextSelected]}>
                        {count}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {mode === 'day' ? (
            <LinearGradient colors={gradients.hero} style={styles.dayHero}>
              <View style={styles.dayHeroIcon}>
                <CalendarHeart size={28} color={colors.softPink} />
              </View>
              <View style={styles.dayHeroCopy}>
                <Text style={styles.dayHeroWeekday}>
                  {format(selectedDateObject, 'EEEE', { locale: ptBR })}
                </Text>
                <Text style={styles.dayHeroNumber}>{selectedDateObject.getDate()}</Text>
                <Text style={styles.dayHeroMonth}>
                  {format(selectedDateObject, "'de' MMMM", { locale: ptBR })}
                </Text>
              </View>
              <View style={styles.dayHeroSummary}>
                <Text style={styles.dayHeroSummaryNumber}>{selectedEvents.length}</Text>
                <Text style={styles.dayHeroSummaryLabel}>
                  {selectedEvents.length === 1 ? 'planinho' : 'planinhos'}
                </Text>
              </View>
              <Text pointerEvents="none" style={styles.dayHeroHeart}>
                ♥
              </Text>
            </LinearGradient>
          ) : null}
        </View>

        <View style={styles.agendaSection}>
          <SectionHeader
            subtitle={formatLongDate(selectedDateObject)}
            title="Planos deste dia"
          />
          <View style={styles.eventList}>
            {selectedEvents.length ? (
              selectedEvents.map((event) => (
                <EventCard
                  compact
                  event={event}
                  key={event.id}
                  onPress={() =>
                    router.push({
                      pathname: '/event/[id]',
                      params: { id: event.id },
                    })
                  }
                  onToggle={() => toggleEvent(event.id)}
                />
              ))
            ) : (
              <EmptyAgendaCard
                description="Esse dia ainda está livre para o que der vontade."
                onCreate={openNewEvent}
                title="Nenhum plano por aqui"
              />
            )}
          </View>
          {selectedEvents.length ? (
            <PrimaryButton icon={Plus} label="Novo plano neste dia" onPress={openNewEvent} />
          ) : null}
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 132,
  },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    gap: spacing.xl,
  },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 5,
  },
  modeButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeButtonSelected: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderBright,
  },
  modeText: {
    color: colors.textSubtle,
    fontFamily: fonts.bodyBold,
    fontSize: 13,
  },
  modeTextSelected: {
    color: colors.lavender,
  },
  calendarCard: {
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    overflow: 'hidden',
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  navButton: {
    width: MIN_TOUCH_SIZE,
    height: MIN_TOUCH_SIZE,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  periodTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: spacing.xs,
  },
  periodTitle: {
    color: colors.text,
    fontFamily: fonts.displaySemiBold,
    fontSize: 17,
    textAlign: 'center',
  },
  weekLabels: {
    flexDirection: 'row',
    paddingBottom: spacing.xs,
  },
  weekLabel: {
    width: '14.2857%',
    color: colors.textSubtle,
    fontFamily: fonts.bodyExtraBold,
    fontSize: 10,
    textAlign: 'center',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  monthCell: {
    width: '14.2857%',
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  dayNumberWrap: {
    width: 34,
    height: 34,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayWrap: {
    borderWidth: 1,
    borderColor: colors.hotPink,
  },
  selectedDayWrap: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayNumber: {
    color: colors.text,
    fontFamily: fonts.bodyBold,
    fontSize: 13,
  },
  outsideMonth: {
    color: colors.textSubtle,
    opacity: 0.42,
  },
  todayText: {
    color: colors.softPink,
  },
  selectedDayText: {
    color: colors.inkOnAccent,
    fontFamily: fonts.bodyExtraBold,
    opacity: 1,
  },
  dotRow: {
    height: 5,
    flexDirection: 'row',
    gap: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.hotPink,
  },
  eventDotSelected: {
    backgroundColor: colors.inkOnAccent,
  },
  weekGrid: {
    flexDirection: 'row',
    gap: 5,
  },
  weekCell: {
    flex: 1,
    minHeight: 100,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: colors.canvasSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  weekCellSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  weekDayName: {
    color: colors.textSubtle,
    fontFamily: fonts.bodyExtraBold,
    fontSize: 9,
    textTransform: 'uppercase',
  },
  weekDayNumber: {
    color: colors.text,
    fontFamily: fonts.displaySemiBold,
    fontSize: 18,
  },
  weekTextSelected: {
    color: colors.inkOnAccent,
  },
  countBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  countBadgeSelected: {
    backgroundColor: 'rgba(23, 11, 29, 0.18)',
  },
  countText: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 9,
  },
  countTextSelected: {
    color: colors.inkOnAccent,
  },
  dayHero: {
    position: 'relative',
    overflow: 'hidden',
    minHeight: 180,
    borderRadius: radii.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayHeroIcon: {
    position: 'absolute',
    left: spacing.lg,
    top: spacing.lg,
  },
  dayHeroCopy: {
    flex: 1,
    alignItems: 'center',
  },
  dayHeroWeekday: {
    color: colors.softPink,
    fontFamily: fonts.bodyExtraBold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  dayHeroNumber: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 58,
    lineHeight: 62,
  },
  dayHeroMonth: {
    color: colors.lavender,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
  dayHeroSummary: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    alignItems: 'flex-end',
  },
  dayHeroSummaryNumber: {
    color: colors.hotPink,
    fontFamily: fonts.display,
    fontSize: 25,
  },
  dayHeroSummaryLabel: {
    color: colors.textMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
  },
  dayHeroHeart: {
    position: 'absolute',
    color: 'rgba(255,255,255,0.05)',
    fontSize: 120,
    right: -18,
    top: -28,
    transform: [{ rotate: '14deg' }],
  },
  agendaSection: {
    gap: spacing.sm,
  },
  eventList: {
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.68,
    transform: [{ scale: 0.97 }],
  },
});
