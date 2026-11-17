import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from '../../config.js';
import { createPool, runMigrations } from './pool.js';

/**
 * Importa o banco JSON legado (`data/sythm-db.json`) para o Postgres.
 * Idempotente (ON CONFLICT DO NOTHING). Os hashes de senha são compatíveis.
 *
 * Uso: `pnpm --filter @sythm/backend import:json [caminho/do/sythm-db.json]`
 */
interface LegacyDb {
  users?: Array<{ id: string; username: string; email: string; passwordHash: string; createdAt: string }>;
  workspaces?: Record<string, unknown>;
  friends?: Record<string, string[]>;
  sharedSnippets?: Array<{
    id: string;
    fromUserId: string;
    toUserId: string;
    title: string;
    code: string;
    createdAt: string;
  }>;
}

const file = path.resolve(process.argv[2] ?? process.env.SYTHM_DB_PATH ?? 'data/sythm-db.json');
const legacy = JSON.parse(await readFile(file, 'utf8')) as LegacyDb;
const pool = createPool(loadConfig());

try {
  await runMigrations(pool);
  const client = await pool.connect();
  const counts = { users: 0, workspaces: 0, friendships: 0, snippets: 0 };
  try {
    await client.query('BEGIN');
    const ids = new Set<string>();
    for (const u of legacy.users ?? []) {
      const r = await client.query(
        `INSERT INTO users (id, username, email, password_hash, created_at)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
        [u.id, u.username, u.email.toLowerCase(), u.passwordHash, u.createdAt],
      );
      ids.add(u.id);
      counts.users += r.rowCount ?? 0;
    }
    for (const [userId, data] of Object.entries(legacy.workspaces ?? {})) {
      if (!ids.has(userId)) continue;
      const r = await client.query(
        'INSERT INTO workspaces (user_id, data) VALUES ($1, $2::jsonb) ON CONFLICT DO NOTHING',
        [userId, JSON.stringify(data)],
      );
      counts.workspaces += r.rowCount ?? 0;
    }
    for (const [userId, friends] of Object.entries(legacy.friends ?? {})) {
      for (const friendId of friends) {
        if (!ids.has(userId) || !ids.has(friendId) || userId === friendId) continue;
        const r = await client.query(
          'INSERT INTO friendships (user_id, friend_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [userId, friendId],
        );
        counts.friendships += r.rowCount ?? 0;
      }
    }
    for (const s of legacy.sharedSnippets ?? []) {
      if (!ids.has(s.fromUserId) || !ids.has(s.toUserId)) continue;
      const r = await client.query(
        `INSERT INTO shared_snippets (id, from_user_id, to_user_id, title, code, created_at)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
        [s.id, s.fromUserId, s.toUserId, s.title, s.code, s.createdAt],
      );
      counts.snippets += r.rowCount ?? 0;
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  console.log('Importação concluída:', counts);
} finally {
  await pool.end();
}
