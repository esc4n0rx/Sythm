import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { ZodError, type ZodType } from 'zod';
import { DEFAULT_PRESETS, compileSythmCode } from '@sythm/core';
import {
  AppError,
  type AuthenticatedUser,
  type IAuthStore,
} from '../../application/ports/IAuthStore.js';
import type { AppConfig } from '../../config.js';
import { TokenService } from '../auth/TokenService.js';
import {
  LIMITS,
  addFriendSchema,
  compileSchema,
  friendParamsSchema,
  loginSchema,
  registerSchema,
  shareSchema,
  workspaceSchema,
} from './schemas.js';

export interface ServerDeps {
  config: AppConfig;
  store: IAuthStore;
}

function parse<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data ?? {});
  if (!result.success) {
    throw new AppError(400, result.error.issues[0]?.message ?? 'Requisição inválida.');
  }
  return result.data;
}

export async function buildServer({ config, store }: ServerDeps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: config.env === 'test' ? false : { redact: ['req.headers.authorization'] },
    bodyLimit: LIMITS.bodyBytes,
    trustProxy: config.trustProxy,
  });
  const tokens = new TokenService(config.authSecret, config.tokenTtlMs);

  await app.register(helmet);
  await app.register(cors, {
    origin: config.corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });
  await app.register(rateLimit, {
    global: true,
    max: config.rateLimitMax,
    timeWindow: '1 minute',
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.status).send({ error: error.message });
    }
    if (error instanceof ZodError) {
      return reply.status(400).send({ error: error.issues[0]?.message ?? 'Requisição inválida.' });
    }
    const status = (error as { statusCode?: number }).statusCode;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      // Erros do Fastify (payload grande, JSON inválido, rate limit...).
      const message =
        status === 429
          ? 'Muitas requisições. Tente novamente em instantes.'
          : error instanceof Error
            ? error.message
            : 'Requisição inválida.';
      return reply.status(status).send({ error: message });
    }
    request.log.error(error);
    return reply.status(500).send({ error: 'Erro interno do servidor.' });
  });

  /** Valida o Bearer token (assinatura, expiração e versão de revogação). */
  async function authenticate(request: FastifyRequest): Promise<AuthenticatedUser> {
    const header = request.headers.authorization;
    const claims =
      header && header.startsWith('Bearer ') ? tokens.verify(header.slice(7).trim()) : null;
    const current = claims ? await store.getAuthenticatedUser(claims.userId) : null;
    if (!claims || !current || current.tokenVersion !== claims.tokenVersion) {
      throw new AppError(401, 'Não autenticado. Faça login novamente.');
    }
    return current;
  }

  const authRateLimit = {
    config: { rateLimit: { max: config.rateLimitAuthMax, timeWindow: '1 minute' } },
  };

  app.get('/api/health', async () => ({
    status: 'ok',
    service: 'sythm-backend',
    timestamp: new Date().toISOString(),
  }));

  app.get('/api/presets', async () => ({ presets: DEFAULT_PRESETS }));

  app.post('/api/compile', async (request) => {
    const { code } = parse(compileSchema, request.body);
    const startTime = performance.now();
    const result = compileSythmCode(code);
    const durationMs = Math.round((performance.now() - startTime) * 100) / 100;
    return { ...result, durationMs };
  });

  // --- Auth & Profile ---
  app.post('/api/auth/register', authRateLimit, async (request) => {
    const { username, email, password } = parse(registerSchema, request.body);
    const { user, tokenVersion } = await store.register(username, email, password);
    return { token: tokens.issue(user.id, tokenVersion), user };
  });

  app.post('/api/auth/login', authRateLimit, async (request) => {
    const { emailOrUsername, password } = parse(loginSchema, request.body);
    const { user, tokenVersion } = await store.login(emailOrUsername, password);
    return { token: tokens.issue(user.id, tokenVersion), user };
  });

  app.get('/api/auth/me', async (request) => {
    const { user } = await authenticate(request);
    return { user };
  });

  /** Troca um token ainda válido por um novo (renova a expiração). */
  app.post('/api/auth/refresh', async (request) => {
    const { user, tokenVersion } = await authenticate(request);
    return { token: tokens.issue(user.id, tokenVersion), user };
  });

  /** Revoga todos os tokens emitidos para o usuário (logout em todos os dispositivos). */
  app.post('/api/auth/logout-all', async (request) => {
    const { user } = await authenticate(request);
    await store.revokeTokens(user.id);
    return { ok: true };
  });

  // --- User Cloud Workspace ---
  app.get('/api/workspace', async (request) => {
    const { user } = await authenticate(request);
    return { workspace: await store.getWorkspace(user.id) };
  });

  app.put('/api/workspace', { bodyLimit: LIMITS.workspaceBytes }, async (request) => {
    const { user } = await authenticate(request);
    const { workspace } = parse(workspaceSchema, request.body);
    await store.saveWorkspace(user.id, workspace);
    return { ok: true };
  });

  // --- Friends & Code Sharing ---
  app.get('/api/friends', async (request) => {
    const { user } = await authenticate(request);
    return { friends: await store.listFriends(user.id) };
  });

  app.post('/api/friends', async (request) => {
    const { user } = await authenticate(request);
    const { identifier } = parse(addFriendSchema, request.body);
    return { friend: await store.addFriend(user.id, identifier) };
  });

  app.delete('/api/friends/:friendId', async (request) => {
    const { user } = await authenticate(request);
    const { friendId } = parse(friendParamsSchema, request.params);
    await store.removeFriend(user.id, friendId);
    return { ok: true };
  });

  app.post('/api/friends/share', async (request) => {
    const { user } = await authenticate(request);
    const { friendId, title, code } = parse(shareSchema, request.body);
    const snippet = await store.shareCodeWithFriend(user.id, friendId, title ?? 'Shared Track', code);
    return { snippet };
  });

  app.get('/api/friends/shared', async (request) => {
    const { user } = await authenticate(request);
    return store.getSharedCodes(user.id);
  });

  app.addHook('onClose', async () => {
    await store.close();
  });

  return app;
}
