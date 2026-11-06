import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env if present
dotenv.config();

export interface Environment {
  PORT: number;
  NODE_ENV: string;
  DATABASE_URL: string;
  DATABASE_URL_TEST: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  CLIENT_ORIGIN: string;
}

const nodeEnv = process.env.NODE_ENV || 'development';

const jwtSecret = process.env.JWT_SECRET || 'dev-secret-key-surveyhub-cpe334-do-not-use-in-prod';

if (
  nodeEnv === 'production' &&
  (!process.env.JWT_SECRET ||
    process.env.JWT_SECRET === 'replace-with-a-long-random-value' ||
    process.env.JWT_SECRET === 'dev-secret-key-surveyhub-cpe334-do-not-use-in-prod')
) {
  throw new Error(
    'FATAL: Production mode requires a secure, non-default JWT_SECRET. System startup aborted.'
  );
}

export const env: Environment = {
  PORT: parseInt(process.env.PORT || '4000', 10),
  NODE_ENV: nodeEnv,
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/surveyhub?schema=public',
  DATABASE_URL_TEST: process.env.DATABASE_URL_TEST || 'postgresql://postgres:postgres@localhost:5432/surveyhub_test?schema=public',
  JWT_SECRET: jwtSecret,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
};
