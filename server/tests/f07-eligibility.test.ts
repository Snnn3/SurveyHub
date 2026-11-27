import { Role, SurveyStatus } from '@prisma/client';
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

describe('F-07 respondent eligibility API (STS-S2-03-01 to STS-S2-03-06)', () => {
  let ownerAToken: string;
  let ownerBToken: string;
  let respondentAToken: string;
  let respondentBToken: string;
  let ownerAId: string;
  let ownerBId: string;
  let respondentAId: string;
  let respondentBId: string;

  beforeEach(async () => {
    await truncateTestDatabase();
    const users = await prisma.$transaction((tx) => seedUsers(tx, password));
    ownerAId = users['owner1@survey.local'].id;
    ownerBId = users['owner2@survey.local'].id;
    respondentAId = users['resp1@survey.local'].id;
    respondentBId = users['resp2@survey.local'].id;
    [ownerAToken, ownerBToken, respondentAToken, respondentBToken] = await Promise.all([
      loginAs('owner1@survey.local'),
      loginAs('owner2@survey.local'),
      loginAs('resp1@survey.local'),
      loginAs('resp2@survey.local'),
    ]);
  });

  async function createSurvey(ownerId = ownerAId, status: SurveyStatus = SurveyStatus.PUBLISHED, closesAt?: Date) {
    return prisma.survey.create({
      data: {
        title: 'F-07 policy survey',
        ownerId,
        status,
        closesAt,
        questions: { create: [{ prompt: 'Question private to the form', questionType: 'SHORT_TEXT' }] },
      },
    });
  }

  it('returns only selected respondent accounts and enforces role, ownership, and not-found checks', async () => {
    const survey = await createSurvey();
    await prisma.surveyEligibility.create({ data: { surveyId: survey.id, userId: respondentAId } });

    const selected = await request(app).get(`/api/surveys/${survey.id}/eligibility`).set('Authorization', `Bearer ${ownerAToken}`);
    expect(selected.status).toBe(200);
    expect(selected.body.data.eligibleRespondents).toEqual([
      { userId: respondentAId, email: 'resp1@survey.local', fullName: 'Student Respondent One' },
    ]);

    const otherOwner = await request(app).get(`/api/surveys/${survey.id}/eligibility`).set('Authorization', `Bearer ${ownerBToken}`);
    expect(otherOwner.status).toBe(403);
    expect(otherOwner.body.error.code).toBe('FORBIDDEN_OWNERSHIP');
    expect(JSON.stringify(otherOwner.body)).not.toContain('Question private to the form');
    expect(JSON.stringify(otherOwner.body)).not.toContain('resp1@survey.local');

    const respondent = await request(app).get(`/api/surveys/${survey.id}/eligibility`).set('Authorization', `Bearer ${respondentAToken}`);
    expect(respondent.status).toBe(403);
    expect(respondent.body.error.code).toBe('FORBIDDEN_ROLE');

    const missing = await request(app).get('/api/surveys/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/eligibility').set('Authorization', `Bearer ${ownerAToken}`);
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');
  });

  it('replaces allowlists atomically and validates normalized addresses before resolving accounts', async () => {
    const survey = await createSurvey(ownerAId, SurveyStatus.DRAFT);
    const endpoint = `/api/surveys/${survey.id}/eligibility`;
    await prisma.surveyEligibility.create({ data: { surveyId: survey.id, userId: respondentBId } });

    const valid = await request(app).put(endpoint).set('Authorization', `Bearer ${ownerAToken}`)
      .send({ respondentEmails: [' RESP1@SURVEY.LOCAL '] });
    expect(valid.status).toBe(200);
    expect(valid.body.data.eligibleRespondents.map((entry: { userId: string }) => entry.userId)).toEqual([respondentAId]);

    for (const input of [
      { respondentEmails: ['not-an-email', 'missing@survey.local'] },
      { respondentEmails: ['resp1@survey.local', ' RESP1@SURVEY.LOCAL '] },
    ]) {
      const rejected = await request(app).put(endpoint).set('Authorization', `Bearer ${ownerAToken}`).send(input);
      expect(rejected.status).toBe(400);
      expect(rejected.body.error.code).toBe('VALIDATION_ERROR');
      expect(await prisma.surveyEligibility.findMany({ where: { surveyId: survey.id }, select: { userId: true } }))
        .toEqual([{ userId: respondentAId }]);
    }

    for (const email of ['missing@survey.local', 'owner1@survey.local']) {
      const rejected = await request(app).put(endpoint).set('Authorization', `Bearer ${ownerAToken}`)
        .send({ respondentEmails: [email] });
      expect(rejected.status).toBe(400);
      expect(rejected.body.error.code).toBe('INVALID_ELIGIBILITY');
      expect(rejected.body.error.message).toBe('One or more respondents are invalid.');
      expect(JSON.stringify(rejected.body)).not.toContain(email);
      expect(await prisma.surveyEligibility.findMany({ where: { surveyId: survey.id }, select: { userId: true } }))
        .toEqual([{ userId: respondentAId }]);
    }

    const closed = await createSurvey(ownerAId, SurveyStatus.CLOSED);
    const closedUpdate = await request(app).put(`/api/surveys/${closed.id}/eligibility`)
      .set('Authorization', `Bearer ${ownerAToken}`).send({ respondentEmails: ['bad'] });
    expect(closedUpdate.status).toBe(400);
    expect(closedUpdate.body.error.code).toBe('SURVEY_NOT_EDITABLE');
  });

  it('filters the active list by allowlist and returns non-acceptance without hiding expired published surveys', async () => {
    const openForA = await createSurvey(ownerAId, SurveyStatus.PUBLISHED);
    const openForB = await createSurvey(ownerBId, SurveyStatus.PUBLISHED);
    const expiredForA = await createSurvey(ownerAId, SurveyStatus.PUBLISHED, new Date('2020-01-01T00:00:00.000Z'));
    await prisma.surveyEligibility.createMany({ data: [
      { surveyId: openForA.id, userId: respondentAId },
      { surveyId: openForB.id, userId: respondentBId },
      { surveyId: expiredForA.id, userId: respondentAId },
    ] });

    const active = await request(app).get('/api/surveys/active').set('Authorization', `Bearer ${respondentAToken}`);
    expect(active.status).toBe(200);
    expect(active.body.data.map((survey: { id: string }) => survey.id)).toEqual(expect.arrayContaining([openForA.id, expiredForA.id]));
    expect(active.body.data.map((survey: { id: string }) => survey.id)).not.toContain(openForB.id);
    expect(active.body.data.find((survey: { id: string }) => survey.id === expiredForA.id)).toMatchObject({
      closesAt: expiredForA.closesAt?.toISOString(),
      acceptingResponses: false,
    });

    const emptyAllowlist = await createSurvey(ownerAId, SurveyStatus.PUBLISHED);
    const unrestricted = await request(app).get('/api/surveys/active').set('Authorization', `Bearer ${respondentBToken}`);
    expect(unrestricted.body.data.map((survey: { id: string }) => survey.id)).toContain(emptyAllowlist.id);
  });

  it('checks availability before eligibility and never returns form data on denial', async () => {
    const expired = await createSurvey(ownerAId, SurveyStatus.PUBLISHED, new Date('2020-01-01T00:00:00.000Z'));
    await prisma.surveyEligibility.create({ data: { surveyId: expired.id, userId: respondentBId } });
    const expiredResponse = await request(app).get(`/api/surveys/${expired.id}/form`)
      .set('Authorization', `Bearer ${respondentAToken}`);
    expect(expiredResponse.status).toBe(400);
    expect(expiredResponse.body.error.code).toBe('SURVEY_NOT_ACCEPTING_RESPONSES');
    expect(JSON.stringify(expiredResponse.body)).not.toContain('Question private to the form');

    const eligibleExpiredResponse = await request(app).get(`/api/surveys/${expired.id}/form`)
      .set('Authorization', `Bearer ${respondentBToken}`);
    expect(eligibleExpiredResponse.status).toBe(400);
    expect(eligibleExpiredResponse.body.error.code).toBe('SURVEY_NOT_ACCEPTING_RESPONSES');
    expect(JSON.stringify(eligibleExpiredResponse.body)).not.toContain('Question private to the form');

    const draft = await createSurvey(ownerAId, SurveyStatus.DRAFT);
    const draftResponse = await request(app).get(`/api/surveys/${draft.id}/form`)
      .set('Authorization', `Bearer ${respondentAToken}`);
    expect(draftResponse.status).toBe(400);
    expect(draftResponse.body.error.code).toBe('SURVEY_NOT_ACCEPTING_RESPONSES');
    expect(JSON.stringify(draftResponse.body)).not.toContain('Question private to the form');

    const accepting = await createSurvey(ownerAId, SurveyStatus.PUBLISHED);
    await prisma.surveyEligibility.create({ data: { surveyId: accepting.id, userId: respondentBId } });
    const denied = await request(app).get(`/api/surveys/${accepting.id}/form`).set('Authorization', `Bearer ${respondentAToken}`);
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('NOT_ELIGIBLE');
    expect(JSON.stringify(denied.body)).not.toContain('Question private to the form');

    const allowed = await request(app).get(`/api/surveys/${accepting.id}/form`).set('Authorization', `Bearer ${respondentBToken}`);
    expect(allowed.status).toBe(200);
    expect(allowed.body.data.questions[0].prompt).toBe('Question private to the form');
  });
});
