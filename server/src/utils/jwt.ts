import jwt from 'jsonwebtoken';
import { env } from '../config/environment';

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  tokenVersion: number;
}

export function signToken(payload: TokenPayload): string {
  const options: jwt.SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as any,
  };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
}
