import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { z } from 'zod';

const storedSessionSchema = z.object({
  sessionId: z.string().min(1).max(160),
});

export class SessionStore {
  private readonly filePath: string;

  constructor(filePath = resolve(process.cwd(), 'var', 'hermes-session.json')) {
    this.filePath = filePath;
  }

  async load(): Promise<string | null> {
    try {
      const parsed = storedSessionSchema.safeParse(
        JSON.parse(await readFile(this.filePath, 'utf8')),
      );
      return parsed.success ? parsed.data.sessionId : null;
    } catch {
      return null;
    }
  }

  async save(sessionId: string): Promise<void> {
    const value = storedSessionSchema.parse({ sessionId });
    const folder = dirname(this.filePath);
    const temporary = `${this.filePath}.${process.pid}.tmp`;
    await mkdir(folder, { recursive: true, mode: 0o700 });
    await writeFile(temporary, `${JSON.stringify(value)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
    await rename(temporary, this.filePath);
    await chmod(this.filePath, 0o600);
  }
}
