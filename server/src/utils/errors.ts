export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BadRequestError extends HttpError {
  constructor(message = 'Bad Request', code = 'BAD_REQUEST', details?: unknown) {
    super(400, code, message, details);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = 'Authentication required', code = 'UNAUTHORIZED', details?: unknown) {
    super(401, code, message, details);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = 'Access forbidden', code = 'FORBIDDEN', details?: unknown) {
    super(403, code, message, details);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Resource not found', code = 'NOT_FOUND', details?: unknown) {
    super(404, code, message, details);
  }
}

export class ConflictError extends HttpError {
  constructor(message = 'Resource conflict', code = 'CONFLICT', details?: unknown) {
    super(409, code, message, details);
  }
}

export class ServiceUnavailableError extends HttpError {
  constructor(message = 'Service unavailable', code = 'SERVICE_UNAVAILABLE', details?: unknown) {
    super(503, code, message, details);
  }
}
