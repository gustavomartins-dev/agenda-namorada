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
  id: 'welcome-kuromi-assistant',
  role: 'assistant',
  content:
    'Oi, Nicolly! 💜 Me conta seu planinho do seu jeito. Eu organizo os detalhes e sempre te mostro tudo antes de salvar.',
  createdAt: 0,
  status: 'sent',
};
