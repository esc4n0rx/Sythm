import 'dotenv/config';
import { ConfigError, loadConfig } from './config.js';
import { createPool, runMigrations } from './infrastructure/db/pool.js';
import { buildServer } from './infrastructure/http/server.js';
import { PostgresAuthStore } from './infrastructure/storage/PostgresAuthStore.js';

async function bootstrap(): Promise<void> {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(`[sythm-backend] ${err.message}`);
      process.exit(1);
    }
    throw err;
  }

  const pool = createPool(config);
  const applied = await runMigrations(pool);
  if (applied.length > 0) {
    console.log(`[sythm-backend] Migrations aplicadas: ${applied.join(', ')}`);
  }

  const app = await buildServer({ config, store: new PostgresAuthStore(pool) });

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info(`${signal} recebido, encerrando...`);
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  try {
    await app.listen({ port: config.port, host: config.host });
    console.log(`[sythm-backend] Listening on http://localhost:${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

bootstrap().catch((err) => {
  console.error('[sythm-backend] Falha ao iniciar:', err);
  process.exit(1);
});
