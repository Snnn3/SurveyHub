import { SurveyStatus } from '@prisma/client';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/utils/prisma';
import { seedUsers } from '../prisma/seed-users';
import { truncateTestDatabase } from './setup';

const password = 'Password123!';

async function loginAs(email: string): Promise<string> {
  const response = await request(app).post('/api/auth/login').send({ email, password });
  return response.body.data.token as string;
}

describe('F-07 scheduled-close API (STS-S2-04-01 to STS-S2-04-05)', () => {
  let ownerAToken: string;
  let ownerBToken: string;
  let respondentToken: string;
  let ownerAId: string;
  let respondentId: string;

  beforeEach(async () => {
    await truncateTestDatabase();
    const users = await prisma.$transaction((tx) => seedUsers(tx, password));
    ownerAId = users['owner1@survey.local'].id;
    respondentId = users['resp1@survey.local'].id;
    [ownerAToken, ownerBToken, respondentToken] = await Promise.all([
      loginAs('owner1@survey.local'), loginAs('owner2@survey.local'), loginAs('resp1@survey.local'),
    ]);
  });

  async function createSurvey(status: SurveyStatus = SurveyStatus.DRAFT, closesAt?: Date) {
    return prisma.survey.create({ data: { title: 'Schedule survey', ownerId: ownerAId, status, closesAt } });
  }

  it('gets, sets, changes, and clears UTC deadlines while preserving survey lifecycle fields', async () => {
    const survey = await createSurvey(SurveyStatus.PUBLISHED);
    const endpoint = `/api/surveys/${survey.id}/schedule`;
    const initial = await request(app).get(endpoint).set('Authorization', `Bearer ${ownerAToken}`);
    expect(initial.status).toBe(200);
    expect(initial.body.data).toMatchObject({ status: 'PUBLISHED', closesAt: null, acceptingResponses: true });

    const saved = await request(app).patch(endpoint).set('Authorization', `Bearer ${ownerAToken}`)
      .send({ closesAt: '2099-11-30T16:00:00+07:00' });
    expect(saved.status).toBe(200);
    expect(saved.body.data.closesAt).toBe('2099-11-30T09:00:00.000Z');
    expect(saved.body.data.acceptingResponses).toBe(true);

    const changed = await request(app).patch(endpoint).set('Authorization', `Bearer ${ownerAToken}`)
      .send({ closesAt: '2099-12-01T16:00:00+07:00' });
    expect(changed.status).toBe(200);
    expect(changed.body.data.closesAt).toBe('2099-12-01T09:00:00.000Z');

    const persisted = await prisma.survey.findUniqueOrThrow({ where: { id: survey.id } });
    expect(persisted.closesAt?.toISOString()).toBe('2099-12-01T09:00:00.000Z');
    expect(persisted.status).toBe(SurveyStatus.PUBLISHED);
    expect(persisted.closedAt).toBeNull();

    const cleared = await request(app).patch(endpoint).set('Authorization', `Bearer ${ownerAToken}`).send({ closesAt: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.data).toMatchObject({ closesAt: null, acceptingResponses: true });

    const draft = await createSurvey(SurveyStatus.DRAFT);
    const draftEndpoint = `/api/surveys/${draft.id}/schedule`;
    const draftSchedule = await request(app).patch(draftEndpoint).set('Authorization', `Bearer ${ownerAToken}`)
      .send({ closesAt: '2099-11-30T16:00:00+07:00' });
    expect(draftSchedule.status).toBe(200);
    expect(draftSchedule.body.data).toMatchObject({
      status: 'DRAFT', closesAt: '2099-11-30T09:00:00.000Z', acceptingResponses: false,
    });
    const clearedDraft = await request(app).patch(draftEndpoint).set('Authorization', `Bearer ${ownerAToken}`)
      .send({ closesAt: null });
    expect(clearedDraft.status).toBe(200);
    expect(clearedDraft.body.data).toMatchObject({ status: 'DRAFT', closesAt: null, acceptingResponses: false });
  });

  it('rejects invalid, timezone-free, and past deadlines without changing the saved instant', async () => {
    const initialDeadline = new Date('2026-11-30T09:00:00.000Z');
    const survey = await createSurvey(SurveyStatus.PUBLISHED, initialDeadline);
    const endpoint = `/api/surveys/${survey.id}/schedule`;
    for (const closesAt of ['2026-11-30T16:00:00', 'not-a-date', '2020-01-01T00:00:00Z']) {
      const rejected = await request(app).patch(endpoint).set('Authorization', `Bearer ${ownerAToken}`).send({ closesAt });
      expect(rejected.status).toBe(400);
      expect(rejected.body.error.code).toBe('VALIDATION_ERROR');
      const persisted = await prisma.survey.findUniqueOrThrow({ where: { id: survey.id } });
      expect(persisted.closesAt?.toISOString()).toBe(initialDeadline.toISOString());
    }
  });

  it('enforces role, ownership, not-found, and manual-close terminal state', async () => {
    const survey = await createSurvey(SurveyStatus.CLOSED);
    const endpoint = `/api/surveys/${survey.id}/schedule`;
    const closedChange = await request(app).patch(endpoint).set('Authorization', `Bearer ${ownerAToken}`)
      .send({ closesAt: null });
    expect(closedChange.status).toBe(400);
    expect(closedChange.body.error.code).toBe('SURVEY_NOT_EDITABLE');

    const otherOwner = await request(app).get(endpoint).set('Authorization', `Bearer ${ownerBToken}`);
    expect(otherOwner.status).toBe(403);
    expect(otherOwner.body.error.code).toBe('FORBIDDEN_OWNERSHIP');

    const respondent = await request(app).get(endpoint).set('Authorization', `Bearer ${respondentToken}`);
    expect(respondent.status).toBe(403);
    expect(respondent.body.error.code).toBe('FORBIDDEN_ROLE');

    const missing = await request(app).get('/api/surveys/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/schedule')
      .set('Authorization', `Bearer ${ownerAToken}`);
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');
  });

  it('exposes acceptance in owner list and detail responses', async () => {
    const future = await createSurvey(SurveyStatus.PUBLISHED, new Date('2099-01-01T00:00:00.000Z'));
    const expired = await createSurvey(SurveyStatus.PUBLISHED, new Date('2020-01-01T00:00:00.000Z'));
    const list = await request(app).get('/api/surveys').set('Authorization', `Bearer ${ownerAToken}`);
    expect(list.body.data.find((survey: { id: string }) => survey.id === future.id)).toMatchObject({
      closesAt: '2099-01-01T00:00:00.000Z', acceptingResponses: true,
    });
    expect(list.body.data.find((survey: { id: string }) => survey.id === expired.id)).toMatchObject({
      closesAt: '2020-01-01T00:00:00.000Z', acceptingResponses: false,
    });

    const detail = await request(app).get(`/api/surveys/${expired.id}`).set('Authorization', `Bearer ${ownerAToken}`);
    expect(detail.body.data).toMatchObject({ closesAt: '2020-01-01T00:00:00.000Z', acceptingResponses: false });
    const activeBeforeReschedule = await request(app).get('/api/surveys/active')
      .set('Authorization', `Bearer ${respondentToken}`);
    expect(activeBeforeReschedule.body.data.find((survey: { id: string }) => survey.id === future.id))
      .toMatchObject({ closesAt: '2099-01-01T00:00:00.000Z', acceptingResponses: true });
    expect(activeBeforeReschedule.body.data.find((survey: { id: string }) => survey.id === expired.id))
      .toMatchObject({ closesAt: '2020-01-01T00:00:00.000Z', acceptingResponses: false });

    const expiredForm = await request(app).get(`/api/surveys/${expired.id}/form`)
      .set('Authorization', `Bearer ${respondentToken}`);
    expect(expiredForm.status).toBe(400);
    expect(expiredForm.body.error.code).toBe('SURVEY_NOT_ACCEPTING_RESPONSES');

    const extended = await request(app).patch(`/api/surveys/${expired.id}/schedule`)
      .set('Authorization', `Bearer ${ownerAToken}`).send({ closesAt: '2099-01-01T00:00:00Z' });
    expect(extended.status).toBe(200);
    expect(extended.body.data.acceptingResponses).toBe(true);
    expect(extended.body.data.closesAt).toBe('2099-01-01T00:00:00.000Z');
    const ownerAfterReschedule = await request(app).get('/api/surveys').set('Authorization', `Bearer ${ownerAToken}`);
    expect(ownerAfterReschedule.body.data.find((survey: { id: string }) => survey.id === expired.id))
      .toMatchObject({ closesAt: '2099-01-01T00:00:00.000Z', acceptingResponses: true });
    const activeAfterReschedule = await request(app).get('/api/surveys/active')
      .set('Authorization', `Bearer ${respondentToken}`);
    expect(activeAfterReschedule.body.data.find((survey: { id: string }) => survey.id === expired.id))
      .toMatchObject({ closesAt: '2099-01-01T00:00:00.000Z', acceptingResponses: true });
    const reopenedForm = await request(app).get(`/api/surveys/${expired.id}/form`)
      .set('Authorization', `Bearer ${respondentToken}`);
    expect(reopenedForm.status).toBe(200);

    const cleared = await request(app).patch(`/api/surveys/${expired.id}/schedule`)
      .set('Authorization', `Bearer ${ownerAToken}`).send({ closesAt: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.data).toMatchObject({ closesAt: null, acceptingResponses: true });
  });
});
