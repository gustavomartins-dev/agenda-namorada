export const AGENDA_TIME_ZONE = 'America/Sao_Paulo' as const;

export type AssistantActionType =
  | 'create_event'
  | 'update_event'
  | 'delete_event'
  | 'none';

export type EventProposal = {
  type: AssistantActionType;
  eventId: string | null;
  sourceEventUpdatedAt: number | null;
  title: string | null;
  startAt: string | null;
  endAt: string | null;
  reminderMinutesBefore: number | null;
  notes: string | null;
  missingFields: string[];
  requiresConfirmation: boolean;
  assistantMessage: string;
};

export type AgendaEventContext = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  notes: string;
  reminderMinutesBefore: number | null;
  updatedAt: number;
};

export type AssistantChatRequest = {
  message: string;
  events: AgendaEventContext[];
  timeZone: typeof AGENDA_TIME_ZONE;
};

export type AssistantChatResponse = {
  proposal: EventProposal;
  referenceNow: string;
  timeZone: typeof AGENDA_TIME_ZONE;
};

export type TranscriptionResponse = {
  transcript: string;
};

export type ApiErrorEnvelope = {
  error: {
    code: string;
    message: string;
    retryable: boolean;
    requestId: string;
  };
};
