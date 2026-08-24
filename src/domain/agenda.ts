export type CategoryId = 'personal' | 'study' | 'health' | 'love';

export type AgendaEvent = {
  id: string;
  title: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  category: CategoryId;
  notes: string;
  reminderMinutesBefore: number | null;
  notificationId: string | null;
  completed: boolean;
  createdAt: number;
  updatedAt: number;
};

export type AgendaEventDraft = Omit<
  AgendaEvent,
  'id' | 'notificationId' | 'completed' | 'createdAt' | 'updatedAt'
>;

export type NotificationIssue =
  | 'unsupported'
  | 'permission-denied'
  | 'past'
  | 'cancel-failed'
  | 'schedule-failed';

export type AgendaMutationResult = {
  event: AgendaEvent | null;
  notificationIssue: NotificationIssue | null;
};

export type AgendaPreferences = {
  loveNote: string;
  reduceMotion: boolean;
};

export type AgendaSnapshot = {
  schemaVersion: 2;
  events: AgendaEvent[];
  preferences: AgendaPreferences;
};

export const defaultPreferences: AgendaPreferences = {
  loveNote:
    'Que cada planinho seu te leve mais perto dos seus sonhos. Eu te amo! 💜',
  reduceMotion: false,
};

export const EMPTY_SNAPSHOT: AgendaSnapshot = {
  schemaVersion: 2,
  events: [],
  preferences: defaultPreferences,
};
