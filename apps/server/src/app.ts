import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Server as SocketServer } from 'socket.io';
import type { AppConfig } from './config.js';
import type { PokerRepository } from './repository.js';
import { registerSocketServer } from './realtime/socket.js';
import { registerHttpRoutes } from './routes/http.js';
import type { RoomManager } from './room/manager.js';

export interface BuildAppDependencies {
  config: AppConfig;
  repository: PokerRepository;
  rooms: RoomManager;
}

export interface PokerApp {
  app: FastifyInstance;
  io: SocketServer;
}

export async function buildApp(deps: BuildAppDependencies): Promise<PokerApp> {
  const app = Fastify({
    logger:
      deps.config.NODE_ENV === 'test'
        ? false
        : {
            level: deps.config.NODE_ENV === 'production' ? 'info' : 'debug',
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'res.headers.set-cookie',
                '*.password',
                '*.holeCards',
                '*.turnToken',
              ],
              censor: '[REDACTED]',
            },
          },
    trustProxy: deps.config.TRUST_PROXY,
    bodyLimit: 64 * 1_024,
    requestTimeout: 15_000,
  });

  await app.register(cookie, { secret: deps.config.COOKIE_SECRET });
  await app.register(rateLimit, { global: false });

  app.addHook('onSend', async (request, reply, payload) => {
    reply.header('X-Robots-Tag', 'noindex, noarchive');
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    reply.header('Cross-Origin-Opener-Policy', 'same-origin');
    reply.header(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; " +
        "connect-src 'self' ws: wss:; font-src 'self'; object-src 'none'; frame-ancestors 'none'; " +
        "base-uri 'self'; form-action 'self'",
    );
    const pathname = request.url.split('?', 1)[0];
    if (pathname === '/' || pathname?.endsWith('.html')) {
      reply.header('Cache-Control', 'no-store');
    }
    return payload;
  });

  await registerHttpRoutes(app, deps);
  const io = registerSocketServer(app, deps);

  const webRoot = resolve(process.cwd(), deps.config.WEB_DIST_DIR);
  if (existsSync(resolve(webRoot, 'index.html'))) {
    await app.register(fastifyStatic, {
      root: webRoot,
      prefix: '/',
      wildcard: false,
      immutable: true,
      maxAge: '1y',
      index: false,
    });
    app.get('/*', async (request, reply) => {
      if (request.url.startsWith('/api/') || request.url.startsWith('/socket.io/')) {
        return reply.code(404).send({ error: 'NOT_FOUND' });
      }
      return reply.header('Cache-Control', 'no-store').sendFile('index.html');
    });
  } else {
    app.get('/', async () => ({
      name: 'Poker Infinity API',
      build: deps.config.APP_BUILD_SHA,
      message: 'Web build not found; run pnpm --filter @poker/web build',
    }));
  }

  return { app, io };
}
