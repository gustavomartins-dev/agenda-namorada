import { Platform } from 'react-native';

import type {
  ApiErrorEnvelope,
  AssistantChatRequest,
  AssistantChatResponse,
  TranscriptionResponse,
} from '../../shared/assistant';

const SERVER_URL = (
  process.env.EXPO_PUBLIC_AGENDA_SERVER_URL ?? 'http://127.0.0.1:8787'
).replace(/\/$/, '');
const REQUEST_TIMEOUT_MS = 130_000;
const AUDIO_REQUEST_TIMEOUT_MS = 210_000;

export class AssistantApiError extends Error {
  constructor(
    message: string,
    public readonly code = 'NETWORK_ERROR',
    public readonly retryable = true,
  ) {
    super(message);
    this.name = 'AssistantApiError';
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as
    | T
    | ApiErrorEnvelope
    | null;
  if (!response.ok) {
    const apiError =
      body && typeof body === 'object' && 'error' in body ? body.error : null;
    throw new AssistantApiError(
      apiError?.message ?? 'O servidor da agenda não respondeu como esperado.',
      apiError?.code ?? 'SERVER_ERROR',
      apiError?.retryable ?? response.status >= 500,
    );
  }
  if (!body) {
    throw new AssistantApiError('O servidor devolveu uma resposta vazia.');
  }
  return body as T;
}

async function apiFetch(
  path: string,
  init?: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const externalSignal = init?.signal;
  const abortFromCaller = () => controller.abort();
  externalSignal?.addEventListener('abort', abortFromCaller, { once: true });
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${SERVER_URL}${path}`, {
      ...init,
      signal: controller.signal,
    });
  } catch {
    if (externalSignal?.aborted) {
      throw new AssistantApiError('Operação cancelada.', 'REQUEST_CANCELLED', false);
    }
    throw new AssistantApiError(
      'O assistente local está offline. A agenda continua disponível normalmente.',
      'SERVER_OFFLINE',
      true,
    );
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener('abort', abortFromCaller);
  }
}

export async function sendAssistantMessage(
  request: AssistantChatRequest,
): Promise<AssistantChatResponse> {
  const response = await apiFetch('/api/v1/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return parseResponse<AssistantChatResponse>(response);
}

export async function transcribeRecording(
  uri: string,
  durationMs: number,
  signal?: AbortSignal,
): Promise<string> {
  const form = new FormData();
  form.append('durationMs', String(durationMs));

  if (Platform.OS === 'web') {
    const recording = await fetch(uri).then((response) => response.blob());
    form.append('audio', recording, 'recording.webm');
  } else {
    form.append(
      'audio',
      {
        uri,
        name: 'recording.m4a',
        type: 'audio/mp4',
      } as unknown as Blob,
    );
  }

  const response = await apiFetch(
    '/api/v1/audio/transcriptions',
    {
      method: 'POST',
      body: form,
      signal,
    },
    AUDIO_REQUEST_TIMEOUT_MS,
  );
  const result = await parseResponse<TranscriptionResponse>(response);
  return result.transcript;
}

export async function checkAssistantServer(): Promise<boolean> {
  try {
    const response = await apiFetch('/api/v1/health');
    return response.ok;
  } catch {
    return false;
  }
}
