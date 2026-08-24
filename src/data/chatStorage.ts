import AsyncStorage from '@react-native-async-storage/async-storage';

import { ChatMessage, WELCOME_MESSAGE } from '@/domain/chat';

const CHAT_STORAGE_KEY = '@agenda-nicolly/assistant-messages';
const MAX_STORED_MESSAGES = 60;

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<ChatMessage>;
  return (
    typeof message.id === 'string' &&
    (message.role === 'user' || message.role === 'assistant') &&
    typeof message.content === 'string' &&
    typeof message.createdAt === 'number' &&
    (message.status === 'sending' ||
      message.status === 'sent' ||
      message.status === 'error')
  );
}

export async function loadChatMessages(): Promise<ChatMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return [WELCOME_MESSAGE];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [WELCOME_MESSAGE];
    const messages = parsed
      .filter(isChatMessage)
      .map((message) =>
        message.status === 'sending'
          ? { ...message, status: 'error' as const }
          : message,
      )
      .slice(-MAX_STORED_MESSAGES);
    return messages.length ? messages : [WELCOME_MESSAGE];
  } catch {
    return [WELCOME_MESSAGE];
  }
}

export async function saveChatMessages(messages: ChatMessage[]): Promise<void> {
  await AsyncStorage.setItem(
    CHAT_STORAGE_KEY,
    JSON.stringify(messages.slice(-MAX_STORED_MESSAGES)),
  );
}
