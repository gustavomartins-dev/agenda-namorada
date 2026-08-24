import { isIP } from 'node:net';

import { z } from 'zod';

const envSchema = z.object({
  HERMES_API_BASE_URL: z.string().url().default('http://127.0.0.1:8642'),
  HERMES_API_SERVER_KEY: z.string().min(16),
  HERMES_NO_MCP_CONFIRMED: z.enum(['true', 'false']).default('false'),
  HERMES_SESSION_ID: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{3,80}$/)
    .default('agenda_kuromi_nicolly_v1'),
  HERMES_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(180_000).default(60_000),
  SERVER_HOST: z.string().default('127.0.0.1'),
  SERVER_PORT: z.coerce.number().int().min(1_024).max(65_535).default(8_787),
  ALLOWED_ORIGINS: z.string().default('http://localhost:8081,http://127.0.0.1:8081'),
  MAX_JSON_BYTES: z.coerce.number().int().min(4_096).max(262_144).default(262_144),
  MAX_AUDIO_BYTES: z.coerce
    .number()
    .int()
    .min(64_000)
    .max(25 * 1024 * 1024)
    .default(8 * 1024 * 1024),
  MAX_AUDIO_SECONDS: z.coerce.number().int().min(5).max(180).default(90),
  TRANSCRIPTION_PROVIDER: z.enum(['disabled', 'whisper-cpp']).default('disabled'),
  WHISPER_BIN: z.string().optional(),
  WHISPER_MODEL: z.string().optional(),
  FFPROBE_BIN: z.string().optional(),
  FFMPEG_BIN: z.string().optional(),
  TRANSCRIPTION_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(10_000)
    .max(300_000)
    .default(120_000),
});

export type ServerConfig = ReturnType<typeof loadConfig>;

function isLoopback(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (normalized === 'localhost' || normalized === '::1') {
    return true;
  }
  return isIP(normalized) === 4 && normalized.startsWith('127.');
}

export function loadConfig(
  environment: Record<string, string | undefined> = process.env,
) {
  const parsed = envSchema.parse(environment);
  const hermesUrl = new URL(parsed.HERMES_API_BASE_URL);

  if (hermesUrl.protocol !== 'http:' || !isLoopback(hermesUrl.hostname)) {
    throw new Error('HERMES_API_BASE_URL precisa usar HTTP em loopback.');
  }
  if (!isLoopback(parsed.SERVER_HOST)) {
    throw new Error('SERVER_HOST precisa permanecer em loopback nesta etapa privada.');
  }
  if (parsed.HERMES_NO_MCP_CONFIRMED !== 'true') {
    throw new Error(
      'Confirme platform_toolsets.api_server=["no_mcp"] e defina HERMES_NO_MCP_CONFIRMED=true.',
    );
  }

  const transcription = parsed.TRANSCRIPTION_PROVIDER === 'whisper-cpp';
  if (
    transcription &&
    (!parsed.WHISPER_BIN ||
      !parsed.WHISPER_MODEL ||
      !parsed.FFPROBE_BIN ||
      !parsed.FFMPEG_BIN)
  ) {
    throw new Error(
      'WHISPER_BIN, WHISPER_MODEL, FFPROBE_BIN e FFMPEG_BIN são obrigatórios com whisper-cpp.',
    );
  }

  return {
    hermesBaseUrl: hermesUrl.origin,
    hermesKey: parsed.HERMES_API_SERVER_KEY,
    hermesSessionId: parsed.HERMES_SESSION_ID,
    hermesTimeoutMs: parsed.HERMES_TIMEOUT_MS,
    host: parsed.SERVER_HOST,
    port: parsed.SERVER_PORT,
    allowedOrigins: parsed.ALLOWED_ORIGINS.split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    maxJsonBytes: parsed.MAX_JSON_BYTES,
    maxAudioBytes: parsed.MAX_AUDIO_BYTES,
    maxAudioSeconds: parsed.MAX_AUDIO_SECONDS,
    transcriptionProvider: parsed.TRANSCRIPTION_PROVIDER,
    whisperBin: parsed.WHISPER_BIN,
    whisperModel: parsed.WHISPER_MODEL,
    ffprobeBin: parsed.FFPROBE_BIN,
    ffmpegBin: parsed.FFMPEG_BIN,
    transcriptionTimeoutMs: parsed.TRANSCRIPTION_TIMEOUT_MS,
  } as const;
}
