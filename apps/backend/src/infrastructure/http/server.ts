import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import { DEFAULT_PRESETS, compileSythmCode } from '@sythm/core';

interface CompileRequestBody {
  code?: unknown;
}

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: true,
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

  return app;
}
