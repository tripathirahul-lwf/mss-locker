import { app } from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { seedDatabase } from './seed/seed';
import { logger } from './utils/logger';

const startServer = async (): Promise<void> => {
  // Do not accept API traffic until MongoDB is ready. Atlas/DNS can take a few
  // seconds after a development restart, so retry explicitly instead of
  // exposing a running HTTP server whose data routes all return 500.
  let databaseConnected = false;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    databaseConnected = await connectDatabase();
    if (databaseConnected) break;
    logger.warn(`MongoDB startup connection attempt ${attempt}/3 failed.`);
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
  }
  if (!databaseConnected) {
    throw new Error('MongoDB is unavailable after 3 startup attempts; HTTP server was not started.');
  }

  // Run initial idempotent seed (roles & super admin)
  try {
    await seedDatabase();
  } catch (err) {
    logger.warn('Seed step on startup encountered an issue (will retry on next restart):', err);
  }

  const server = app.listen(env.PORT, () => {
    logger.info(`MSS Locker API Server listening on port ${env.PORT} [${env.NODE_ENV}]`);
    logger.info(`Health check available at http://localhost:${env.PORT}/api/health`);
  });

  const gracefulShutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} signal received. Closing HTTP server and database connections...`);
    server.close(async () => {
      logger.info('HTTP server closed.');
      await disconnectDatabase();
      process.exit(0);
    });

    // Force close after 10 seconds if graceful shutdown takes too long
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
};

startServer().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
