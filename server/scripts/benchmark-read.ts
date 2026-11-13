process.env.NODE_ENV = 'test';

const path = require('path') as typeof import('path');
const os = require('os') as typeof import('os');
const fs = require('fs') as typeof import('fs');
const { execSync } = require('child_process') as typeof import('child_process');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const testDatabaseUrl = process.env.DATABASE_URL_TEST;
if (!testDatabaseUrl || new URL(testDatabaseUrl).pathname.replace(/^\//, '') !== 'surveyhub_test') {
  throw new Error('Benchmark only runs against DATABASE_URL_TEST for surveyhub_test.');
}

const { QuestionType, SurveyStatus } = require('@prisma/client') as typeof import('@prisma/client');
const request = require('supertest') as typeof import('supertest');
const { prisma } = require('../src/utils/prisma') as typeof import('../src/utils/prisma');
const app = require('../src/app').default as typeof import('../src/app').default;
const { seedUsers } = require('../prisma/seed-users') as typeof import('../prisma/seed-users');

async function main(): Promise<void> {
  execSync('npx prisma migrate deploy', {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: 'inherit',
  });
  await prisma.$queryRaw`SELECT 1`;
  const postgres = await prisma.$queryRaw<Array<{ version: string }>>`SELECT version()`;
  const users = await prisma.$transaction(seedUsers);
  const survey = await prisma.survey.create({
    data: {
      title: 'NFR-PERF-01 benchmark fixture',
      ownerId: users['owner1@survey.local'].id,
      status: SurveyStatus.PUBLISHED,
      publishedAt: new Date(),
      questions: {
        create: {
          prompt: 'Benchmark read question',
          questionType: QuestionType.SINGLE_CHOICE,
          options: { create: [{ label: 'A' }, { label: 'B' }] },
        },
      },
    },
  });

  try {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'resp1@survey.local', password: 'Password123!' });
    if (login.status !== 200) throw new Error(`Login failed with status ${login.status}.`);
    const token = login.body.data.token as string;
    const samples: number[] = [];

    for (let index = 0; index < 50; index += 1) {
      const startedAt = process.hrtime.bigint();
      const response = await request(app)
        .get(`/api/surveys/${survey.id}/form`)
        .set('Authorization', `Bearer ${token}`);
      samples.push(Number(process.hrtime.bigint() - startedAt) / 1_000_000);
      if (response.status !== 200) throw new Error(`Form request ${index + 1} returned ${response.status}.`);
    }

    const sorted = [...samples].sort((a, b) => a - b);
    const percentile = (fraction: number) => sorted[Math.ceil(fraction * sorted.length) - 1];
    const result = {
      measuredAt: new Date().toISOString(),
      command: 'npm run bench:read --prefix server',
      route: 'GET /api/surveys/:id/form',
      requestCount: samples.length,
      workload: '50 sequential authenticated reads of one published single-choice survey form',
      targetP95Ms: 300,
      p50Ms: Number(percentile(0.5).toFixed(3)),
      p95Ms: Number(percentile(0.95).toFixed(3)),
      p99Ms: Number(percentile(0.99).toFixed(3)),
      passed: percentile(0.95) < 300,
      environment: {
        node: process.version,
        postgres: postgres[0].version,
        platform: `${os.platform()} ${os.release()} ${os.arch()}`,
        cpu: os.cpus()[0]?.model,
        database: 'surveyhub_test',
      },
    };
    const resultPath = path.resolve(__dirname, '../../docs/evidence/nfr-perf-01.json');
    fs.mkdirSync(path.dirname(resultPath), { recursive: true });
    fs.writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await prisma.survey.delete({ where: { id: survey.id } });
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
