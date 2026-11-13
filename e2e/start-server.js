const { execSync } = require('child_process');
const { randomBytes } = require('crypto');
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');
const path = require('path');

const root = path.resolve(__dirname, '..');
const server = path.join(root, 'server');
dotenv.config({ path: path.join(root, '.env') });

const testDatabaseUrl = process.env.DATABASE_URL_TEST;
if (!testDatabaseUrl || new URL(testDatabaseUrl).pathname.replace(/^\//, '') !== 'surveyhub_test') {
  throw new Error('E2E setup only runs against DATABASE_URL_TEST for surveyhub_test.');
}

const childEnv = { ...process.env, DATABASE_URL: testDatabaseUrl };
execSync('npx prisma migrate deploy', { cwd: server, env: childEnv, stdio: 'inherit' });

async function start() {
  const prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
  try {
    for (const table of [
      'answer_options', 'answers', 'response_claims', 'survey_responses', 'options',
      'questions', 'survey_eligibility', 'surveys', 'users',
    ]) {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE`);
    }
  } finally {
    await prisma.$disconnect();
  }

  execSync('npm run db:seed', { cwd: server, env: childEnv, stdio: 'inherit' });

  process.env.NODE_ENV = 'production';
  process.env.PORT = '4173';
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.JWT_SECRET = process.env.JWT_SECRET || randomBytes(32).toString('hex');
  process.env.CLIENT_ORIGIN = 'http://127.0.0.1:4173';
  const app = require(path.join(server, 'dist', 'app.js')).default;
  const listener = app.listen(4173, '127.0.0.1', () => console.log('[E2E] Test server listening on 4173.'));
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => listener.close(() => process.exit(0)));
  }
}

start().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
