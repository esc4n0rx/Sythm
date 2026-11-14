import cors from '@fastify/cors';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { DEFAULT_PRESETS, compileSythmCode } from '@sythm/core';
import { AuthStore, verifyToken } from '../storage/AuthStore.js';

interface CompileRequestBody {
  code?: unknown;
}

function extractBearerUserId(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return verifyToken(header.slice(7).trim());
}

async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<string | null> {
  const userId = extractBearerUserId(request);
  if (!userId) {
    await reply.status(401).send({ error: 'Não autenticado. Faça login novamente.' });
    return null;
  }
  return userId;
}

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });
  const authStore = new AuthStore();

  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  app.get('/api/health', async () => {
    return {
      status: 'ok',
      service: 'sythm-backend',
      timestamp: new Date().toISOString(),
    };
  });

  app.get('/api/presets', async () => {
    return {
      presets: DEFAULT_PRESETS,
    };
  });

  app.post<{ Body: CompileRequestBody }>('/api/compile', async (request, reply) => {
    const body = request.body;
    if (!body || typeof body.code !== 'string') {
      return reply.status(400).send({
        success: false,
        error: 'O campo "code" (string) é obrigatório.',
      });
    }

    const startTime = performance.now();
    const result = compileSythmCode(body.code);
    const durationMs = Math.round((performance.now() - startTime) * 100) / 100;

    return {
      ...result,
      durationMs,
    };
  });

  // --- Auth & Profile ---
  app.post('/api/auth/register', async (request, reply) => {
    const body = (request.body ?? {}) as { username?: unknown; email?: unknown; password?: unknown };
    if (
      typeof body.username !== 'string' ||
      typeof body.email !== 'string' ||
      typeof body.password !== 'string'
    ) {
      return reply.status(400).send({ error: 'username, email e password são obrigatórios.' });
    }
    try {
      const result = await authStore.register(body.username, body.email, body.password);
      return result;
    } catch (err) {
      return reply.status(400).send({
        error: err instanceof Error ? err.message : 'Erro ao registrar usuário.',
      });
    }
  });

  app.post('/api/auth/login', async (request, reply) => {
    const body = (request.body ?? {}) as { emailOrUsername?: unknown; password?: unknown };
    if (typeof body.emailOrUsername !== 'string' || typeof body.password !== 'string') {
      return reply.status(400).send({ error: 'emailOrUsername e password são obrigatórios.' });
    }
    try {
      const result = await authStore.login(body.emailOrUsername, body.password);
      return result;
    } catch (err) {
      return reply.status(401).send({
        error: err instanceof Error ? err.message : 'Credenciais inválidas.',
      });
    }
  });

  app.get('/api/auth/me', async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const user = await authStore.getUserById(userId);
    if (!user) {
      return reply.status(404).send({ error: 'Usuário não encontrado.' });
    }
    return { user };
  });

  // --- User Cloud Workspace ---
  app.get('/api/workspace', async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const workspace = await authStore.getWorkspace(userId);
    return { workspace };
  });

  app.put('/api/workspace', async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const body = (request.body ?? {}) as { workspace?: unknown };
    if (!body || typeof body.workspace !== 'object' || body.workspace === null) {
      return reply.status(400).send({ error: 'Campo "workspace" inválido.' });
    }
    await authStore.saveWorkspace(userId, body.workspace);
    return { ok: true };
  });

  // --- Friends & Code Sharing ---
  app.get('/api/friends', async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const friends = await authStore.listFriends(userId);
    return { friends };
  });

  app.post('/api/friends', async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const body = (request.body ?? {}) as { identifier?: unknown };
    if (typeof body.identifier !== 'string' || !body.identifier.trim()) {
      return reply.status(400).send({ error: 'Informe o username ou e-mail do amigo.' });
    }
    try {
      const friend = await authStore.addFriend(userId, body.identifier);
      return { friend };
    } catch (err) {
      return reply.status(400).send({
        error: err instanceof Error ? err.message : 'Não foi possível adicionar amigo.',
      });
    }
  });

  app.delete<{ Params: { friendId: string } }>('/api/friends/:friendId', async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    await authStore.removeFriend(userId, request.params.friendId);
    return { ok: true };
  });

  app.post('/api/friends/share', async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const body = (request.body ?? {}) as { friendId?: unknown; title?: unknown; code?: unknown };
    if (typeof body.friendId !== 'string' || typeof body.code !== 'string') {
      return reply.status(400).send({ error: 'friendId e code são obrigatórios.' });
    }
    try {
      const snippet = await authStore.shareCodeWithFriend(
        userId,
        body.friendId,
        typeof body.title === 'string' ? body.title : 'Shared Track',
        body.code,
      );
      return { snippet };
    } catch (err) {
      return reply.status(400).send({
        error: err instanceof Error ? err.message : 'Erro ao compartilhar código.',
      });
    }
  });

  app.get('/api/friends/shared', async (request, reply) => {
    const userId = await requireAuth(request, reply);
    if (!userId) return;
    const data = await authStore.getSharedCodes(userId);
    return data;
  });

  return app;
}
