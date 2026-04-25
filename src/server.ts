import { buildApp } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';

function start(): void {
  const app = buildApp();

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'marketing-flow-api listening');
  });

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'shutting down');
    server.close(() => process.exit(0));
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start();
