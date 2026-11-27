import { QuestionType, SurveyMode, SurveyStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { readFile } from 'fs/promises';
import path from 'path';
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

async function createSurvey(ownerId: string, mode: SurveyMode, status: SurveyStatus) {
  return prisma.survey.create({
    data: {
      title: `F-05 ${mode} survey`,
      ownerId,
      mode,
      status,
      publishedAt: status === SurveyStatus.PUBLISHED ? new Date() : null,
      questions: {
        create: [{ prompt: 'What should improve?', questionType: QuestionType.SHORT_TEXT, isRequired: false }],
      },
    },
    include: { questions: true },
  });
}

describe('F-05 anonymous mode foundations (STS-F05-01 to STS-F05-08)', () => {
  let ownerId: string;
  let respondentId: string;
  let otherOwnerToken: string;
  let ownerToken: string;
  let respondentToken: string;
  let otherRespondentToken: string;

  beforeEach(async () => {
    await truncateTestDatabase();
    const users = await prisma.$transaction((tx) => seedUsers(tx, password));
    ownerId = users['owner1@survey.local'].id;
    respondentId = users['resp1@survey.local'].id;
    ownerToken = await loginAs('owner1@survey.local');
    otherOwnerToken = await loginAs('owner2@survey.local');
    respondentToken = await loginAs('resp1@survey.local');
    otherRespondentToken = await loginAs('resp2@survey.local');
  });

  it('defaults new drafts to identified and persists anonymous mode through owner reads and updates', async () => {
    const identified = await request(app)
      .post('/api/surveys')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Default mode', questions: [] });
    const anonymous = await request(app)
      .post('/api/surveys')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Anonymous mode', mode: 'ANONYMOUS', questions: [] });

    expect(identified.status).toBe(201);
    expect(identified.body.data.mode).toBe('IDENTIFIED');
    expect(anonymous.status).toBe(201);
    expect(anonymous.body.data.mode).toBe('ANONYMOUS');

    const update = await request(app)
      .put(`/api/surveys/${anonymous.body.data.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Saved anonymous mode', questions: [] });
    const detail = await request(app)
      .get(`/api/surveys/${anonymous.body.data.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const list = await request(app)
      .get('/api/surveys')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(update.status).toBe(200);
    expect(detail.body.data.mode).toBe('ANONYMOUS');
    expect(list.body.data.find((survey: { id: string }) => survey.id === anonymous.body.data.id).mode).toBe('ANONYMOUS');
  });

  it('rejects invalid, wrong-role, non-owner, and non-draft mode changes without changing stored mode', async () => {
    const draft = await createSurvey(ownerId, SurveyMode.IDENTIFIED, SurveyStatus.DRAFT);
    const published = await createSurvey(ownerId, SurveyMode.IDENTIFIED, SurveyStatus.PUBLISHED);
    const payload = { title: 'Should not save', mode: 'ANONYMOUS', questions: [] };

    const invalid = await request(app)
      .put(`/api/surveys/${draft.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ ...payload, mode: 'ANON' });
    const wrongRole = await request(app)
      .post('/api/surveys')
      .set('Authorization', `Bearer ${respondentToken}`)
      .send(payload);
    const nonOwner = await request(app)
      .put(`/api/surveys/${draft.id}`)
      .set('Authorization', `Bearer ${otherOwnerToken}`)
      .send(payload);
    const notDraft = await request(app)
      .put(`/api/surveys/${published.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(payload);

    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
    expect(wrongRole.status).toBe(403);
    expect(wrongRole.body.error.code).toBe('FORBIDDEN_ROLE');
    expect(nonOwner.status).toBe(403);
    expect(nonOwner.body.error.code).toBe('FORBIDDEN_OWNERSHIP');
    expect(notDraft.status).toBe(400);
    expect(notDraft.body.error.code).toBe('SURVEY_NOT_EDITABLE');
    const errorBodies = JSON.stringify([invalid.body, wrongRole.body, nonOwner.body, notDraft.body]);
    for (const privateValue of [draft.id, draft.title, published.id, published.title, ownerId, 'Should not save']) {
      expect(errorBodies).not.toContain(privateValue);
    }
    expect(await prisma.survey.findUnique({ where: { id: draft.id }, select: { mode: true, title: true } }))
      .toEqual({ mode: SurveyMode.IDENTIFIED, title: draft.title });
    expect(await prisma.survey.findUnique({ where: { id: published.id }, select: { mode: true } }))
      .toEqual({ mode: SurveyMode.IDENTIFIED });
  });

  it('publishes an anonymous draft and accepts submissions through #72', async () => {
    const draft = await createSurvey(ownerId, SurveyMode.ANONYMOUS, SurveyStatus.DRAFT);
    const publish = await request(app)
      .patch(`/api/surveys/${draft.id}/publish`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(publish.status).toBe(200);
    expect(publish.body.data).toMatchObject({ id: draft.id, mode: SurveyMode.ANONYMOUS, status: SurveyStatus.PUBLISHED });
    expect(await prisma.survey.findUnique({ where: { id: draft.id }, select: { mode: true, status: true } }))
      .toEqual({ mode: SurveyMode.ANONYMOUS, status: SurveyStatus.PUBLISHED });

    const inactiveSurveys = [
      await createSurvey(ownerId, SurveyMode.ANONYMOUS, SurveyStatus.DRAFT),
      await createSurvey(ownerId, SurveyMode.ANONYMOUS, SurveyStatus.CLOSED),
    ];
    for (const inactive of inactiveSurveys) {
      const submission = await request(app)
        .post(`/api/surveys/${inactive.id}/responses`)
        .set('Authorization', `Bearer ${respondentToken}`)
        .send({ answers: [] });

      expect(submission.status).toBe(400);
      expect(submission.body.error.code).toBe('SURVEY_NOT_ACCEPTING_RESPONSES');
      expect(submission.body).not.toHaveProperty('data');
      expect(JSON.stringify(submission.body)).not.toContain(inactive.id);
      expect(await prisma.surveyResponse.count({ where: { surveyId: inactive.id } })).toBe(0);
      expect(await prisma.responseClaim.count({ where: { surveyId: inactive.id } })).toBe(0);
    }

    const response = await request(app)
      .post(`/api/surveys/${draft.id}/responses`)
      .set('Authorization', `Bearer ${respondentToken}`)
      .send({ answers: [] });

    expect(response.status).toBe(201);
    const saved = await prisma.surveyResponse.findUnique({
      where: { id: response.body.data.responseId },
      select: { respondentId: true },
    });
    expect(saved).toEqual({ respondentId: null });
    expect(await prisma.responseClaim.count({ where: { surveyId: draft.id, userId: respondentId } })).toBe(1);
    expect(await prisma.answer.count({ where: { response: { surveyId: draft.id } } })).toBe(0);

    const receipt = await request(app)
      .get(`/api/surveys/${draft.id}/responses/${response.body.data.responseId}`)
      .set('Authorization', `Bearer ${respondentToken}`);
    expect(receipt.status).toBe(200);
    expect(receipt.body.data).toMatchObject({
      responseId: response.body.data.responseId,
      surveyId: draft.id,
      mode: SurveyMode.ANONYMOUS,
      answers: [],
    });
    expect(receipt.body.data).not.toHaveProperty('respondentId');
    expect(receipt.body.data).not.toHaveProperty('userId');
  });

  it('returns anonymous receipts with metadata only and keeps owner summary unlinked', async () => {
    const survey = await createSurvey(ownerId, SurveyMode.ANONYMOUS, SurveyStatus.PUBLISHED);
    const response = await prisma.surveyResponse.create({
      data: {
        surveyId: survey.id,
        respondentId: null,
        answers: { create: { questionId: survey.questions[0].id, textValue: 'A private answer' } },
      },
    });

    const receipt = await request(app)
      .get(`/api/surveys/${survey.id}/responses/${response.id}`)
      .set('Authorization', `Bearer ${respondentToken}`);
    const sharedReference = await request(app)
      .get(`/api/surveys/${survey.id}/responses/${response.id}`)
      .set('Authorization', `Bearer ${otherRespondentToken}`);
    const form = await request(app)
      .get(`/api/surveys/${survey.id}/form`)
      .set('Authorization', `Bearer ${respondentToken}`);
    const summary = await request(app)
      .get(`/api/surveys/${survey.id}/summary`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const summaryText = JSON.stringify(summary.body.data);

    expect(receipt.status).toBe(200);
    expect(receipt.body.data).toEqual({
      responseId: response.id,
      surveyId: survey.id,
      submittedAt: response.submittedAt.toISOString(),
      mode: 'ANONYMOUS',
      answers: [],
    });
    expect(sharedReference.status).toBe(200);
    expect(sharedReference.body.data).toEqual(receipt.body.data);
    expect(form.status).toBe(200);
    expect(form.body.data.mode).toBe('ANONYMOUS');
    expect(summary.status).toBe(200);
    expect(summaryText).not.toContain(response.id);
    expect(summaryText).not.toContain('resp1@survey.local');
    expect(summaryText).not.toContain(respondentId);
    expect(summaryText).not.toContain(ownerId);
    expect(await prisma.surveyResponse.findUnique({ where: { id: response.id }, select: { respondentId: true } }))
      .toEqual({ respondentId: null });
  });

  it('drops only the claim timestamp while retaining existing claims and their unique key', async () => {
    const schema = `f05_migration_${randomUUID().replaceAll('-', '')}`;
    const migrationPath = path.join(__dirname, '../prisma/migrations/20261126160000_drop_response_claim_timestamp/migration.sql');
    const migration = await readFile(migrationPath, 'utf8');

    await prisma.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    try {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
        await tx.$executeRawUnsafe('CREATE TABLE response_claims (id TEXT PRIMARY KEY, survey_id TEXT NOT NULL, user_id TEXT NOT NULL, created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT response_claims_survey_id_user_id_key UNIQUE (survey_id, user_id))');
        await tx.$executeRawUnsafe('CREATE INDEX response_claims_user_id_idx ON response_claims (user_id)');
        await tx.$executeRawUnsafe("INSERT INTO response_claims (id, survey_id, user_id) VALUES ('claim-1', 'survey-1', 'user-1')");
        await tx.$executeRawUnsafe(migration);

        const claims = await tx.$queryRawUnsafe<Array<{ id: string; survey_id: string; user_id: string }>>(
          'SELECT id, survey_id, user_id FROM response_claims'
        );
        const createdAtColumns = await tx.$queryRawUnsafe<Array<{ count: bigint }>>(
          "SELECT COUNT(*) AS count FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'response_claims' AND column_name = 'created_at'",
          schema
        );
        const uniqueConstraints = await tx.$queryRawUnsafe<Array<{ count: bigint }>>(
          "SELECT COUNT(*) AS count FROM information_schema.table_constraints WHERE table_schema = $1 AND table_name = 'response_claims' AND constraint_type = 'UNIQUE'",
          schema
        );
        const userIndexes = await tx.$queryRawUnsafe<Array<{ count: bigint }>>(
          "SELECT COUNT(*) AS count FROM pg_indexes WHERE schemaname = $1 AND tablename = 'response_claims' AND indexname = 'response_claims_user_id_idx'",
          schema
        );
        expect(claims).toEqual([{ id: 'claim-1', survey_id: 'survey-1', user_id: 'user-1' }]);
        expect(createdAtColumns[0].count).toBe(BigInt(0));
        expect(uniqueConstraints[0].count).toBe(BigInt(1));
        expect(userIndexes[0].count).toBe(BigInt(1));
      });
    } finally {
      await prisma.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    }
  });
});
