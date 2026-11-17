import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppError } from '../src/application/ports/IAuthStore.js';
import { createPool, runMigrations } from '../src/infrastructure/db/pool.js';
import { PostgresAuthStore } from '../src/infrastructure/storage/PostgresAuthStore.js';

/**
 * Teste de integração real. Só roda com um Postgres descartável:
 *   TEST_DATABASE_URL=postgres://... pnpm --filter @sythm/backend test
 * ATENÇÃO: recria o schema `public` do banco informado.
 */
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('PostgresAuthStore (integração)', () => {
  let pool: ReturnType<typeof createPool>;
  let store: PostgresAuthStore;

  beforeAll(async () => {
    pool = createPool({ databaseUrl: url, databaseSsl: process.env.TEST_DATABASE_SSL === 'true', databasePoolMax: 4 });
    store = new PostgresAuthStore(pool);
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    expect(await runMigrations(pool)).toEqual([1]);
    expect(await runMigrations(pool)).toEqual([]); // idempotente
  });
  afterAll(() => store.close());

  it('registra, impede duplicados (case-insensitive) e faz login', async () => {
    const a = await store.register('Alice', 'alice@x.com', 'senha-forte-1');
    expect(a.user.username).toBe('Alice');
    await expect(store.register('alice', 'outra@x.com', 'senha-forte-1')).rejects.toMatchObject({ status: 409 });
    await expect(store.register('Outra', 'alice@x.com', 'senha-forte-1')).rejects.toMatchObject({ status: 409 });
    expect((await store.login('ALICE', 'senha-forte-1')).user.id).toBe(a.user.id);
    await expect(store.login('alice', 'errada')).rejects.toBeInstanceOf(AppError);
  });

  it('revoga tokens, grava workspace, amizade simétrica e compartilhamento', async () => {
    const a = await store.login('alice', 'senha-forte-1');
    const b = await store.register('Bob', 'bob@x.com', 'senha-forte-1');

    expect(await store.revokeTokens(a.user.id)).toBe(1);
    expect((await store.getAuthenticatedUser(a.user.id))?.tokenVersion).toBe(1);

    await store.saveWorkspace(a.user.id, { files: [1] });
    await store.saveWorkspace(a.user.id, { files: [1, 2] });
    expect(await store.getWorkspace(a.user.id)).toEqual({ files: [1, 2] });

    await expect(store.shareCodeWithFriend(a.user.id, b.user.id, 't', 'c')).rejects.toMatchObject({ status: 403 });
    await store.addFriend(a.user.id, 'bob');
    await expect(store.addFriend(a.user.id, 'bob')).rejects.toMatchObject({ status: 409 });
    expect((await store.listFriends(b.user.id)).map((u) => u.username)).toEqual(['Alice']);

    const s = await store.shareCodeWithFriend(a.user.id, b.user.id, '  ', 'HEADER DIVISION.');
    expect(s.title).toBe('Shared Track');
    expect((await store.getSharedCodes(b.user.id)).inbox[0]?.fromUsername).toBe('Alice');

    await store.removeFriend(b.user.id, a.user.id);
    expect(await store.listFriends(a.user.id)).toEqual([]);
  });
});
