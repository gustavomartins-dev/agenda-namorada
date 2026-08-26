import type { EventProposal } from '../../shared/assistant';

export type ChatMessageRole = 'user' | 'assistant';
export type ProposalState = 'pending' | 'confirmed' | 'cancelled' | 'failed';

export type ChatMessage = {
  id: string;
  role: ChatMessageRole;
  content: string;
  createdAt: number;
  status: 'sending' | 'sent' | 'error';
  proposal?: EventProposal;
  proposalState?: ProposalState;
};

export const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome-kuromia-assistant',
  role: 'assistant',
  content:
    'E aí, Nicolly! Eu sou a KuromI.A 😈💜 Manda seu plano que eu organizo tudo — mas você dá a palavra final, óbvio.',
  createdAt: 0,
  status: 'sent',
};
