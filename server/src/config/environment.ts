import dotenv from 'dotenv';

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

const defaultJwtSecret = 'dev-secret-key-surveyhub-cpe334-do-not-use-in-prod';
const jwtSecret = process.env.JWT_SECRET?.trim() || defaultJwtSecret;
const defaultDatabaseUrl = 'postgresql://postgres:postgres@localhost:5432/surveyhub?schema=public';
const configuredDatabaseUrl = process.env.DATABASE_URL?.trim();

if (nodeEnv === 'production') {
  const configuredJwtSecret = process.env.JWT_SECRET?.trim();
  if (
    !configuredJwtSecret ||
    configuredJwtSecret.length < 32 ||
    configuredJwtSecret === 'replace-with-a-long-random-value' ||
    configuredJwtSecret === defaultJwtSecret ||
    configuredJwtSecret === 'compose-local-demo-jwt-secret-not-for-production'
  ) {
    throw new Error(
      'FATAL: Production mode requires a non-default JWT_SECRET of at least 32 characters. System startup aborted.'
    );
  }

  let databaseUrl: URL | undefined;
  try {
    if (configuredDatabaseUrl) databaseUrl = new URL(configuredDatabaseUrl);
  } catch {
    // Report configuration failure without exposing a URL that may contain credentials.
  }
  let databaseUsername = '';
  let databasePassword = '';
  try {
    if (databaseUrl?.username) databaseUsername = decodeURIComponent(databaseUrl.username);
    if (databaseUrl?.password) databasePassword = decodeURIComponent(databaseUrl.password);
  } catch {
    databaseUrl = undefined;
  }
  if (
    !configuredDatabaseUrl ||
    configuredDatabaseUrl === defaultDatabaseUrl ||
    !databaseUrl ||
    !['postgres:', 'postgresql:'].includes(databaseUrl.protocol) ||
    !databaseUrl.hostname ||
    !databaseUrl.pathname.replace(/^\/+/, '').trim() ||
    !databaseUsername.trim() ||
    !databasePassword.trim() ||
    ['postgres', 'replace-with-a-local-database-password'].includes(databasePassword.trim())
  ) {
    throw new Error(
      'FATAL: Production mode requires a valid, non-default PostgreSQL DATABASE_URL. System startup aborted.'
    );
  }
}

export const env: Environment = {
  PORT: parseInt(process.env.PORT || '4000', 10),
  NODE_ENV: nodeEnv,
  DATABASE_URL: configuredDatabaseUrl || defaultDatabaseUrl,
  DATABASE_URL_TEST: process.env.DATABASE_URL_TEST || 'postgresql://postgres:postgres@localhost:5432/surveyhub_test?schema=public',
  JWT_SECRET: jwtSecret,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
};
