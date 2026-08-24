import { spawn } from 'node:child_process';
import { readFile, unlink } from 'node:fs/promises';
import { isAbsolute } from 'node:path';

import type { ServerConfig } from '../config.js';
import { AppError } from '../errors.js';

export type TranscriptionInput = {
  filePath: string;
  mimeType: string;
  claimedDurationMs: number;
  signal?: AbortSignal;
};

export interface Transcriber {
  readonly name: string;
  readonly configured: boolean;
  transcribe(input: TranscriptionInput): Promise<string>;
}

type ProcessResult = { stdout: string; stderr: string };

function runProcess(
  executable: string,
  args: string[],
  timeoutMs: number,
  maxOutputBytes = 256_000,
  signal?: AbortSignal,
): Promise<ProcessResult> {
  if (signal?.aborted) {
    return Promise.reject(
      new AppError(499, 'TRANSCRIPTION_CANCELLED', 'Transcrição cancelada.'),
    );
  }
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    };
    const abort = () => {
      child.kill('SIGKILL');
      if (!settled) {
        settled = true;
        cleanup();
        reject(new AppError(499, 'TRANSCRIPTION_CANCELLED', 'Transcrição cancelada.'));
      }
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      if (!settled) {
        settled = true;
        cleanup();
        reject(
          new AppError(
            504,
            'TRANSCRIPTION_TIMEOUT',
            'A transcrição demorou demais. Tente um áudio mais curto.',
            true,
          ),
        );
      }
    }, timeoutMs);
    signal?.addEventListener('abort', abort, { once: true });

    const collect = (chunks: Buffer[], chunk: Buffer, currentBytes: number): number => {
      const nextBytes = currentBytes + chunk.length;
      if (nextBytes > maxOutputBytes) {
        child.kill('SIGKILL');
        throw new AppError(
          502,
          'TRANSCRIPTION_OUTPUT_TOO_LARGE',
          'O transcritor devolveu conteúdo maior que o permitido.',
        );
      }
      chunks.push(chunk);
      return nextBytes;
    };

    child.stdout.on('data', (chunk: Buffer) => {
      try {
        stdoutBytes = collect(stdout, chunk, stdoutBytes);
      } catch (error) {
        if (!settled) {
          settled = true;
          cleanup();
          reject(error);
        }
      }
    });
    child.stderr.on('data', (chunk: Buffer) => {
      try {
        stderrBytes = collect(stderr, chunk, stderrBytes);
      } catch (error) {
        if (!settled) {
          settled = true;
          cleanup();
          reject(error);
        }
      }
    });
    child.once('error', () => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(
          new AppError(
            503,
            'TRANSCRIPTION_UNAVAILABLE',
            'O Whisper local não está disponível neste computador.',
          ),
        );
      }
    });
    child.once('close', (code) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (code !== 0) {
        reject(
          new AppError(
            502,
            'TRANSCRIPTION_FAILED',
            'Não consegui entender esse áudio. Tente gravar novamente.',
            true,
          ),
        );
        return;
      }
      resolve({
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      });
    });
  });
}

export class DisabledTranscriber implements Transcriber {
  readonly name = 'disabled';
  readonly configured = false;

  async transcribe(_input: TranscriptionInput): Promise<string> {
    throw new AppError(
      503,
      'TRANSCRIPTION_UNAVAILABLE',
      'A gravação está pronta, mas o Whisper local ainda não foi instalado neste computador.',
    );
  }
}

export class WhisperCppTranscriber implements Transcriber {
  readonly name = 'whisper-cpp';
  readonly configured = true;

  constructor(
    private readonly whisperBin: string,
    private readonly whisperModel: string,
    private readonly ffprobeBin: string,
    private readonly ffmpegBin: string,
    private readonly timeoutMs: number,
    private readonly maxSeconds: number,
  ) {
    if (
      !isAbsolute(whisperBin) ||
      !isAbsolute(whisperModel) ||
      !isAbsolute(ffprobeBin) ||
      !isAbsolute(ffmpegBin)
    ) {
      throw new Error(
        'Os caminhos do Whisper, ffprobe e ffmpeg precisam ser absolutos.',
      );
    }
  }

  private async validateDuration(input: TranscriptionInput): Promise<void> {
    if (input.claimedDurationMs <= 0 || input.claimedDurationMs > this.maxSeconds * 1_000) {
      throw new AppError(
        422,
        'AUDIO_DURATION_INVALID',
        `O áudio precisa ter no máximo ${this.maxSeconds} segundos.`,
      );
    }
    const result = await runProcess(
      this.ffprobeBin,
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        input.filePath,
      ],
      Math.min(this.timeoutMs, 20_000),
      16_000,
      input.signal,
    );
    const measuredSeconds = Number(result.stdout.trim());
    if (
      !Number.isFinite(measuredSeconds) ||
      measuredSeconds <= 0 ||
      measuredSeconds > this.maxSeconds + 0.5
    ) {
      throw new AppError(
        422,
        'AUDIO_DURATION_INVALID',
        `O áudio precisa ter no máximo ${this.maxSeconds} segundos.`,
      );
    }
  }

  async transcribe(input: TranscriptionInput): Promise<string> {
    await this.validateDuration(input);
    const outputBase = `${input.filePath}.transcript`;
    const outputFile = `${outputBase}.txt`;
    const convertedWav = `${input.filePath}.16k.wav`;
    try {
      await runProcess(
        this.ffmpegBin,
        [
          '-nostdin',
          '-hide_banner',
          '-loglevel',
          'error',
          '-y',
          '-i',
          input.filePath,
          '-ar',
          '16000',
          '-ac',
          '1',
          '-c:a',
          'pcm_s16le',
          convertedWav,
        ],
        Math.min(this.timeoutMs, 45_000),
        256_000,
        input.signal,
      );
      await runProcess(
        this.whisperBin,
        [
          '-m',
          this.whisperModel,
          '-f',
          convertedWav,
          '-l',
          'pt',
          '-otxt',
          '-of',
          outputBase,
        ],
        this.timeoutMs,
        256_000,
        input.signal,
      );
      const transcript = (await readFile(outputFile, 'utf8')).trim();
      if (!transcript || transcript.length > 4_000) {
        throw new AppError(
          422,
          'INVALID_TRANSCRIPT',
          'A transcrição ficou vazia ou grande demais. Tente um áudio mais curto.',
        );
      }
      return transcript;
    } finally {
      await unlink(outputFile).catch(() => undefined);
      await unlink(convertedWav).catch(() => undefined);
    }
  }
}

export function createTranscriber(config: ServerConfig): Transcriber {
  if (config.transcriptionProvider === 'disabled') {
    return new DisabledTranscriber();
  }
  return new WhisperCppTranscriber(
    config.whisperBin!,
    config.whisperModel!,
    config.ffprobeBin!,
    config.ffmpegBin!,
    config.transcriptionTimeoutMs,
    config.maxAudioSeconds,
  );
}
