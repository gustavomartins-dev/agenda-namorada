import { DateTime } from 'luxon';
import { z } from 'zod';

import {
  AGENDA_TIME_ZONE,
  type AgendaEventContext,
  type EventProposal,
} from '../../../shared/assistant.js';
import { AppError } from '../errors.js';

const MAX_MODEL_RESPONSE_BYTES = 24_000;
const offsetSuffix = /(?:Z|[+-]\d{2}:\d{2})$/;

const rawProposalSchema = z
  .object({
    type: z.enum(['create_event', 'update_event', 'delete_event', 'none']),
    eventId: z.string().min(1).max(120).nullable(),
    sourceEventUpdatedAt: z.number().int().nonnegative().nullable(),
    title: z.string().max(120).nullable(),
    startAt: z.string().max(80).nullable(),
    endAt: z.string().max(80).nullable(),
    reminderMinutesBefore: z.number().int().min(0).max(43_200).nullable(),
    notes: z.string().max(2_000).nullable(),
    missingFields: z.array(z.string().min(1).max(40)).max(8),
    requiresConfirmation: z.boolean(),
    assistantMessage: z.string().min(1).max(1_200),
  })
  .strict();

function parseJsonObject(content: string): unknown {
  if (Buffer.byteLength(content, 'utf8') > MAX_MODEL_RESPONSE_BYTES) {
    throw new AppError(
      502,
      'HERMES_RESPONSE_TOO_LARGE',
      'O assistente respondeu com conteúdo maior que o permitido.',
      true,
    );
  }

  const unfenced = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new AppError(
      502,
      'INVALID_HERMES_RESPONSE',
      'O assistente não devolveu uma proposta válida. Tente reformular o pedido.',
      true,
    );
  }

  try {
    return JSON.parse(unfenced.slice(start, end + 1));
  } catch {
    throw new AppError(
      502,
      'INVALID_HERMES_RESPONSE',
      'O assistente não devolveu uma proposta válida. Tente reformular o pedido.',
      true,
    );
  }
}

function canonicalDate(value: string, field: string): DateTime {
  if (!offsetSuffix.test(value)) {
    throw new AppError(
      502,
      'INVALID_ACTION_DATE',
      `O campo ${field} veio sem fuso horário. Peça para o assistente tentar novamente.`,
      true,
    );
  }
  const parsed = DateTime.fromISO(value, { setZone: true });
  if (!parsed.isValid) {
    throw new AppError(
      502,
      'INVALID_ACTION_DATE',
      `O campo ${field} contém uma data inválida.`,
      true,
    );
  }
  return parsed.setZone(AGENDA_TIME_ZONE);
}

function iso(date: DateTime): string {
  const value = date.toISO({ suppressMilliseconds: true, includeOffset: true });
  if (!value) {
    throw new AppError(502, 'INVALID_ACTION_DATE', 'A data proposta é inválida.', true);
  }
  return value;
}

function none(message: string, missingFields: string[] = []): EventProposal {
  return {
    type: 'none',
    eventId: null,
    sourceEventUpdatedAt: null,
    title: null,
    startAt: null,
    endAt: null,
    reminderMinutesBefore: null,
    notes: null,
    missingFields,
    requiresConfirmation: false,
    assistantMessage: message,
  };
}

export function parseAndNormalizeProposal(
  content: string,
  events: AgendaEventContext[],
  referenceNow: DateTime,
): EventProposal {
  const decoded = rawProposalSchema.safeParse(parseJsonObject(content));
  if (!decoded.success) {
    throw new AppError(
      502,
      'INVALID_HERMES_RESPONSE',
      'O assistente devolveu dados fora do contrato seguro.',
      true,
    );
  }

  const raw = decoded.data;
  const assistantMessage = raw.assistantMessage.trim();
  if (raw.type === 'none') {
    return none(assistantMessage, raw.missingFields);
  }
  if (!raw.requiresConfirmation || raw.missingFields.length > 0) {
    throw new AppError(
      502,
      'UNSAFE_ACTION_PROPOSAL',
      'O assistente tentou propor uma alteração sem confirmação completa.',
      true,
    );
  }

  const sourceEvent = raw.eventId
    ? events.find((event) => event.id === raw.eventId)
    : undefined;
  if (raw.type !== 'create_event' && !sourceEvent) {
    return none(
      'Não encontrei esse compromisso na agenda atual. Me diga qual evento você quer alterar.',
      ['event'],
    );
  }

  if (raw.type === 'delete_event' && sourceEvent) {
    return {
      type: raw.type,
      eventId: sourceEvent.id,
      sourceEventUpdatedAt: sourceEvent.updatedAt,
      title: sourceEvent.title,
      startAt: sourceEvent.startAt,
      endAt: sourceEvent.endAt,
      reminderMinutesBefore: sourceEvent.reminderMinutesBefore,
      notes: sourceEvent.notes || null,
      missingFields: [],
      requiresConfirmation: true,
      assistantMessage,
    };
  }

  const title = (raw.title ?? sourceEvent?.title ?? '').trim();
  const startValue = raw.startAt ?? sourceEvent?.startAt;
  const endValue = raw.endAt ?? sourceEvent?.endAt;
  if (!title || !startValue || !endValue) {
    return none(
      'Preciso do título, da data e do horário antes de montar a proposta.',
      [
        ...(!title ? ['title'] : []),
        ...(!startValue ? ['date/time'] : []),
        ...(!endValue ? ['end'] : []),
      ],
    );
  }

  const start = canonicalDate(startValue, 'startAt');
  const end = canonicalDate(endValue, 'endAt');
  const durationMinutes = end.diff(start, 'minutes').minutes;
  if (durationMinutes < 5 || durationMinutes > 7 * 24 * 60) {
    throw new AppError(
      502,
      'INVALID_EVENT_DURATION',
      'A duração proposta precisa ficar entre 5 minutos e 7 dias.',
      true,
    );
  }
  if (start <= referenceNow) {
    return none(
      'Esse horário já passou. Me diga um novo dia ou horário para eu ajustar.',
      ['futureDate'],
    );
  }
  if (start > referenceNow.plus({ years: 5 })) {
    throw new AppError(
      502,
      'EVENT_TOO_FAR',
      'A agenda aceita propostas para os próximos cinco anos.',
    );
  }

  if (
    raw.reminderMinutesBefore !== null &&
    start.minus({ minutes: raw.reminderMinutesBefore }) <= referenceNow
  ) {
    return none(
      'Esse lembrete cairia no passado. Você prefere menos antecedência ou outro horário?',
      ['reminder'],
    );
  }

  return {
    type: raw.type,
    eventId: raw.type === 'create_event' ? null : sourceEvent?.id ?? null,
    sourceEventUpdatedAt:
      raw.type === 'create_event' ? null : sourceEvent?.updatedAt ?? null,
    title,
    startAt: iso(start),
    endAt: iso(end),
    reminderMinutesBefore: raw.reminderMinutesBefore,
    notes: (raw.notes ?? sourceEvent?.notes ?? '').trim() || null,
    missingFields: [],
    requiresConfirmation: true,
    assistantMessage,
  };
}
