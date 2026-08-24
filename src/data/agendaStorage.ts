import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  AgendaEvent,
  AgendaSnapshot,
  CategoryId,
  EMPTY_SNAPSHOT,
} from '@/domain/agenda';

const STORAGE_KEY = '@agenda-nicolly/snapshot';
const categories: CategoryId[] = ['personal', 'study', 'health', 'love'];

function isAgendaEvent(value: unknown): value is AgendaEvent {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const event = value as Partial<AgendaEvent>;
  return (
    typeof event.id === 'string' &&
    typeof event.title === 'string' &&
    typeof event.date === 'string' &&
    typeof event.startTime === 'string' &&
    typeof event.durationMinutes === 'number' &&
    categories.includes(event.category as CategoryId) &&
    typeof event.notes === 'string' &&
    (event.reminderMinutesBefore === null ||
      typeof event.reminderMinutesBefore === 'number') &&
    (event.notificationId === null || typeof event.notificationId === 'string') &&
    typeof event.completed === 'boolean' &&
    typeof event.createdAt === 'number' &&
    typeof event.updatedAt === 'number'
  );
}

export async function loadAgendaSnapshot(): Promise<AgendaSnapshot> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return EMPTY_SNAPSHOT;
    }

    const parsed = JSON.parse(raw) as Partial<AgendaSnapshot>;
    if (![1, 2].includes(parsed.schemaVersion ?? 0) || !Array.isArray(parsed.events)) {
      return EMPTY_SNAPSHOT;
    }

    const migratedEvents = parsed.events.map((event) => {
      if (!event || typeof event !== 'object') return event;
      return {
        ...event,
        reminderMinutesBefore:
          typeof (event as Partial<AgendaEvent>).reminderMinutesBefore === 'number'
            ? (event as Partial<AgendaEvent>).reminderMinutesBefore
            : null,
        notificationId:
          typeof (event as Partial<AgendaEvent>).notificationId === 'string'
            ? (event as Partial<AgendaEvent>).notificationId
            : null,
      };
    });

    return {
      schemaVersion: 2,
      events: migratedEvents.filter(isAgendaEvent),
      preferences: {
        loveNote:
          typeof parsed.preferences?.loveNote === 'string'
            ? parsed.preferences.loveNote
            : EMPTY_SNAPSHOT.preferences.loveNote,
        reduceMotion:
          typeof parsed.preferences?.reduceMotion === 'boolean'
            ? parsed.preferences.reduceMotion
            : false,
      },
    };
  } catch {
    return EMPTY_SNAPSHOT;
  }
}

export async function saveAgendaSnapshot(snapshot: AgendaSnapshot): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}
