import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import type { AgendaEventContext } from '../../shared/assistant.js';
import { parseAndNormalizeProposal } from '../src/domain/action.js';
import { AssistantService } from '../src/services/assistantService.js';
import type { HermesClient } from '../src/services/hermesClient.js';

const now = DateTime.fromISO('2026-08-24T10:00:00-03:00', { setZone: true });

function proposal(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    type: 'create_event',
    eventId: null,
    sourceEventUpdatedAt: null,
    title: 'Dentista',
    startAt: '2026-08-28T15:00:00-03:00',
    endAt: '2026-08-28T16:00:00-03:00',
    reminderMinutesBefore: 60,
    notes: null,
    missingFields: [],
    requiresConfirmation: true,
    assistantMessage: 'Posso guardar esse dentista para você?',
    ...overrides,
  });
}

const existing: AgendaEventContext = {
  id: 'event-1',
  title: 'Consulta',
  startAt: '2026-08-29T14:00:00-03:00',
  endAt: '2026-08-29T15:00:00-03:00',
  notes: 'Levar exames',
  reminderMinutesBefore: 30,
  updatedAt: 42,
};

describe('contrato seguro de ações', () => {
  it('normaliza uma criação para o fuso de São Paulo', () => {
    const result = parseAndNormalizeProposal(proposal(), [], now);
    expect(result.type).toBe('create_event');
    expect(result.startAt).toBe('2026-08-28T15:00:00-03:00');
    expect(result.requiresConfirmation).toBe(true);
  });

  it('recusa mutação que não exige confirmação', () => {
    expect(() =>
      parseAndNormalizeProposal(
        proposal({ requiresConfirmation: false }),
        [],
        now,
      ),
    ).toThrow(/confirmação/);
  });

  it('mantém perguntas incompletas como none sem ação executável', () => {
    const result = parseAndNormalizeProposal(
      proposal({
        type: 'none',
        title: null,
        startAt: null,
        endAt: null,
        reminderMinutesBefore: null,
        missingFields: ['time'],
        requiresConfirmation: false,
        assistantMessage: 'Que horas você prefere?',
      }),
      [],
      now,
    );
    expect(result).toMatchObject({
      type: 'none',
      missingFields: ['time'],
      requiresConfirmation: false,
    });
  });

  it('vincula edição ao evento real e à sua versão atual', () => {
    const result = parseAndNormalizeProposal(
      proposal({
        type: 'update_event',
        eventId: existing.id,
        title: 'Consulta remarcada',
      }),
      [existing],
      now,
    );
    expect(result).toMatchObject({
      type: 'update_event',
      eventId: existing.id,
      sourceEventUpdatedAt: 42,
      title: 'Consulta remarcada',
      requiresConfirmation: true,
    });
  });

  it('preenche uma exclusão somente a partir da fonte de verdade', () => {
    const result = parseAndNormalizeProposal(
      proposal({
        type: 'delete_event',
        eventId: existing.id,
        title: 'nome inventado pelo modelo',
        startAt: null,
        endAt: null,
      }),
      [existing],
      now,
    );
    expect(result).toMatchObject({
      type: 'delete_event',
      title: existing.title,
      startAt: existing.startAt,
      sourceEventUpdatedAt: existing.updatedAt,
    });
  });

  it('não propõe editar ou excluir um ID inexistente', () => {
    const result = parseAndNormalizeProposal(
      proposal({ type: 'delete_event', eventId: 'missing' }),
      [existing],
      now,
    );
    expect(result.type).toBe('none');
    expect(result.missingFields).toContain('event');
  });

  it('pede outro lembrete quando o cálculo cai no passado', () => {
    const result = parseAndNormalizeProposal(
      proposal({
        startAt: '2026-08-24T10:30:00-03:00',
        endAt: '2026-08-24T11:30:00-03:00',
        reminderMinutesBefore: 60,
      }),
      [],
      now,
    );
    expect(result).toMatchObject({ type: 'none', missingFields: ['reminder'] });
  });

  it('rejeita ação desconhecida e propriedades inesperadas', () => {
    expect(() =>
      parseAndNormalizeProposal(proposal({ type: 'run_command' }), [], now),
    ).toThrow(/contrato/);
    expect(() =>
      parseAndNormalizeProposal(proposal({ dangerousPath: '/etc/passwd' }), [], now),
    ).toThrow(/contrato/);
  });
});

describe('datas relativas no fluxo do assistente', () => {
  const resolved: Record<string, [string, string]> = {
    amanhã: ['2026-08-25T09:00:00-03:00', '2026-08-25T10:00:00-03:00'],
    sexta: ['2026-08-28T15:00:00-03:00', '2026-08-28T16:00:00-03:00'],
    'daqui duas horas': [
      '2026-08-24T12:00:00-03:00',
      '2026-08-24T13:00:00-03:00',
    ],
  };

  for (const [expression, [startAt, endAt]] of Object.entries(resolved)) {
    it(`normaliza “${expression}” usando o relógio de referência`, async () => {
      const hermes = {
        chat: async (message: string, _events: AgendaEventContext[], reference: string) => {
          expect(reference).toBe('2026-08-24T10:00:00-03:00');
          expect(message).toBe(expression);
          return proposal({ startAt, endAt, reminderMinutesBefore: null });
        },
      } as unknown as HermesClient;
      const service = new AssistantService(hermes, () => now);
      const result = await service.send(expression, []);
      expect(result.proposal.startAt).toBe(startAt);
    });
  }
});
