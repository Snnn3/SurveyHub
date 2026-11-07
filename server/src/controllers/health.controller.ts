import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { ServiceUnavailableError } from '../utils/errors';

export async function getHealthCheck(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Run a fast raw query to confirm database connectivity
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      success: true,
      data: {
        status: 'ok',
        database: 'up',
      },
    });
  } catch (error) {
    next(new ServiceUnavailableError('Database connection failed.'));
  }
}
