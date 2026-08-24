import type {
  AgendaEvent,
  AgendaEventDraft,
  AgendaMutationResult,
  NotificationIssue,
} from '@/domain/agenda';
import { AGENDA_TIME_ZONE, type EventProposal } from '../../shared/assistant';

export class ProposalExecutionError extends Error {
  constructor(
    public readonly code:
      | 'confirmation'
      | 'stale'
      | 'invalid'
      | 'expired'
      | 'notification',
  ) {
    super(code);
    this.name = 'ProposalExecutionError';
  }
}

export type AgendaProposalPort = {
  events: AgendaEvent[];
  addEvent: (draft: AgendaEventDraft) => Promise<AgendaMutationResult>;
  updateEvent: (
    id: string,
    draft: AgendaEventDraft,
  ) => Promise<AgendaMutationResult>;
  deleteEvent: (id: string) => Promise<AgendaMutationResult>;
};

export type ProposalExecutionResult = {
  action: 'created' | 'updated' | 'deleted';
  notificationIssue: NotificationIssue | null;
};

function partsInAgendaZone(value: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: AGENDA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value));
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function toDraft(
  proposal: EventProposal,
  existing?: AgendaEvent,
): AgendaEventDraft {
  if (!proposal.title || !proposal.startAt || !proposal.endAt) {
    throw new ProposalExecutionError('invalid');
  }
  const start = new Date(proposal.startAt);
  const end = new Date(proposal.endAt);
  const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60_000);
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    !Number.isFinite(durationMinutes) ||
    durationMinutes <= 0
  ) {
    throw new ProposalExecutionError('invalid');
  }
  const parts = partsInAgendaZone(proposal.startAt);
  return {
    title: proposal.title,
    date: `${parts.year}-${parts.month}-${parts.day}`,
    startTime: `${parts.hour}:${parts.minute}`,
    durationMinutes,
    category: existing?.category ?? 'personal',
    notes: proposal.notes ?? '',
    reminderMinutesBefore: proposal.reminderMinutesBefore,
  };
}

export async function executeConfirmedProposal(
  proposal: EventProposal,
  agenda: AgendaProposalPort,
  now = Date.now(),
): Promise<ProposalExecutionResult> {
  if (proposal.type === 'none' || !proposal.requiresConfirmation) {
    throw new ProposalExecutionError('confirmation');
  }

  const existing = proposal.eventId
    ? agenda.events.find((event) => event.id === proposal.eventId)
    : undefined;
  if (
    proposal.type !== 'create_event' &&
    (!existing || existing.updatedAt !== proposal.sourceEventUpdatedAt)
  ) {
    throw new ProposalExecutionError('stale');
  }

  if (proposal.type === 'delete_event') {
    const deletion = await agenda.deleteEvent(existing!.id);
    if (!deletion.event) throw new ProposalExecutionError('notification');
    return { action: 'deleted', notificationIssue: null };
  }

  if (!proposal.startAt) {
    throw new ProposalExecutionError('invalid');
  }
  const startTime = new Date(proposal.startAt).getTime();
  const reminderTime =
    proposal.reminderMinutesBefore === null
      ? startTime
      : startTime - proposal.reminderMinutesBefore * 60_000;
  if (
    !Number.isFinite(startTime) ||
    startTime <= now ||
    (proposal.reminderMinutesBefore !== null && reminderTime <= now)
  ) {
    throw new ProposalExecutionError('expired');
  }

  const draft = toDraft(proposal, existing);
  const mutation =
    proposal.type === 'create_event'
      ? await agenda.addEvent(draft)
      : await agenda.updateEvent(existing!.id, draft);
  if (!mutation.event) {
    if (mutation.notificationIssue === 'cancel-failed') {
      throw new ProposalExecutionError('notification');
    }
    throw new ProposalExecutionError('stale');
  }
  return {
    action: proposal.type === 'create_event' ? 'created' : 'updated',
    notificationIssue: mutation.notificationIssue,
  };
}
