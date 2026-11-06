import { Request, Response, NextFunction } from 'express';
import { HttpError } from '../utils/errors';
import { env } from '../config/environment';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details && env.NODE_ENV !== 'production' ? { details: err.details } : {}),
      },
    });
    return;
  }

  // Handle Unexpected Server Errors
  if (env.NODE_ENV !== 'production') {
    console.error('[Unhandled Server Error]:', err);
  }

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected internal server error occurred.',
    },
  });
}
