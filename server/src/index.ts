import 'dotenv/config';

import { buildApp } from './app.js';
import { loadConfig } from './config.js';

async function main() {
  const config = loadConfig();
  const app = await buildApp(config);
  await app.listen({ host: config.host, port: config.port });
  app.log.info(
    `Agenda Kuromi server disponível somente em http://${config.host}:${config.port}`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Falha ao iniciar servidor.';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
