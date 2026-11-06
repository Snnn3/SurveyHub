import app from './app';
import { env } from './config/environment';
import { prisma } from './utils/prisma';

async function startServer() {
  try {
    // Check initial database connectivity
    await prisma.$queryRaw`SELECT 1`;
    console.log('[Database] Connected successfully to PostgreSQL.');
  } catch (error) {
    console.warn(
      '[Database] Initial connection check failed. HTTP listener starting; health probe will report 503 until connected:',
      error
    );
  }

  app.listen(env.PORT, () => {
    console.log(`[Server] SurveyHub server listening on port ${env.PORT} in ${env.NODE_ENV} mode.`);
    console.log(`[Health] Probe available at http://localhost:${env.PORT}/api/health`);
  });
}

if (require.main === module) {
  startServer();
}

export { app };
