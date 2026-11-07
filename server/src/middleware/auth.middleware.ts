import { Role, User } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/environment';
import { HttpError } from '../utils/errors';
import { prisma } from '../utils/prisma';

type AuthenticatedUser = Pick<User, 'id' | 'email' | 'fullName' | 'role' | 'tokenVersion'>;

declare global {
  namespace Express {
    interface Request {
      auth?: AuthenticatedUser;
    }
  }
}

const invalidToken = () => new HttpError(401, 'INVALID_TOKEN', 'Authentication token is invalid.');

export async function authenticateJWT(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authorization = req.get('Authorization');
  if (!authorization) {
    next(new HttpError(401, 'TOKEN_REQUIRED', 'Authentication token is required.'));
    return;
  }

  const match = /^Bearer\s+(\S+)$/i.exec(authorization);
  if (!match) {
    next(invalidToken());
    return;
  }

  let payload: string | jwt.JwtPayload;
  try {
    payload = jwt.verify(match[1], env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    next(invalidToken());
    return;
  }

  if (typeof payload === 'string' || typeof payload.sub !== 'string' || !Number.isInteger(payload.ver)) {
    next(invalidToken());
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, fullName: true, role: true, tokenVersion: true },
    });
    if (!user) {
      next(invalidToken());
      return;
    }
    if (user.tokenVersion !== payload.ver) {
      next(new HttpError(401, 'TOKEN_REVOKED', 'Authentication token has been revoked.'));
      return;
    }

    req.auth = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(new HttpError(401, 'TOKEN_REQUIRED', 'Authentication token is required.'));
      return;
    }
    if (!allowedRoles.includes(req.auth.role)) {
      next(new HttpError(403, 'FORBIDDEN_ROLE', 'Your role does not allow this operation.'));
      return;
    }
    next();
  };
}
