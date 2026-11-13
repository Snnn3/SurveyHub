import { QuestionType, SurveyStatus } from '@prisma/client';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../src/app';
import apiRouter from '../src/routes';
import { env } from '../src/config/environment';
import { authenticateJWT } from '../src/middleware/auth.middleware';
import { prisma } from '../src/utils/prisma';
import { seedUsers } from '../prisma/seed-users';
import { TABLES_IN_DEPENDENCY_ORDER, truncateTestDatabase } from './setup';

const missingSurveyId = '00000000-0000-4000-a000-000000000099';
const password = 'Password123!';

interface ApiRoute {
  method: string;
  path: string;
  isProtected: boolean;
}

interface RegisteredRoute {
  path: string | string[] | RegExp;
  methods: Record<string, boolean>;
  stack: Array<{ handle: unknown }>;
}

interface RegisteredLayer {
  route?: RegisteredRoute;
  handle?: unknown;
  regexp?: RegExp & { fast_slash?: boolean };
}

interface RegisteredRouter {
  stack: RegisteredLayer[];
}

function joinPaths(...parts: string[]): string {
  const path = parts.flatMap((part) => part.split('/')).filter(Boolean).join('/');
  return `/${path}`;
}

function getMountPrefix(regexp?: RegisteredLayer['regexp']): string {
  if (regexp?.fast_slash) return '';
  const source = regexp?.source;
  const suffix = '\\/?(?=\\/|$)';
  if (!source?.startsWith('^') || !source.endsWith(suffix)) {
    throw new Error(`Cannot enumerate mounted API router path from ${source}.`);
  }
  return source.slice(1, -suffix.length).replace(/\\\//g, '/');
}

function isRouter(value: unknown): value is RegisteredRouter {
  return typeof value === 'function' && Array.isArray((value as unknown as RegisteredRouter).stack);
}

function enumerateApiRoutes(router: RegisteredRouter, prefix = '/api'): ApiRoute[] {
  return router.stack.flatMap((layer) => {
    if (layer.route) {
      const route = layer.route;
      const paths = Array.isArray(route.path) ? route.path : [route.path];
      if (paths.some((routePath) => routePath instanceof RegExp)) {
        throw new Error('Security matrix route enumeration does not support RegExp paths.');
      }
      return paths.flatMap((routePath) =>
        Object.keys(route.methods).map((method) => ({
          method,
          path: joinPaths(prefix, routePath as string).replace(/:[A-Za-z0-9_]+/g, missingSurveyId),
          isProtected: route.stack.some((handler) => handler.handle === authenticateJWT),
        }))
      );
    }

    if (isRouter(layer.handle)) {
      return enumerateApiRoutes(layer.handle, joinPaths(prefix, getMountPrefix(layer.regexp)));
    }

    return [];
  });
}

const apiRoutes = enumerateApiRoutes(apiRouter as unknown as RegisteredRouter);
const protectedRoutes = apiRoutes.filter((route) => route.isProtected);

async function callRoute(route: ApiRoute, token?: string) {
  const path = route.path || '/';
  const method = route.method.toLowerCase();
  let call;
  switch (method) {
    case 'get': call = request(app).get(path); break;
    case 'post': call = request(app).post(path); break;
    case 'put': call = request(app).put(path); break;
    case 'patch': call = request(app).patch(path); break;
    case 'delete': call = request(app).delete(path); break;
    default: throw new Error(`Add request support for protected method ${route.method}.`);
  }
  if (token) call.set('Authorization', `Bearer ${token}`);
  if (['post', 'put', 'patch'].includes(method)) call.send({});
  return call;
}

async function login(email: string): Promise<string> {
  const response = await request(app).post('/api/auth/login').send({ email, password });
  expect(response.status).toBe(200);
  return response.body.data.token as string;
}

async function snapshotDatabase(): Promise<string> {
  const tables = await Promise.all(TABLES_IN_DEPENDENCY_ORDER.map(async (table) => {
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`SELECT * FROM "${table}"`);
    return [table, rows.map((row) => JSON.stringify(row)).sort()];
  }));
  return JSON.stringify(tables);
}

function expectPrivateDataAbsent(response: { body: Record<string, unknown> }): void {
  expect(response.body).not.toHaveProperty('data');
  expect(JSON.stringify(response.body)).not.toContain('PRIVATE-ANSWER-SENTINEL');
}

function expectForbidden(response: { status: number; body: Record<string, any> }, code: string): void {
  expect(response.status).toBe(403);
  expect(response.body.error.code).toBe(code);
  expectPrivateDataAbsent(response);
}

