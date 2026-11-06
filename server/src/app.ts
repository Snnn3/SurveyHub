import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import { env } from './config/environment';
import apiRoutes from './routes';
import { errorHandler } from './middleware/error.middleware';
import { NotFoundError } from './utils/errors';

export function createApp(): Express {
  const app = express();

  // Security & standard middleware
  app.use(
    helmet({
      contentSecurityPolicy: false, // Allows flexible client bundling in local environments
    })
  );

  app.use(
    cors({
      origin: [env.CLIENT_ORIGIN, 'http://localhost:5173', 'http://localhost:4000'],
      credentials: true,
    })
  );

  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  // Mount API router
  app.use('/api', apiRoutes);

  // Serve static client assets in production / single-origin container
  const clientDistPaths = [
    path.resolve(__dirname, '../../client/dist'),
    path.resolve(__dirname, '../client/dist'),
    path.resolve(process.cwd(), 'client/dist'),
  ];

  let clientDistPath: string | null = null;
  for (const candidate of clientDistPaths) {
    if (fs.existsSync(candidate)) {
      clientDistPath = candidate;
      break;
    }
  }

  if (clientDistPath) {
    app.use(express.static(clientDistPath));
    app.get('*', (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.join(clientDistPath as string, 'index.html'));
    });
  } else {
    // Root fallback when client is not built
    app.get('/', (_req: Request, res: Response) => {
      res.status(200).json({
        name: 'SurveyHub API',
        version: '0.1.0',
        status: 'online',
        endpoints: {
          health: '/api/health',
        },
      });
    });
  }

  // 404 handler for undefined API routes
  app.use('/api/*', (_req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError('The requested API endpoint does not exist.'));
  });

  // Global error handling middleware
  app.use(errorHandler);

  return app;
}

export default createApp();
