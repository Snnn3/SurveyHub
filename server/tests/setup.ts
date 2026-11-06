import { execSync } from 'child_process';
import { prisma } from '../src/utils/prisma';
import { env } from '../src/config/environment';

export const TABLES_IN_DEPENDENCY_ORDER = [
  'answer_options',
  'answers',
  'response_claims',
  'survey_responses',
  'options',
  'questions',
  'survey_eligibility',
  'surveys',
  'users',
] as const;

export async function truncateTestDatabase(): Promise<void> {
  for (const table of TABLES_IN_DEPENDENCY_ORDER) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
  }
}

beforeAll(async () => {
  // Ensure database is reachable, migrated, and truncated per SDS §2.6
  try {
    await prisma.$queryRaw`SELECT 1`;

    execSync('npx prisma migrate deploy', {
      env: {
        ...process.env,
        DATABASE_URL: env.DATABASE_URL_TEST,
      },
      stdio: 'pipe',
    });

    await truncateTestDatabase();
  } catch (err) {
    console.error('Test database setup failed. Is PostgreSQL running?', err);
    throw err;
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

