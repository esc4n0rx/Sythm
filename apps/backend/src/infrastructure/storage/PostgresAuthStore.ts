import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import {
  AppError,
  type AuthenticatedUser,
  type IAuthStore,
  type PublicUser,
  type SharedSnippetRecord,
} from '../../application/ports/IAuthStore.js';
import { hashPassword, verifyPassword } from '../auth/passwords.js';

interface UserRow {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  token_version: number;
  created_at: Date;
}

interface SnippetRow {
  id: string;
  from_user_id: string;
  from_username: string;
  to_user_id: string;
  to_username: string;
  title: string;
  code: string;
  created_at: Date;
}

const PG_UNIQUE_VIOLATION = '23505';
const MAX_SNIPPETS_PER_LIST = 200;
/** Hash fictício para igualar o tempo de resposta quando o usuário não existe. */
const DUMMY_HASH = `${'0'.repeat(32)}:${'0'.repeat(128)}`;

function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    createdAt: row.created_at.toISOString(),
  };
}

function toAuthenticated(row: UserRow): AuthenticatedUser {
  return { user: toPublicUser(row), tokenVersion: row.token_version };
}

function toSnippet(row: SnippetRow): SharedSnippetRecord {
  return {
    id: row.id,
    fromUserId: row.from_user_id,
    fromUsername: row.from_username,
    toUserId: row.to_user_id,
    toUsername: row.to_username,
    title: row.title,
    code: row.code,
    createdAt: row.created_at.toISOString(),
  };
}

function isUniqueViolation(err: unknown): err is { code: string; constraint?: string } {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === PG_UNIQUE_VIOLATION;
}

export class PostgresAuthStore implements IAuthStore {
  constructor(private readonly pool: pg.Pool) {}

  async register(username: string, email: string, password: string): Promise<AuthenticatedUser> {
    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();
    const passwordHash = await hashPassword(password);
    try {
      const { rows } = await this.pool.query<UserRow>(
        `INSERT INTO users (id, username, email, password_hash)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [randomUUID(), cleanUsername, cleanEmail, passwordHash],
      );
      return toAuthenticated(rows[0]!);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new AppError(
          409,
          err.constraint === 'users_email_key'
            ? 'Este e-mail já está cadastrado.'
            : 'Este username já está em uso.',
        );
      }
      throw err;
    }
  }

  async login(emailOrUsername: string, password: string): Promise<AuthenticatedUser> {
    const identifier = emailOrUsername.trim().toLowerCase();
    const { rows } = await this.pool.query<UserRow>(
      'SELECT * FROM users WHERE email = $1 OR lower(username) = $1 LIMIT 1',
      [identifier],
    );
    const row = rows[0];
    const ok = await verifyPassword(password, row?.password_hash ?? DUMMY_HASH);
    if (!row || !ok) {
      throw new AppError(401, 'Credenciais inválidas.');
    }
    return toAuthenticated(row);
  }

  async getAuthenticatedUser(userId: string): Promise<AuthenticatedUser | null> {
    const { rows } = await this.pool.query<UserRow>('SELECT * FROM users WHERE id = $1', [userId]);
    return rows[0] ? toAuthenticated(rows[0]) : null;
  }

  async revokeTokens(userId: string): Promise<number> {
    const { rows } = await this.pool.query<{ token_version: number }>(
      'UPDATE users SET token_version = token_version + 1 WHERE id = $1 RETURNING token_version',
      [userId],
    );
    if (!rows[0]) throw new AppError(404, 'Usuário não encontrado.');
    return rows[0].token_version;
  }

  async getWorkspace(userId: string): Promise<unknown | null> {
    const { rows } = await this.pool.query<{ data: unknown }>(
      'SELECT data FROM workspaces WHERE user_id = $1',
      [userId],
    );
    return rows[0]?.data ?? null;
  }

  async saveWorkspace(userId: string, workspace: unknown): Promise<void> {
    await this.pool.query(
      `INSERT INTO workspaces (user_id, data, updated_at) VALUES ($1, $2::jsonb, now())
       ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [userId, JSON.stringify(workspace)],
    );
  }

  async listFriends(userId: string): Promise<PublicUser[]> {
    const { rows } = await this.pool.query<UserRow>(
      `SELECT u.* FROM friendships f JOIN users u ON u.id = f.friend_id
       WHERE f.user_id = $1 ORDER BY lower(u.username)`,
      [userId],
    );
    return rows.map(toPublicUser);
  }

  async addFriend(userId: string, identifier: string): Promise<PublicUser> {
    const clean = identifier.trim().toLowerCase();
    const { rows } = await this.pool.query<UserRow>(
      'SELECT * FROM users WHERE email = $1 OR lower(username) = $1 LIMIT 1',
      [clean],
    );
    const target = rows[0];
    if (!target) throw new AppError(404, 'Usuário não encontrado com esse username ou e-mail.');
    if (target.id === userId) throw new AppError(400, 'Você não pode adicionar a si mesmo.');

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query(
        'INSERT INTO friendships (user_id, friend_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userId, target.id],
      );
      if (res.rowCount === 0) {
        await client.query('ROLLBACK');
        throw new AppError(409, `${target.username} já está na sua lista de amigos.`);
      }
      await client.query(
        'INSERT INTO friendships (user_id, friend_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [target.id, userId],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
    return toPublicUser(target);
  }

  async removeFriend(userId: string, friendId: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM friendships
       WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
      [userId, friendId],
    );
  }

  async shareCodeWithFriend(
    fromUserId: string,
    toUserId: string,
    title: string,
    code: string,
  ): Promise<SharedSnippetRecord> {
    // Só é possível compartilhar com amigos (antes qualquer userId existente era aceito).
    const { rows: friendRows } = await this.pool.query(
      'SELECT 1 FROM friendships WHERE user_id = $1 AND friend_id = $2',
      [fromUserId, toUserId],
    );
    if (friendRows.length === 0) {
      throw new AppError(403, 'Você só pode compartilhar código com amigos.');
    }
    const id = randomUUID();
    await this.pool.query(
      `INSERT INTO shared_snippets (id, from_user_id, to_user_id, title, code)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, fromUserId, toUserId, title.trim() || 'Shared Track', code],
    );
    const { rows } = await this.pool.query<SnippetRow>(SNIPPET_SELECT + ' WHERE s.id = $1', [id]);
    return toSnippet(rows[0]!);
  }

  async getSharedCodes(
    userId: string,
  ): Promise<{ inbox: SharedSnippetRecord[]; sent: SharedSnippetRecord[] }> {
    const [inbox, sent] = await Promise.all([
      this.pool.query<SnippetRow>(
        `${SNIPPET_SELECT} WHERE s.to_user_id = $1 ORDER BY s.created_at DESC LIMIT ${MAX_SNIPPETS_PER_LIST}`,
        [userId],
      ),
      this.pool.query<SnippetRow>(
        `${SNIPPET_SELECT} WHERE s.from_user_id = $1 ORDER BY s.created_at DESC LIMIT ${MAX_SNIPPETS_PER_LIST}`,
        [userId],
      ),
    ]);
    return { inbox: inbox.rows.map(toSnippet), sent: sent.rows.map(toSnippet) };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

const SNIPPET_SELECT = `
  SELECT s.id, s.from_user_id, fu.username AS from_username,
         s.to_user_id, tu.username AS to_username, s.title, s.code, s.created_at
  FROM shared_snippets s
  JOIN users fu ON fu.id = s.from_user_id
  JOIN users tu ON tu.id = s.to_user_id`;
