import { QuestionType, SurveyStatus } from '@prisma/client';
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

async function createSummarySurvey(ownerId: string) {
  return prisma.survey.create({
    data: {
      title: 'Aggregate Summary Survey',
      description: 'Survey for summary testing',
      ownerId,
      status: SurveyStatus.PUBLISHED,
      publishedAt: new Date(),
      questions: {
        create: [
          {
            prompt: 'Rate the experience',
            questionType: QuestionType.SINGLE_CHOICE,
            orderIndex: 0,
            isRequired: true,
            options: {
              create: [
                { label: 'Option A', orderIndex: 0 },
                { label: 'Option B', orderIndex: 1 },
              ],
            },
          },
          {
            prompt: 'Comments',
            questionType: QuestionType.SHORT_TEXT,
            orderIndex: 1,
            isRequired: false,
          },
        ],
      },
    },
    include: {
      questions: {
        orderBy: { orderIndex: 'asc' },
        include: {
          options: {
            orderBy: { orderIndex: 'asc' },
          },
        },
      },
    },
  });
}

describe('F-04 Aggregate Summary (STS-F04-01 to STS-F04-04)', () => {
  let owner1Id: string;
  let owner2Id: string;
  let resp1Id: string;
  let resp2Id: string;

  let owner1Token: string;
  let owner2Token: string;
  let resp1Token: string;

  beforeEach(async () => {
    await truncateTestDatabase();
    const users = await prisma.$transaction(seedUsers);
    owner1Id = users['owner1@survey.local'].id;
    owner2Id = users['owner2@survey.local'].id;
    resp1Id = users['resp1@survey.local'].id;
    resp2Id = users['resp2@survey.local'].id;

    owner1Token = await loginAs('owner1@survey.local');
    owner2Token = await loginAs('owner2@survey.local');
    resp1Token = await loginAs('resp1@survey.local');
  });

  it('STS-F04-01: returns counts, percentages, text answers, and no identity keys', async () => {
    const survey = await createSummarySurvey(owner1Id);
    const [choiceQuestion, textQuestion] = survey.questions;
    const [optionA, optionB] = choiceQuestion.options;

    // Response 1: chose Option A and left optional text
    await prisma.surveyResponse.create({
      data: {
        surveyId: survey.id,
        respondentId: resp1Id,
        answers: {
          create: [
            {
              questionId: choiceQuestion.id,
              selectedOptions: { create: [{ optionId: optionA.id }] },
            },
            {
              questionId: textQuestion.id,
              textValue: 'Great experience!',
            },
          ],
        },
      },
    });

    // Response 2: chose Option B and omitted optional text
    await prisma.surveyResponse.create({
      data: {
        surveyId: survey.id,
        respondentId: resp2Id,
        answers: {
          create: [
            {
              questionId: choiceQuestion.id,
              selectedOptions: { create: [{ optionId: optionB.id }] },
            },
          ],
        },
      },
    });

    const res = await request(app)
      .get(`/api/surveys/${survey.id}/summary`)
      .set('Authorization', `Bearer ${owner1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { data } = res.body;
    expect(data.surveyId).toBe(survey.id);
    expect(data.title).toBe('Aggregate Summary Survey');
    expect(data.totalResponses).toBe(2);
    expect(data.questions).toHaveLength(2);

    const choiceResult = data.questions[0];
    expect(choiceResult.questionId).toBe(choiceQuestion.id);
    expect(choiceResult.answeredCount).toBe(2);
    expect(choiceResult.options).toEqual([
      { optionId: optionA.id, label: 'Option A', count: 1, percentage: 50 },
      { optionId: optionB.id, label: 'Option B', count: 1, percentage: 50 },
    ]);

    const textResult = data.questions[1];
    expect(textResult.questionId).toBe(textQuestion.id);
    expect(textResult.answeredCount).toBe(1);
    expect(textResult.textAnswers).toEqual(['Great experience!']);

    // Privacy verification: no respondent identity fields present anywhere
    const serialized = JSON.stringify(data);
    expect(serialized).not.toContain(resp1Id);
    expect(serialized).not.toContain(resp2Id);
    expect(serialized).not.toContain('resp1@survey.local');
    expect(serialized).not.toContain('Student Respondent');
    expect(serialized).not.toContain('"respondentId"');
    expect(serialized).not.toContain('"responseId"');
  });

  it('STS-F04-02: respondent receives 403 FORBIDDEN_ROLE and no summary data', async () => {
    const survey = await createSummarySurvey(owner1Id);

    const res = await request(app)
      .get(`/api/surveys/${survey.id}/summary`)
      .set('Authorization', `Bearer ${resp1Token}`);

    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe('FORBIDDEN_ROLE');
    expect(res.body.data).toBeUndefined();
  });

  it('STS-F04-03: non-owner owner receives 403 FORBIDDEN_OWNERSHIP and no statistics', async () => {
    const survey = await createSummarySurvey(owner1Id);

    const res = await request(app)
      .get(`/api/surveys/${survey.id}/summary`)
      .set('Authorization', `Bearer ${owner2Token}`);

    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe('FORBIDDEN_OWNERSHIP');
    expect(res.body.data).toBeUndefined();
  });

  it('STS-F04-04: survey with zero responses returns zero counts, empty lists and 200', async () => {
    const survey = await createSummarySurvey(owner1Id);
    const [choiceQuestion, textQuestion] = survey.questions;
    const [optionA, optionB] = choiceQuestion.options;

    const res = await request(app)
      .get(`/api/surveys/${survey.id}/summary`)
      .set('Authorization', `Bearer ${owner1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { data } = res.body;
    expect(data.totalResponses).toBe(0);
    expect(data.questions[0].answeredCount).toBe(0);
    expect(data.questions[0].options).toEqual([
      { optionId: optionA.id, label: 'Option A', count: 0, percentage: 0 },
      { optionId: optionB.id, label: 'Option B', count: 0, percentage: 0 },
    ]);
    expect(data.questions[1].answeredCount).toBe(0);
    expect(data.questions[1].textAnswers).toEqual([]);
  });

  it('returns 404 NOT_FOUND for unknown survey UUID or malformed UUID', async () => {
    const unknownUuid = '11111111-1111-4111-8111-111111111111';
    const unknownRes = await request(app)
      .get(`/api/surveys/${unknownUuid}/summary`)
      .set('Authorization', `Bearer ${owner1Token}`);

    expect(unknownRes.status).toBe(404);
    expect(unknownRes.body.error?.code).toBe('NOT_FOUND');

    const malformedRes = await request(app)
      .get('/api/surveys/not-a-valid-uuid/summary')
      .set('Authorization', `Bearer ${owner1Token}`);

    expect(malformedRes.status).toBe(404);
    expect(malformedRes.body.error?.code).toBe('NOT_FOUND');
  });

  it('uses answeredCount rather than totalResponses as percentage denominator when questions are skipped', async () => {
    const survey = await prisma.survey.create({
      data: {
        title: 'Optional Choice Survey',
        ownerId: owner1Id,
        status: SurveyStatus.PUBLISHED,
        publishedAt: new Date(),
        questions: {
          create: [
            {
              prompt: 'Optional single choice',
              questionType: QuestionType.SINGLE_CHOICE,
              isRequired: false,
              orderIndex: 0,
              options: {
                create: [
                  { label: 'Yes', orderIndex: 0 },
                  { label: 'No', orderIndex: 1 },
                ],
              },
            },
          ],
        },
      },
      include: {
        questions: {
          include: { options: true },
        },
      },
    });

    const [question] = survey.questions;
    const yesOpt = question.options.find((o) => o.label === 'Yes')!;
    const noOpt = question.options.find((o) => o.label === 'No')!;

    // Response 1: chose Yes
    await prisma.surveyResponse.create({
      data: {
        surveyId: survey.id,
        respondentId: resp1Id,
        answers: {
          create: [
            {
              questionId: question.id,
              selectedOptions: { create: [{ optionId: yesOpt.id }] },
            },
          ],
        },
      },
    });

    // Response 2: skipped question completely (no answer)
    await prisma.surveyResponse.create({
      data: {
        surveyId: survey.id,
        respondentId: resp2Id,
      },
    });

    const res = await request(app)
      .get(`/api/surveys/${survey.id}/summary`)
      .set('Authorization', `Bearer ${owner1Token}`);

    expect(res.status).toBe(200);
    const { data } = res.body;
    expect(data.totalResponses).toBe(2);

    const questionResult = data.questions[0];
    expect(questionResult.answeredCount).toBe(1);
    // Denominator is answeredCount (1), NOT totalResponses (2)
    // 1 / 1 = 100%, NOT 1 / 2 = 50%
    expect(questionResult.options).toEqual([
      { optionId: yesOpt.id, label: 'Yes', count: 1, percentage: 100 },
      { optionId: noOpt.id, label: 'No', count: 0, percentage: 0 },
    ]);
  });
});
