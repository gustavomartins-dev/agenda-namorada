import { beforeEach, describe, expect, it, vi } from 'vitest';

const notificationMocks = vi.hoisted(() => ({
  cancel: vi.fn(),
  channel: vi.fn(),
  getPermissions: vi.fn(),
  requestPermissions: vi.fn(),
  schedule: vi.fn(),
  setHandler: vi.fn(),
}));

vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 4 },
  IosAuthorizationStatus: { PROVISIONAL: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  cancelScheduledNotificationAsync: notificationMocks.cancel,
  getPermissionsAsync: notificationMocks.getPermissions,
  requestPermissionsAsync: notificationMocks.requestPermissions,
  scheduleNotificationAsync: notificationMocks.schedule,
  setNotificationChannelAsync: notificationMocks.channel,
  setNotificationHandler: notificationMocks.setHandler,
}));

import {
  cancelEventNotification,
  getReminderDate,
  replaceEventNotification,
  scheduleEventNotification,
} from './notifications';

const event = {
  id: 'dentist-1',
  title: 'Dentista',
  date: '2030-08-30',
  startTime: '15:00',
  reminderMinutesBefore: 60,
};

describe('lembretes locais', () => {
  beforeEach(() => {
    notificationMocks.getPermissions.mockResolvedValue({ granted: true });
    notificationMocks.schedule.mockResolvedValue('notification-new');
    notificationMocks.cancel.mockResolvedValue(undefined);
    notificationMocks.channel.mockResolvedValue(undefined);
  });

  it('calcula o horário do lembrete antes do evento em São Paulo', () => {
    expect(getReminderDate(event)?.toISOString()).toBe('2030-08-30T17:00:00.000Z');
  });

  it('agenda e devolve o identificador que será persistido', async () => {
    const result = await scheduleEventNotification(event);
    expect(result).toEqual({ notificationId: 'notification-new', issue: null });
    expect(notificationMocks.schedule).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({ data: { eventId: 'dentist-1' } }),
      }),
    );
  });

  it('cancela o lembrete anterior antes de reagendar uma edição', async () => {
    await replaceEventNotification('notification-old', event);
    expect(notificationMocks.cancel).toHaveBeenCalledWith('notification-old');
    expect(notificationMocks.cancel.mock.invocationCallOrder[0]).toBeLessThan(
      notificationMocks.schedule.mock.invocationCallOrder[0],
    );
  });

  it('cancela uma notificação quando o evento é excluído', async () => {
    await expect(cancelEventNotification('notification-old')).resolves.toBe(true);
    expect(notificationMocks.cancel).toHaveBeenCalledWith('notification-old');
  });

  it('não agenda um segundo alarme se o cancelamento anterior falhar', async () => {
    notificationMocks.cancel.mockRejectedValueOnce(new Error('native failure'));
    await expect(
      replaceEventNotification('notification-old', event),
    ).resolves.toEqual({
      notificationId: 'notification-old',
      issue: 'cancel-failed',
    });
    expect(notificationMocks.schedule).not.toHaveBeenCalled();
  });

  it('recusa lembrete que já ficou no passado', async () => {
    const result = await scheduleEventNotification({
      ...event,
      date: '2020-01-01',
    });
    expect(result).toEqual({ notificationId: null, issue: 'past' });
    expect(notificationMocks.schedule).not.toHaveBeenCalled();
  });
});
