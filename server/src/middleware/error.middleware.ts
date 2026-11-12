import { Request, Response, NextFunction } from 'express';
import { HttpError } from '../utils/errors';
import { env } from '../config/environment';

interface BodyParserError extends Error {
  status?: number;
  statusCode?: number;
  type?: string;
}

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
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  const parserErr = err as BodyParserError;

  // Handle Express body-parser SyntaxError (e.g. malformed JSON)
  if (err instanceof SyntaxError && parserErr.status === 400) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Malformed JSON payload.',
      },
    });
    return;
  }

  // Handle Request Payload Too Large (> 100 kB)
  if (parserErr.type === 'entity.too.large' || parserErr.status === 413) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request payload exceeds the 100 kB limit.',
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
