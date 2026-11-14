import { app } from 'src/app';
import { pushService } from 'src/services/firebase.service';
import { logger } from 'src/utils/logger';
import { env } from 'src/configs/env.config';

/**
 * Start Express server.
 */

const server = app.listen(app.get('port'), () => {
  logger.info('HTTP server started', {
    port: app.get('port'),
    environment: app.get('env'),
  });
});

let isShuttingDown = false;

const shutdown = (reason: string, exitCode = 0) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info('Server shutdown started', { reason });

  const forceShutdownTimer = setTimeout(() => {
    logger.error('Server shutdown timed out', { timeoutMs: env.shutdownTimeoutMs });
    process.exit(1);
  }, env.shutdownTimeoutMs);
  forceShutdownTimer.unref();

  server.closeIdleConnections();
  server.close(async () => {
    await pushService.drain(Math.min(5000, env.shutdownTimeoutMs));
    clearTimeout(forceShutdownTimer);
    logger.info('HTTP server closed');
    process.exit(exitCode);
  });
};

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (error) => logger.error('Unhandled promise rejection', { error }));
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error });
  shutdown('uncaughtException', 1);
});

export default server;
