import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';

export async function getHealthCheck(_req: Request, res: Response): Promise<void> {
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
    res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Database connection failed.',
      },
    });
  }
}