describe('Sprint 1 security matrix (STS-SEC-01/02)', () => {
  let ownerId: string;
  let ownerToken: string;
  let otherOwnerToken: string;
  let respondentToken: string;
  let otherRespondentToken: string;

  it('keeps only login and health public', () => {
    expect(apiRoutes.filter((route) => !route.isProtected).map(({ method, path }) => `${method} ${path}`).sort())
      .toEqual(['get /api/health', 'post /api/auth/login']);
  });

  beforeEach(async () => {
    await truncateTestDatabase();
    const users = await prisma.$transaction(seedUsers);
    ownerId = users['owner1@survey.local'].id;
    [ownerToken, otherOwnerToken, respondentToken, otherRespondentToken] = await Promise.all([
      login('owner1@survey.local'),
      login('owner2@survey.local'),
      login('resp1@survey.local'),
      login('resp2@survey.local'),
    ]);
  });

  it('rejects missing, malformed, and expired tokens on every protected route without returning data', async () => {
    expect(protectedRoutes.length).toBeGreaterThan(0);
    const expiredToken = jwt.sign({ sub: ownerId, ver: 0 }, env.JWT_SECRET, { expiresIn: -1 });

    for (const route of protectedRoutes) {
      for (const [token, expectedCode] of [
        [undefined, 'TOKEN_REQUIRED'],
        ['not-a-valid-token', 'INVALID_TOKEN'],
        [expiredToken, 'INVALID_TOKEN'],
      ] as const) {
        const response = await callRoute(route, token);
        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe(expectedCode);
        expectPrivateDataAbsent(response);
      }
    }
  });

  it('rejects each wrong role on every survey route without changing the database', async () => {
    const before = await snapshotDatabase();
    const roleRoutes = protectedRoutes.filter((route) =>
      route.path === '/api/surveys' || route.path.startsWith('/api/surveys/')
    );
    expect(roleRoutes.length).toBeGreaterThan(0);

    for (const route of roleRoutes) {
      const [ownerResponse, respondentResponse] = await Promise.all([
        callRoute(route, ownerToken),
        callRoute(route, respondentToken),
      ]);
      const forbidden = [ownerResponse, respondentResponse].filter((response) => response.status === 403);
      expect(forbidden).toHaveLength(1);
      expectForbidden(forbidden[0], 'FORBIDDEN_ROLE');
    }

    expect(await snapshotDatabase()).toBe(before);
  });

  it('denies non-owner survey operations and cross-respondent receipts without data or database changes', async () => {
    const draft = await prisma.survey.create({
      data: { title: 'PRIVATE-ANSWER-SENTINEL', ownerId, status: SurveyStatus.DRAFT },
    });
    const published = await prisma.survey.create({
      data: {
        title: 'Published ownership fixture',
        ownerId,
        status: SurveyStatus.PUBLISHED,
        publishedAt: new Date(),
        questions: {
          create: {
            prompt: 'Private answer fixture',
            questionType: QuestionType.SINGLE_CHOICE,
            options: { create: { label: 'Private option' } },
          },
        },
      },
      include: { questions: { include: { options: true } } },
    });
    const receipt = await request(app)
      .post(`/api/surveys/${published.id}/responses`)
      .set('Authorization', `Bearer ${respondentToken}`)
      .send({ answers: [{ questionId: published.questions[0].id, selectedOptionIds: [published.questions[0].options[0].id] }] });
    expect(receipt.status).toBe(201);

    const before = await snapshotDatabase();
    const operations = [
      request(app).get(`/api/surveys/${draft.id}`),
      request(app).put(`/api/surveys/${draft.id}`).send({}),
      request(app).delete(`/api/surveys/${draft.id}`),
      request(app).patch(`/api/surveys/${draft.id}/publish`).send({}),
      request(app).patch(`/api/surveys/${published.id}/close`).send({}),
      request(app).get(`/api/surveys/${draft.id}/summary`),
    ];
    for (const operation of operations) {
      const response = await operation.set('Authorization', `Bearer ${otherOwnerToken}`);
      expectForbidden(response, 'FORBIDDEN_OWNERSHIP');
    }

    const crossReceipt = await request(app)
      .get(`/api/surveys/${published.id}/responses/${receipt.body.data.responseId}`)
      .set('Authorization', `Bearer ${otherRespondentToken}`);
    expectForbidden(crossReceipt, 'FORBIDDEN_CROSS_RESPONSE_ACCESS');
    expect(await snapshotDatabase()).toBe(before);
  });
});
