import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { buildServer } from '../src/infrastructure/http/server.js';
import { InMemoryAuthStore } from './InMemoryAuthStore.js';

let app: FastifyInstance;
let store: InMemoryAuthStore;

async function boot(env: Record<string, string> = {}) {
  store = new InMemoryAuthStore();
  app = await buildServer({ config: loadConfig({ NODE_ENV: 'test', ...env }), store });
}

async function register(username: string, email = `${username}@x.com`, password = 'senha-forte-1') {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { username, email, password },
  });
  return { res, body: res.json() as { token: string; user: { id: string }; error?: string } };
}

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

afterEach(async () => {
  await app.close();
});

describe('validação e auth', () => {
  beforeEach(() => boot());

  it('registra, autentica e rejeita duplicados', async () => {
    const { res, body } = await register('alice');
    expect(res.statusCode).toBe(200);
    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: bearer(body.token) });
    expect(me.statusCode).toBe(200);

    const dup = await register('ALICE', 'outra@x.com');
    expect(dup.res.statusCode).toBe(409);
  });

  it('valida senha curta, e-mail e username', async () => {
    expect((await register('bob', 'bob@x.com', '1234567')).res.statusCode).toBe(400);
    expect((await register('bob', 'invalido')).res.statusCode).toBe(400);
    expect((await register('b')).res.statusCode).toBe(400);
    expect((await register('com espaço')).res.statusCode).toBe(400);
  });

  it('login retorna 401 para credenciais erradas', async () => {
    await register('alice');
    const bad = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { emailOrUsername: 'alice', password: 'errada-errada' },
    });
    expect(bad.statusCode).toBe(401);
    const ok = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { emailOrUsername: 'alice@x.com', password: 'senha-forte-1' },
    });
    expect(ok.statusCode).toBe(200);
  });

  it('exige token nas rotas protegidas', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/workspace' })).statusCode).toBe(401);
    expect(
      (await app.inject({ method: 'GET', url: '/api/workspace', headers: bearer('x.y') })).statusCode,
    ).toBe(401);
  });

  it('refresh emite novo token e logout-all revoga os anteriores', async () => {
    const { body } = await register('alice');
    const refreshed = await app.inject({ method: 'POST', url: '/api/auth/refresh', headers: bearer(body.token) });
    expect(refreshed.statusCode).toBe(200);
    const newToken = (refreshed.json() as { token: string }).token;

    await app.inject({ method: 'POST', url: '/api/auth/logout-all', headers: bearer(newToken) });
    for (const t of [body.token, newToken]) {
      const res = await app.inject({ method: 'GET', url: '/api/auth/me', headers: bearer(t) });
      expect(res.statusCode).toBe(401);
    }
  });

  it('workspace: grava e lê; rejeita formato inválido', async () => {
    const { body } = await register('alice');
    const put = await app.inject({
      method: 'PUT',
      url: '/api/workspace',
      headers: bearer(body.token),
      payload: { workspace: { files: [] } },
    });
    expect(put.statusCode).toBe(200);
    const get = await app.inject({ method: 'GET', url: '/api/workspace', headers: bearer(body.token) });
    expect(get.json()).toEqual({ workspace: { files: [] } });
    const bad = await app.inject({
      method: 'PUT',
      url: '/api/workspace',
      headers: bearer(body.token),
      payload: { workspace: 'texto' },
    });
    expect(bad.statusCode).toBe(400);
  });

  it('amigos: só compartilha código com amigos', async () => {
    const a = await register('alice');
    const b = await register('bob');
    const share = (token: string, friendId: string) =>
      app.inject({
        method: 'POST',
        url: '/api/friends/share',
        headers: bearer(token),
        payload: { friendId, code: 'HEADER DIVISION.' },
      });

    expect((await share(a.body.token, b.body.user.id)).statusCode).toBe(403);
    const add = await app.inject({
      method: 'POST',
      url: '/api/friends',
      headers: bearer(a.body.token),
      payload: { identifier: 'bob' },
    });
    expect(add.statusCode).toBe(200);
    expect((await share(a.body.token, b.body.user.id)).statusCode).toBe(200);
    const inbox = await app.inject({ method: 'GET', url: '/api/friends/shared', headers: bearer(b.body.token) });
    expect((inbox.json() as { inbox: unknown[] }).inbox).toHaveLength(1);
    expect((await share(a.body.token, 'nao-uuid')).statusCode).toBe(400);
  });
});

describe('compile', () => {
  beforeEach(() => boot());

  it('compila código válido e valida o body', async () => {
    const ok = await app.inject({ method: 'POST', url: '/api/compile', payload: { code: '*> vazio' } });
    expect(ok.statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/api/compile', payload: {} })).statusCode).toBe(400);
  });

  it('rejeita código acima do limite', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/compile',
      payload: { code: 'a'.repeat(200_001) },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejeita body acima de bodyLimit com 413', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/compile',
      payload: { code: 'a'.repeat(1_100_000) },
    });
    expect(res.statusCode).toBe(413);
  });
});

describe('rate limit e CORS', () => {
  it('limita tentativas de login (429)', async () => {
    await boot({ RATE_LIMIT_AUTH_MAX: '3' });
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { emailOrUsername: 'x', password: 'y' },
      });
      codes.push(res.statusCode);
    }
    expect(codes).toEqual([401, 401, 401, 429, 429]);
  });

  it('só libera origens da allowlist', async () => {
    await boot({ CORS_ORIGINS: 'https://sythm.app' });
    const allowed = await app.inject({ method: 'GET', url: '/api/health', headers: { origin: 'https://sythm.app' } });
    expect(allowed.headers['access-control-allow-origin']).toBe('https://sythm.app');
    const denied = await app.inject({ method: 'GET', url: '/api/health', headers: { origin: 'https://evil.com' } });
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });
});
