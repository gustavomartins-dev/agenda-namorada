import { DateTime } from 'luxon';

import {
  AGENDA_TIME_ZONE,
  type AgendaEventContext,
  type AssistantChatResponse,
} from '../../../shared/assistant.js';
import { parseAndNormalizeProposal } from '../domain/action.js';
import { HermesClient } from './hermesClient.js';

export class AssistantService {
  constructor(
    private readonly hermes: HermesClient,
    private readonly now: () => DateTime = () => DateTime.now().setZone(AGENDA_TIME_ZONE),
  ) {}

  async send(message: string, events: AgendaEventContext[]): Promise<AssistantChatResponse> {
    const referenceNow = this.now();
    const referenceIso = referenceNow.toISO({ suppressMilliseconds: true });
    if (!referenceIso) {
      throw new Error('Relógio do servidor inválido.');
    }
    const content = await this.hermes.chat(message, events, referenceIso);
    return {
      proposal: parseAndNormalizeProposal(content, events, referenceNow),
      referenceNow: referenceIso,
      timeZone: AGENDA_TIME_ZONE,
    };
  }
}
