import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import express from 'express';
import request from 'supertest';
import app from '../src/app';
import { errorHandler } from '../src/middleware/error.middleware';
import { authenticateJWT, requireRole } from '../src/middleware/auth.middleware';
import { prisma } from '../src/utils/prisma';
import { seedUsers } from '../prisma/seed-users';
import { truncateTestDatabase } from './setup';

const password = 'Password123!';

describe('F-01 authentication and roles', () => {
  let ownerId: string;
  let respondentId: string;

  beforeEach(async () => {
    await truncateTestDatabase();
    const users = await prisma.$transaction(seedUsers);
    ownerId = users['owner1@survey.local'].id;
    respondentId = users['resp1@survey.local'].id;
  });

  it('logs in with a normalized email and returns a signed token without the password hash', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: ' OWNER1@SURVEY.LOCAL ', password });

    expect(response.status).toBe(200);
    expect(response.body.data.token).toEqual(expect.any(String));
    expect(response.body.data.user).toEqual({
      id: ownerId,
      email: 'owner1@survey.local',
      fullName: 'Dr. Owner One',
      role: 'SURVEY_OWNER',
    });
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    expect(JSON.stringify(response.body)).not.toContain(password);
  });

  it('returns the same credentials error for an unknown email and a wrong password', async () => {
    const [wrongPassword, unknownEmail] = await Promise.all([
      request(app).post('/api/auth/login').send({ email: 'owner1@survey.local', password: 'wrong' }),
      request(app).post('/api/auth/login').send({ email: 'missing@survey.local', password }),
    ]);

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error).toEqual({
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password.',
    });
    expect(unknownEmail.body.error).toEqual(wrongPassword.body.error);
    expect(wrongPassword.body.data).toBeUndefined();
    expect(unknownEmail.body.data).toBeUndefined();
  });

  it('rejects malformed login input', async () => {
    const response = await request(app).post('/api/auth/login').send({ email: 'bad', password: '' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('requires a token for current-user and logout requests', async () => {
    const [currentUser, logout] = await Promise.all([
      request(app).get('/api/auth/me'),
      request(app).post('/api/auth/logout'),
    ]);

    expect(currentUser.status).toBe(401);
    expect(currentUser.body.error.code).toBe('TOKEN_REQUIRED');
    expect(logout.status).toBe(401);
    expect(logout.body.error.code).toBe('TOKEN_REQUIRED');
  });

  it('returns the current database user and role for a valid token', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'resp1@survey.local', password });
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.data.token}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      id: respondentId,
      email: 'resp1@survey.local',
      fullName: 'Student Respondent One',
      role: 'RESPONDENT',
    });
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    expect(JSON.stringify(response.body)).not.toContain(password);
  });

  it('rejects malformed tokens', async () => {
    const response = await request(app).get('/api/auth/me').set('Authorization', 'Bearer invalid');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_TOKEN');
  });

  it('revokes an existing token on logout', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'owner1@survey.local', password });
    const token = login.body.data.token;
    const logout = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: ownerId } });
    const currentUser = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(logout.status).toBe(200);
    expect(logout.body.data.message).toBe('Successfully logged out.');
    expect(user.tokenVersion).toBe(1);
    expect(currentUser.status).toBe(401);
    expect(currentUser.body.error.code).toBe('TOKEN_REVOKED');
  });

  it('enforces roles on server-protected routes', async () => {
    const roleApp = express();
    roleApp.get('/owner-only', authenticateJWT, requireRole(Role.SURVEY_OWNER), (_req, res) => {
      res.sendStatus(204);
    });
    roleApp.use(errorHandler);
    const [ownerLogin, respondentLogin] = await Promise.all([
      request(app).post('/api/auth/login').send({ email: 'owner1@survey.local', password }),
      request(app).post('/api/auth/login').send({ email: 'resp1@survey.local', password }),
    ]);
    const [ownerAccess, respondentAccess] = await Promise.all([
      request(roleApp)
        .get('/owner-only')
        .set('Authorization', `Bearer ${ownerLogin.body.data.token}`),
      request(roleApp)
        .get('/owner-only')
        .set('Authorization', `Bearer ${respondentLogin.body.data.token}`),
    ]);

    expect(ownerAccess.status).toBe(204);
    expect(respondentAccess.status).toBe(403);
    expect(respondentAccess.body.error.code).toBe('FORBIDDEN_ROLE');
  });

  it('seeds every account with bcrypt cost 10 and the required 2b prefix', async () => {
    const users = await prisma.user.findMany({ select: { passwordHash: true } });

    expect(users).toHaveLength(4);
    expect(users.every(({ passwordHash }) => /^\$2b\$10\$/.test(passwordHash))).toBe(true);
    expect(await bcrypt.compare(password, users[0].passwordHash)).toBe(true);
  });
});
