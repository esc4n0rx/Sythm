import pg from 'pg';
import type { AppConfig } from '../../config.js';
import { MIGRATIONS } from './migrations.js';

export function createPool(
  config: Pick<AppConfig, 'databaseUrl' | 'databaseSsl' | 'databasePoolMax'>,
): pg.Pool {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL não configurada. Veja apps/backend/.env.example.');
  }
  return new pg.Pool({
    connectionString: config.databaseUrl,
    ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
    max: config.databasePoolMax,
  });
}

const MIGRATION_LOCK_KEY = 727274;

/** Aplica migrations pendentes (cada uma em transação), com advisory lock para múltiplas instâncias. */
export async function runMigrations(pool: pg.Pool): Promise<number[]> {
  const client = await pool.connect();
  const applied: number[] = [];
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id         integer PRIMARY KEY,
        name       text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`);
    const { rows } = await client.query<{ id: number }>('SELECT id FROM schema_migrations');
    const done = new Set(rows.map((r) => r.id));
    for (const m of [...MIGRATIONS].sort((a, b) => a.id - b.id)) {
      if (done.has(m.id)) continue;
      try {
        await client.query('BEGIN');
        await client.query(m.sql);
        await client.query('INSERT INTO schema_migrations (id, name) VALUES ($1, $2)', [m.id, m.name]);
        await client.query('COMMIT');
        applied.push(m.id);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]).catch(() => undefined);
    client.release();
  }
  return applied;
}
