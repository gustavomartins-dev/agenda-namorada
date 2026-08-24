import { request as httpRequest } from 'node:http';
import type { AddressInfo } from 'node:net';

import { describe, expect, it, vi } from 'vitest';

import { AGENDA_TIME_ZONE } from '../../shared/assistant.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { AppError } from '../src/errors.js';
import type { Transcriber } from '../src/services/transcription.js';

const config = loadConfig({
  HERMES_API_SERVER_KEY: 'a-private-test-key-with-32-characters',
  HERMES_NO_MCP_CONFIRMED: 'true',
});

describe('API privada da Agenda Kuromi', () => {
  it('não inicia sem a confirmação explícita do isolamento de MCP', () => {
    expect(() =>
      loadConfig({
        HERMES_API_SERVER_KEY: 'a-private-test-key-with-32-characters',
      }),
    ).toThrow('HERMES_NO_MCP_CONFIRMED=true');
  });

  it('valida o chat e devolve a proposta do serviço', async () => {
    const send = vi.fn().mockResolvedValue({
      proposal: {
        type: 'none',
        eventId: null,
        sourceEventUpdatedAt: null,
        title: null,
        startAt: null,
        endAt: null,
        reminderMinutesBefore: null,
        notes: null,
        missingFields: [],
        requiresConfirmation: false,
        assistantMessage: 'Oi!',
      },
      referenceNow: '2026-08-24T10:00:00-03:00',
      timeZone: AGENDA_TIME_ZONE,
    });
    const app = await buildApp(config, {
      assistant: { send },
      transcriber: {
        name: 'test',
        configured: true,
        transcribe: vi.fn(),
      },
    });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/chat',
      payload: { message: 'oi', events: [], timeZone: AGENDA_TIME_ZONE },
    });
    expect(response.statusCode).toBe(200);
    expect(send).toHaveBeenCalledWith('oi', []);
    await app.close();
  });

  it('rejeita campos desconhecidos sem repassá-los ao assistente', async () => {
    const send = vi.fn();
    const app = await buildApp(config, {
      assistant: { send },
      transcriber: {
        name: 'test',
        configured: true,
        transcribe: vi.fn(),
      },
    });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/chat',
      payload: {
        message: 'oi',
        events: [],
        timeZone: AGENDA_TIME_ZONE,
        path: '/etc/passwd',
      },
    });
    expect(response.statusCode).toBe(400);
    expect(send).not.toHaveBeenCalled();
    await app.close();
  });

  it('devolve erro de cliente seguro para JSON malformado', async () => {
    const app = await buildApp(config, {
      assistant: { send: vi.fn() },
      transcriber: {
        name: 'test',
        configured: true,
        transcribe: vi.fn(),
      },
    });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/chat',
      headers: { 'content-type': 'application/json' },
      payload: '{"message":',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: 'INVALID_JSON' } });
    await app.close();
  });

  it('devolve 415 para Content-Type incompatível', async () => {
    const app = await buildApp(config, {
      assistant: { send: vi.fn() },
      transcriber: {
        name: 'test',
        configured: true,
        transcribe: vi.fn(),
      },
    });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/chat',
      headers: { 'content-type': 'application/xml' },
      payload: '<message>oi</message>',
    });
    expect(response.statusCode).toBe(415);
    expect(response.json()).toMatchObject({
      error: { code: 'UNSUPPORTED_CONTENT_TYPE' },
    });
    await app.close();
  });

  it('não vaza detalhes internos em erro de transcrição', async () => {
    const transcriber: Transcriber = {
      name: 'test',
      configured: true,
      transcribe: vi.fn().mockRejectedValue(
        new AppError(
          503,
          'TRANSCRIPTION_UNAVAILABLE',
          'Whisper local indisponível.',
        ),
      ),
    };
    const app = await buildApp(config, {
      assistant: { send: vi.fn() },
      transcriber,
    });
    const boundary = 'agenda-test-boundary';
    const payload = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="durationMs"\r\n\r\n1000\r\n` +
          `--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="../../secret.wav"\r\n` +
          `Content-Type: audio/wav\r\n\r\n`,
      ),
      Buffer.from('RIFF0000WAVEdata'),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/audio/transcriptions',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload,
    });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      error: { code: 'TRANSCRIPTION_UNAVAILABLE' },
    });
    expect(transcriber.transcribe).toHaveBeenCalledWith(
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(response.body).not.toContain('/tmp/');
    expect(response.body).not.toContain('../../secret.wav');
    await app.close();
  });

  it('cancela a transcrição se o cliente fechar a conexão', async () => {
    let notifyStarted: () => void = () => undefined;
    let notifyAborted: () => void = () => undefined;
    const started = new Promise<void>((resolve) => {
      notifyStarted = resolve;
    });
    const aborted = new Promise<void>((resolve) => {
      notifyAborted = resolve;
    });
    const transcriber: Transcriber = {
      name: 'test',
      configured: true,
      transcribe: vi.fn().mockImplementation(
        ({ signal }: { signal?: AbortSignal }) =>
          new Promise<string>((_resolve, reject) => {
            notifyStarted();
            const cancel = () => {
              notifyAborted();
              reject(
                new AppError(
                  499,
                  'TRANSCRIPTION_CANCELLED',
                  'Transcrição cancelada.',
                ),
              );
            };
            if (signal?.aborted) cancel();
            else signal?.addEventListener('abort', cancel, { once: true });
          }),
      ),
    };
    const app = await buildApp(config, {
      assistant: { send: vi.fn() },
      transcriber,
    });
    await app.listen({ host: '127.0.0.1', port: 0 });
    const address = app.server.address() as AddressInfo;
    const boundary = 'agenda-abort-boundary';
    const payload = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="durationMs"\r\n\r\n1000\r\n` +
          `--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="recording.wav"\r\n` +
          `Content-Type: audio/wav\r\n\r\n`,
      ),
      Buffer.from('RIFF0000WAVEdata'),
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const client = httpRequest({
      host: '127.0.0.1',
      port: address.port,
      path: '/api/v1/audio/transcriptions',
      method: 'POST',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
        'content-length': payload.length,
      },
    });
    client.on('error', () => undefined);
    client.end(payload);

    await started;
    client.destroy();
    await aborted;
    expect(transcriber.transcribe).toHaveBeenCalledOnce();
    await app.close();
  });
});
