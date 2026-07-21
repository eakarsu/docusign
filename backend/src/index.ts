import 'dotenv/config';
import { createServer } from 'node:http';
import { createApp } from './app';
import { logger } from './utils/logger';

const port = Number(process.env.PORT || 3001);
if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error('VALID_PORT_REQUIRED');

const server = createServer(createApp());
server.listen(port, () => logger.info('Server listening', { port }));

let closing = false;
function shutdown(signal: string) {
  if (closing) return;
  closing = true;
  logger.info('Graceful shutdown started', { signal });
  const timeout = setTimeout(() => process.exit(1), 10_000);
  timeout.unref();
  server.close(error => {
    clearTimeout(timeout);
    if (error) logger.error('Graceful shutdown failed', { error });
    process.exit(error ? 1 : 0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
