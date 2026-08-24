import { describe, expect, it, vi } from 'vitest';

import type { AgendaEvent } from '@/domain/agenda';
import type { EventProposal } from '../../shared/assistant';
import { executeConfirmedProposal } from './proposalExecutor';

const existing: AgendaEvent = {
  id: 'event-1',
  title: 'Consulta',
  date: '2026-08-28',
  startTime: '15:00',
  durationMinutes: 60,
  category: 'health',
  notes: '',
  reminderMinutesBefore: 60,
  notificationId: 'old-notification',
  completed: false,
  createdAt: 1,
  updatedAt: 42,
};
const referenceNow = Date.parse('2026-08-24T10:00:00-03:00');

function proposal(overrides: Partial<EventProposal> = {}): EventProposal {
  return {
    type: 'create_event',
    eventId: null,
    sourceEventUpdatedAt: null,
    title: 'Dentista',
    startAt: '2026-08-29T15:00:00-03:00',
    endAt: '2026-08-29T16:00:00-03:00',
    reminderMinutesBefore: 60,
    notes: '',
    missingFields: [],
    requiresConfirmation: true,
    assistantMessage: 'Confirmar?',
    ...overrides,
  };
}

function port(events: AgendaEvent[] = []) {
  return {
    events,
    addEvent: vi.fn().mockResolvedValue({
      event: { ...existing, id: 'created' },
      notificationIssue: null,
    }),
    updateEvent: vi.fn().mockResolvedValue({
      event: { ...existing, title: 'Atualizado' },
      notificationIssue: null,
    }),
    deleteEvent: vi.fn().mockResolvedValue({
      event: existing,
      notificationIssue: null,
    }),
  };
}

describe('execução confirmada de propostas', () => {
  it('nunca executa uma proposta sem confirmação obrigatória', async () => {
    const agenda = port();
    await expect(
      executeConfirmedProposal(
        proposal({ requiresConfirmation: false }),
        agenda,
        referenceNow,
      ),
    ).rejects.toMatchObject({ code: 'confirmation' });
    expect(agenda.addEvent).not.toHaveBeenCalled();
  });

  it('cria um evento somente após a chamada explícita de confirmação', async () => {
    const agenda = port();
    await expect(
      executeConfirmedProposal(proposal(), agenda, referenceNow),
    ).resolves.toMatchObject({ action: 'created' });
    expect(agenda.addEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Dentista',
        date: '2026-08-29',
        startTime: '15:00',
        reminderMinutesBefore: 60,
      }),
    );
  });

  it('edita o evento atual e preserva sua categoria', async () => {
    const agenda = port([existing]);
    await executeConfirmedProposal(
      proposal({
        type: 'update_event',
        eventId: existing.id,
        sourceEventUpdatedAt: existing.updatedAt,
      }),
      agenda,
      referenceNow,
    );
    expect(agenda.updateEvent).toHaveBeenCalledWith(
      existing.id,
      expect.objectContaining({ category: 'health' }),
    );
  });

  it('exclui pelo ID da fonte de verdade', async () => {
    const agenda = port([existing]);
    await executeConfirmedProposal(
      proposal({
        type: 'delete_event',
        eventId: existing.id,
        sourceEventUpdatedAt: existing.updatedAt,
        startAt: existing.date,
        endAt: existing.date,
      }),
      agenda,
      referenceNow,
    );
    expect(agenda.deleteEvent).toHaveBeenCalledWith(existing.id);
  });

  it('recusa uma proposta obsoleta depois que o evento mudou', async () => {
    const agenda = port([existing]);
    await expect(
      executeConfirmedProposal(
        proposal({
          type: 'update_event',
          eventId: existing.id,
          sourceEventUpdatedAt: 41,
        }),
        agenda,
        referenceNow,
      ),
    ).rejects.toMatchObject({ code: 'stale' });
    expect(agenda.updateEvent).not.toHaveBeenCalled();
  });

  it('recusa confirmação tardia quando o lembrete já passou', async () => {
    const agenda = port();
    await expect(
      executeConfirmedProposal(
        proposal({
          startAt: '2026-08-24T10:30:00-03:00',
          endAt: '2026-08-24T11:30:00-03:00',
          reminderMinutesBefore: 60,
        }),
        agenda,
        referenceNow,
      ),
    ).rejects.toMatchObject({ code: 'expired' });
    expect(agenda.addEvent).not.toHaveBeenCalled();
  });
});
