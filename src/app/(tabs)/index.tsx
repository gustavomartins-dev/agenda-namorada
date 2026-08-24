import { useRouter } from 'expo-router';
import { AlertTriangle } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppScreen } from '@/components/AppScreen';
import { EmptyAgendaCard } from '@/components/EmptyAgendaCard';
import { EventCard } from '@/components/EventCard';
import { HeroCard } from '@/components/HeroCard';
import { LoveNoteCard } from '@/components/LoveNoteCard';
import { PageHeader } from '@/components/PageHeader';
import { SectionHeader } from '@/components/SectionHeader';
import { useAgenda } from '@/store/AgendaProvider';
import { colors, fonts, radii, spacing } from '@/theme/tokens';
import {
  eventSortValue,
  formatLongDate,
  formatShortDate,
  fromDateKey,
  getUpcomingDays,
  toDateKey,
} from '@/utils/date';
import { WeekStrip } from '@/components/WeekStrip';

export default function HomeScreen() {
  const router = useRouter();
  const {
    events,
    hydrated,
    preferences,
    storageError,
    toggleEvent,
  } = useAgenda();
  const today = useMemo(() => new Date(), []);
  const todayKey = toDateKey(today);
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const entrance = useRef(new Animated.Value(preferences.reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (!hydrated || preferences.reduceMotion) {
      entrance.setValue(1);
      return;
    }

    Animated.timing(entrance, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [entrance, hydrated, preferences.reduceMotion]);

  const sortedEvents = useMemo(
    () =>
      [...events].sort((a, b) =>
        eventSortValue(a.date, a.startTime).localeCompare(
          eventSortValue(b.date, b.startTime),
        ),
      ),
    [events],
  );

  const nextEvent = sortedEvents.find(
    (event) => !event.completed && event.date >= todayKey,
  );

  const selectedEvents = sortedEvents.filter((event) => event.date === selectedDate);
  const days = useMemo(() => getUpcomingDays(today), [today]);
  const eventCountByDate = useMemo(
    () =>
      events.reduce<Record<string, number>>((counts, event) => {
        counts[event.date] = (counts[event.date] ?? 0) + 1;
        return counts;
      }, {}),
    [events],
  );

  const openNewEvent = (date = selectedDate) => {
    router.push({ pathname: '/event/[id]', params: { id: 'new', date } });
  };

  if (!hydrated) {
    return (
      <AppScreen scroll={false}>
        <View style={styles.loading}>
          <View style={styles.loadingHeart}>
            <Text style={styles.loadingHeartText}>♥</Text>
          </View>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Preparando seu cantinho...</Text>
        </View>
      </AppScreen>
    );
  }

  const selectedDateObject = fromDateKey(selectedDate);

  return (
    <AppScreen contentContainerStyle={styles.screenContent}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: entrance,
            transform: [
              {
                translateY: entrance.interpolate({
                  inputRange: [0, 1],
                  outputRange: [12, 0],
                }),
              },
            ],
          },
        ]}
      >
        <PageHeader
          eyebrow="Agenda da Nicolly"
          showCornerShortcut
          subtitle={formatLongDate(today)}
          title="Oi, Nicolly 💜"
        />

        {storageError ? (
          <View accessibilityLiveRegion="polite" style={styles.errorBanner}>
            <AlertTriangle size={17} color={colors.warning} />
            <Text style={styles.errorText}>
              Não consegui salvar a última mudança. Tente novamente em instantes.
            </Text>
          </View>
        ) : null}

        <HeroCard nextEvent={nextEvent} onCreate={() => openNewEvent(todayKey)} />

        <View style={styles.sectionGap}>
          <SectionHeader
            subtitle="Escolha um dia para ver seus planos"
            title="Sua semana"
          />
          <WeekStrip
            days={days}
            eventCountByDate={eventCountByDate}
            onSelect={setSelectedDate}
            selectedDate={selectedDate}
          />
        </View>

        <View style={styles.sectionGap}>
          <SectionHeader
            actionLabel="Adicionar +"
            onAction={() => openNewEvent()}
            subtitle={
              selectedDate === todayKey
                ? 'Agora e depois'
                : formatShortDate(selectedDateObject)
            }
            title={selectedDate === todayKey ? 'Seu dia' : 'Planinhos do dia'}
          />

          <View style={styles.eventList}>
            {selectedEvents.length ? (
              selectedEvents.map((event) => (
                <EventCard
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
              <EmptyAgendaCard onCreate={() => openNewEvent()} />
            )}
          </View>
        </View>

        <View style={styles.sectionGap}>
          <LoveNoteCard note={preferences.loveNote} />
        </View>

        <Text style={styles.footerDoodle}>✦  ♥  ✦</Text>
      </Animated.View>
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
  sectionGap: {
    gap: spacing.sm,
  },
  eventList: {
    gap: spacing.sm,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255, 200, 107, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255, 200, 107, 0.25)',
    padding: spacing.sm,
  },
  errorText: {
    flex: 1,
    color: colors.warning,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    lineHeight: 17,
  },
  footerDoodle: {
    color: colors.borderBright,
    fontFamily: fonts.bodyBold,
    textAlign: 'center',
    letterSpacing: 6,
    marginTop: spacing.xs,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingHeart: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(183, 120, 255, 0.06)',
  },
  loadingHeartText: {
    color: 'rgba(183, 120, 255, 0.12)',
    fontSize: 82,
  },
  loadingText: {
    color: colors.textMuted,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
});
