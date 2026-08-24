import { createWriteStream } from 'node:fs';
import { mkdtemp, open, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';

import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import Fastify, { LogController } from 'fastify';
import { z } from 'zod';

import {
  AGENDA_TIME_ZONE,
  type AgendaEventContext,
} from '../../shared/assistant.js';
import type { ServerConfig } from './config.js';
import { AppError, toSafeError } from './errors.js';
import { AssistantService } from './services/assistantService.js';
import { HermesClient } from './services/hermesClient.js';
import {
  createTranscriber,
  type Transcriber,
} from './services/transcription.js';

const eventContextSchema = z
  .object({
    id: z.string().min(1).max(120),
    title: z.string().min(1).max(120),
    startAt: z.string().min(1).max(80),
    endAt: z.string().min(1).max(80),
    notes: z.string().max(500),
    reminderMinutesBefore: z.number().int().min(0).max(43_200).nullable(),
    updatedAt: z.number().int().nonnegative(),
  })
  .strict();

const chatBodySchema = z
  .object({
    message: z.string().trim().min(1).max(4_000),
    events: z.array(eventContextSchema).max(200).default([]),
    timeZone: z.literal(AGENDA_TIME_ZONE),
  })
  .strict();

const allowedMimeTypes = new Set([
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/webm',
  'audio/wav',
  'audio/x-wav',
]);

function hasValidAudioSignature(bytes: Buffer, mimeType: string): boolean {
  if (mimeType.includes('webm')) {
    return bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  }
  if (mimeType.includes('wav')) {
    return bytes.subarray(0, 4).toString('ascii') === 'RIFF';
  }
  return bytes.length >= 12 && bytes.subarray(4, 8).toString('ascii') === 'ftyp';
}

type AppDependencies = {
  assistant?: Pick<AssistantService, 'send'>;
  transcriber?: Transcriber;
};

export async function buildApp(config: ServerConfig, dependencies: AppDependencies = {}) {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? 'info' },
    bodyLimit: config.maxJsonBytes,
    logController: new LogController({ disableRequestLogging: true }),
    genReqId: () => crypto.randomUUID(),
  });
  const assistant =
    dependencies.assistant ?? new AssistantService(new HermesClient(config));
  const transcriber = dependencies.transcriber ?? createTranscriber(config);

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin(origin, callback) {
      if (!origin || config.allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Origem não permitida.'), false);
      }
    },
    methods: ['GET', 'POST'],
  });
  await app.register(rateLimit, {
    max: 30,
    timeWindow: '1 minute',
  });
  await app.register(multipart, {
    limits: {
      files: 1,
      fields: 4,
      fileSize: config.maxAudioBytes,
      parts: 5,
    },
  });

  app.get('/api/v1/health', async () => ({
    status: 'ok',
    assistant: 'local-hermes',
    transcription: {
      provider: transcriber.name,
      configured: transcriber.configured,
    },
  }));

  app.post('/api/v1/chat', async (request, reply) => {
    const parsed = chatBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(
        400,
        'INVALID_CHAT_REQUEST',
        'A mensagem ou o contexto da agenda é inválido.',
      );
    }
    const response = await assistant.send(
      parsed.data.message,
      parsed.data.events as AgendaEventContext[],
    );
    return reply.send(response);
  });

  app.post('/api/v1/audio/transcriptions', async (request, reply) => {
    const transcriptionAbort = new AbortController();
    const abortTranscription = () => transcriptionAbort.abort();
    const closeTranscription = () => {
      request.raw.removeListener('aborted', abortTranscription);
      abortTranscription();
    };
    request.raw.once('aborted', abortTranscription);
    reply.raw.once('close', closeTranscription);
    const part = await request.file({
      limits: { files: 1, fileSize: config.maxAudioBytes },
    });
    if (!part) {
      throw new AppError(400, 'AUDIO_REQUIRED', 'Envie uma gravação de áudio.');
    }
    if (!allowedMimeTypes.has(part.mimetype)) {
      part.file.resume();
      throw new AppError(
        415,
        'UNSUPPORTED_AUDIO_TYPE',
        'Esse formato de áudio não é compatível. Grave novamente pelo aplicativo.',
      );
    }

    const durationField = part.fields.durationMs;
    const claimedDurationMs =
      durationField &&
      !Array.isArray(durationField) &&
      durationField.type === 'field'
        ? Number(durationField.value)
        : Number.NaN;
    if (
      !Number.isFinite(claimedDurationMs) ||
      claimedDurationMs <= 0 ||
      claimedDurationMs > config.maxAudioSeconds * 1_000
    ) {
      part.file.resume();
      throw new AppError(
        422,
        'AUDIO_DURATION_INVALID',
        `O áudio precisa ter no máximo ${config.maxAudioSeconds} segundos.`,
      );
    }

    const uploadDirectory = await mkdtemp(join(tmpdir(), 'agenda-kuromi-'));
    const uploadPath = join(uploadDirectory, 'recording');
    try {
      await pipeline(part.file, createWriteStream(uploadPath, { flags: 'wx', mode: 0o600 }));
      if (part.file.truncated) {
        throw new AppError(
          413,
          'AUDIO_TOO_LARGE',
          'O áudio ultrapassou o limite de tamanho.',
        );
      }
      const handle = await open(uploadPath, 'r');
      const signature = Buffer.alloc(16);
      const { bytesRead } = await handle.read(signature, 0, signature.length, 0);
      await handle.close();
      if (!hasValidAudioSignature(signature.subarray(0, bytesRead), part.mimetype)) {
        throw new AppError(
          415,
          'INVALID_AUDIO_FILE',
          'O arquivo recebido não parece ser uma gravação válida.',
        );
      }
      if (transcriptionAbort.signal.aborted || reply.raw.destroyed) {
        throw new AppError(499, 'TRANSCRIPTION_CANCELLED', 'Transcrição cancelada.');
      }
      try {
        const transcript = await transcriber.transcribe({
          filePath: uploadPath,
          mimeType: part.mimetype,
          claimedDurationMs,
          signal: transcriptionAbort.signal,
        });
        return reply.send({ transcript });
      } finally {
        request.raw.removeListener('aborted', abortTranscription);
        reply.raw.removeListener('close', closeTranscription);
      }
    } finally {
      await rm(uploadDirectory, { recursive: true, force: true });
    }
  });

  app.setErrorHandler((error, request, reply) => {
    const safe = toSafeError(error);
    if (safe.statusCode >= 500) {
      request.log.warn({ code: safe.code, requestId: request.id }, 'request failed');
    }
    reply.status(safe.statusCode).send({
      error: {
        code: safe.code,
        message: safe.message,
        retryable: safe.retryable,
        requestId: request.id,
      },
    });
  });

  return app;
}
