import 'dotenv/config';
import { loadConfig } from '../../config.js';
import { createPool, runMigrations } from './pool.js';

/** Uso: `pnpm --filter @sythm/backend migrate` */
const pool = createPool(loadConfig());
try {
  const applied = await runMigrations(pool);
  console.log(applied.length ? `Migrations aplicadas: ${applied.join(', ')}` : 'Banco já está atualizado.');
} finally {
  await pool.end();
}
