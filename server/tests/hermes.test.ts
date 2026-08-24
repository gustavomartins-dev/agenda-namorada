import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadConfig } from '../src/config.js';
import { HermesClient } from '../src/services/hermesClient.js';
import { SessionStore } from '../src/services/sessionStore.js';
import { DisabledTranscriber } from '../src/services/transcription.js';

function config() {
  return loadConfig({
    HERMES_API_SERVER_KEY: 'a-private-test-key-with-32-characters',
    HERMES_NO_MCP_CONFIRMED: 'true',
  });
}

function jsonResponse(value: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('barreira de segurança Hermes', () => {
  it('falha fechado se qualquer toolset estiver habilitado', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          data: [{ name: 'terminal', enabled: true, tools: ['terminal'] }],
        }),
      ),
    );
    const client = new HermesClient(config());
    await expect(client.assertSafeToolSurface(true)).rejects.toMatchObject({
      code: 'HERMES_UNSAFE_TOOLSET',
    });
  });

  it('transforma indisponibilidade em erro seguro e recuperável', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('secret path')));
    const client = new HermesClient(config());
    await expect(client.assertSafeToolSurface(true)).rejects.toMatchObject({
      code: 'HERMES_OFFLINE',
      retryable: true,
    });
  });

  it('reutiliza a sessão e persiste o ID efetivo rotacionado', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'agenda-session-test-'));
    const store = new SessionStore(join(folder, 'session.json'));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: [] }))
      .mockResolvedValueOnce(jsonResponse({ object: 'hermes.session' }))
      .mockResolvedValueOnce(
        jsonResponse({
          session_id: 'agenda-rotated',
          message: { role: 'assistant', content: '{"ok":true}' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const client = new HermesClient(config(), store);

    await expect(
      client.chat('oi', [], '2026-08-24T10:00:00-03:00'),
    ).resolves.toBe('{"ok":true}');
    expect(await store.load()).toBe('agenda-rotated');
    expect(fetchMock.mock.calls[2]?.[0]).toContain(
      '/api/sessions/agenda_kuromi_nicolly_v1/chat',
    );
    await rm(folder, { recursive: true, force: true });
  });
});

describe('transcrição indisponível', () => {
  it('declara honestamente quando Whisper não está configurado', async () => {
    const transcriber = new DisabledTranscriber();
    await expect(
      transcriber.transcribe({
        filePath: '/tmp/not-used',
        mimeType: 'audio/wav',
        claimedDurationMs: 1_000,
      }),
    ).rejects.toMatchObject({ code: 'TRANSCRIPTION_UNAVAILABLE' });
  });
});
