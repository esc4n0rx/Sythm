import { buildServer } from './infrastructure/http/server.js';

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? '0.0.0.0';

async function bootstrap(): Promise<void> {
  const app = await buildServer();
  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`[sythm-backend] Listening on http://localhost:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void bootstrap();
