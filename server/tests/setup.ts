import { prisma } from '../src/utils/prisma';

beforeAll(async () => {
  // Ensure database is reachable
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    console.error('Test database setup failed. Is PostgreSQL running?', err);
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});
