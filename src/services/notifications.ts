import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type {
  AgendaEvent,
  NotificationIssue,
} from '@/domain/agenda';
import { agendaWallTimeToDate } from '@/utils/timeZone';

const CHANNEL_ID = 'agenda-reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function configureNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Lembretes da agenda',
    description: 'Compromissos da Agenda da Nicolly',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250, 160, 250],
    lightColor: '#B778FF',
  });
}

async function hasNotificationPermission(): Promise<boolean> {
  await configureNotificationChannel();
  const current = await Notifications.getPermissionsAsync();
  if (
    current.granted ||
    current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  ) {
    return true;
  }
  const requested = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  return (
    requested.granted ||
    requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

export function getReminderDate(
  event: Pick<AgendaEvent, 'date' | 'startTime' | 'reminderMinutesBefore'>,
): Date | null {
  if (event.reminderMinutesBefore === null) return null;
  const startAt = agendaWallTimeToDate(event.date, event.startTime);
  if (!startAt) return null;
  return new Date(startAt.getTime() - event.reminderMinutesBefore * 60_000);
}

export async function cancelEventNotification(
  notificationId: string | null,
): Promise<boolean> {
  if (!notificationId || Platform.OS === 'web') return true;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    return true;
  } catch {
    return false;
  }
}

export async function scheduleEventNotification(
  event: Pick<
    AgendaEvent,
    'id' | 'title' | 'date' | 'startTime' | 'reminderMinutesBefore'
  >,
): Promise<{ notificationId: string | null; issue: NotificationIssue | null }> {
  if (event.reminderMinutesBefore === null) {
    return { notificationId: null, issue: null };
  }
  if (Platform.OS === 'web') {
    return { notificationId: null, issue: 'unsupported' };
  }
  const reminderAt = getReminderDate(event);
  if (!reminderAt || reminderAt.getTime() <= Date.now()) {
    return { notificationId: null, issue: 'past' };
  }

  try {
    if (!(await hasNotificationPermission())) {
      return { notificationId: null, issue: 'permission-denied' };
    }
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `💜 ${event.title}`,
        body: `Seu compromisso começa às ${event.startTime}.`,
        sound: 'default',
        data: { eventId: event.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderAt,
        channelId: CHANNEL_ID,
      },
    });
    return { notificationId, issue: null };
  } catch {
    return { notificationId: null, issue: 'schedule-failed' };
  }
}

export async function replaceEventNotification(
  previousNotificationId: string | null,
  event: Pick<
    AgendaEvent,
    'id' | 'title' | 'date' | 'startTime' | 'reminderMinutesBefore'
  >,
): Promise<{ notificationId: string | null; issue: NotificationIssue | null }> {
  const cancelled = await cancelEventNotification(previousNotificationId);
  if (!cancelled) {
    return { notificationId: previousNotificationId, issue: 'cancel-failed' };
  }
  return scheduleEventNotification(event);
}
