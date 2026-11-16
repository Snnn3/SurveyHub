import { randomBytes } from 'crypto';
import { config as loadEnv } from 'dotenv';
import path from 'path';
import { defineConfig } from '@playwright/test';

loadEnv({ path: path.resolve(__dirname, '.env') });

const testDatabaseUrl = process.env.DATABASE_URL_TEST;
if (!testDatabaseUrl) throw new Error('DATABASE_URL_TEST is required for E2E tests.');

export default defineConfig({
  testDir: './e2e',
  testMatch: 'sprint1-survey-flow.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    channel: 'chrome',
    headless: true,
    viewport: { width: 1280, height: 900 },
  },
  webServer: {
    command: 'node e2e/start-server.js',
    url: 'http://127.0.0.1:4173/',
    cwd: __dirname,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      ...process.env,
      PORT: '4173',
      NODE_ENV: 'production',
      DATABASE_URL: testDatabaseUrl,
      JWT_SECRET: randomBytes(32).toString('hex'),
      CLIENT_ORIGIN: 'http://127.0.0.1:4173',
    },
  },
});
