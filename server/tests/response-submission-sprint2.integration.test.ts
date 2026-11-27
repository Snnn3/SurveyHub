import { QuestionType, SurveyMode, SurveyStatus } from '@prisma/client';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/utils/prisma';
import { FIXED_QUESTION_OPTIONS } from '../src/validators/survey.validator';
import { seedUsers } from '../prisma/seed-users';
import { truncateTestDatabase } from './setup';

const password = 'Password123!';

async function loginAs(email: string): Promise<string> {
  const response = await request(app).post('/api/auth/login').send({ email, password });
  return response.body.data.token as string;
}

async function createPublishedSurvey(
  ownerId: string,
  options: { mode?: SurveyMode; closesAt?: Date | null } = {}
) {
  return prisma.survey.create({
    data: {
      title: 'Issue 72 transaction integration survey',
      ownerId,
      mode: options.mode ?? SurveyMode.IDENTIFIED,
      status: SurveyStatus.PUBLISHED,
      publishedAt: new Date(Date.now() - 60_000),
      closesAt: options.closesAt ?? null,
      questions: {
        create: [{
          prompt: 'Choose an option',
          questionType: QuestionType.SINGLE_CHOICE,
          orderIndex: 0,
          isRequired: true,
          options: { create: [{ label: 'A', orderIndex: 0 }, { label: 'B', orderIndex: 1 }] },
        }],
      },
    },
    include: { questions: { include: { options: true } } },
  });
}

async function createF06Survey(ownerId: string) {
  const fixedOptions = (type: QuestionType) => FIXED_QUESTION_OPTIONS[type]!.map((label, orderIndex) => ({ label, orderIndex }));
  return prisma.survey.create({
    data: {
      title: 'Issue 72 F-06 typed response survey',
      ownerId,
      status: SurveyStatus.PUBLISHED,
      publishedAt: new Date(Date.now() - 60_000),
      questions: {
        create: [
          {
            prompt: 'Select topics', questionType: QuestionType.MULTI_CHOICE, orderIndex: 0, isRequired: true,
            minSelections: 1, maxSelections: 2,
            options: { create: [{ label: 'A', orderIndex: 0 }, { label: 'B', orderIndex: 1 }] },
          },
          { prompt: 'Add a comment', questionType: QuestionType.LONG_TEXT, orderIndex: 1, isRequired: true },
          {
            prompt: 'Recommend the course?', questionType: QuestionType.YES_NO, orderIndex: 2, isRequired: true,
            options: { create: fixedOptions(QuestionType.YES_NO) },
          },
          {
            prompt: 'Rate agreement', questionType: QuestionType.LIKERT, orderIndex: 3, isRequired: true,
            options: { create: fixedOptions(QuestionType.LIKERT) },
          },
          { prompt: 'Rate the course', questionType: QuestionType.RATING, orderIndex: 4, isRequired: true },
          {
            prompt: 'Labs attended', questionType: QuestionType.INTEGER, orderIndex: 5, isRequired: true,
            numberMin: -2, numberMax: 10,
          },
          { prompt: 'Attendance date', questionType: QuestionType.DATE, orderIndex: 6, isRequired: true },
        ],
      },
    },
    include: { questions: { include: { options: true } } },
  });
}

async function submissionState(surveyId: string) {
  const [responses, claims] = await Promise.all([
    prisma.surveyResponse.findMany({
      where: { surveyId },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        respondentId: true,
        answers: {
          orderBy: { id: 'asc' },
          select: {
            id: true,
            questionId: true,
            textValue: true,
            numberValue: true,
            dateValue: true,
            selectedOptions: { orderBy: { optionId: 'asc' }, select: { optionId: true } },
          },
        },
      },
    }),
    prisma.responseClaim.findMany({
      where: { surveyId },
      orderBy: { id: 'asc' },
      select: { id: true, userId: true },
    }),
  ]);
  return { responses, claims };
}

describe('Issue #72 atomic response submission integration', () => {
  let ownerId: string;
  let respondentId: string;
  let otherRespondentId: string;
  let respondentToken: string;

  beforeEach(async () => {
    await truncateTestDatabase();
    const users = await prisma.$transaction((tx) => seedUsers(tx, password));
    ownerId = users['owner1@survey.local'].id;
    respondentId = users['resp1@survey.local'].id;
    otherRespondentId = users['resp2@survey.local'].id;
    respondentToken = await loginAs('resp1@survey.local');
  });

  it('persists all seven F-06 types and returns typed values in the identified receipt', async () => {
    const survey = await createF06Survey(ownerId);
    await prisma.surveyEligibility.create({ data: { surveyId: survey.id, userId: respondentId } });
    const question = (type: QuestionType) => survey.questions.find((item) => item.questionType === type)!;
    const answers = [
      { questionId: question(QuestionType.MULTI_CHOICE).id, selectedOptionIds: question(QuestionType.MULTI_CHOICE).options.map((option) => option.id) },
      { questionId: question(QuestionType.LONG_TEXT).id, textValue: '  Detailed feedback  ' },
      { questionId: question(QuestionType.YES_NO).id, selectedOptionIds: [question(QuestionType.YES_NO).options[0].id] },
      { questionId: question(QuestionType.LIKERT).id, selectedOptionIds: [question(QuestionType.LIKERT).options[3].id] },
      { questionId: question(QuestionType.RATING).id, numberValue: 5 },
      { questionId: question(QuestionType.INTEGER).id, numberValue: -2 },
      { questionId: question(QuestionType.DATE).id, dateValue: '2024-02-29' },
    ];

    const submitted = await request(app)
      .post(`/api/surveys/${survey.id}/responses`)
      .set('Authorization', `Bearer ${respondentToken}`)
      .send({ answers });

    expect(submitted.status).toBe(201);
    const persisted = await prisma.surveyResponse.findUnique({
      where: { id: submitted.body.data.responseId },
      include: { answers: { include: { selectedOptions: true } } },
    });
    expect(persisted?.respondentId).toBe(respondentId);
    expect(persisted?.answers).toHaveLength(7);
    const persistedAnswer = (type: QuestionType) => persisted!.answers.find((answer) => answer.questionId === question(type).id)!;
    expect(persistedAnswer(QuestionType.MULTI_CHOICE).selectedOptions.map((option) => option.optionId).sort())
      .toEqual(question(QuestionType.MULTI_CHOICE).options.map((option) => option.id).sort());
    expect(persistedAnswer(QuestionType.LONG_TEXT).textValue).toBe('Detailed feedback');
    expect(persistedAnswer(QuestionType.RATING).numberValue).toBe(5);
    expect(persistedAnswer(QuestionType.INTEGER).numberValue).toBe(-2);
    expect(persistedAnswer(QuestionType.DATE).dateValue?.toISOString().slice(0, 10)).toBe('2024-02-29');
    expect(await prisma.responseClaim.count({ where: { surveyId: survey.id, userId: respondentId } })).toBe(1);

    const receipt = await request(app)
      .get(`/api/surveys/${survey.id}/responses/${submitted.body.data.responseId}`)
      .set('Authorization', `Bearer ${respondentToken}`);
    expect(receipt.status).toBe(200);
    expect(receipt.body.data.answers).toEqual(expect.arrayContaining([
      expect.objectContaining({ questionId: question(QuestionType.LONG_TEXT).id, textValue: 'Detailed feedback' }),
      expect.objectContaining({ questionId: question(QuestionType.RATING).id, numberValue: 5 }),
      expect.objectContaining({ questionId: question(QuestionType.INTEGER).id, numberValue: -2 }),
      expect.objectContaining({ questionId: question(QuestionType.DATE).id, dateValue: '2024-02-29' }),
    ]));
  });

  it('rolls back the claim and response if answer persistence fails', async () => {
    const survey = await createPublishedSurvey(ownerId);
    const before = await submissionState(survey.id);
    await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS issue72_fail_answer_insert ON answers');
    await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS issue72_fail_answer_insert()');
    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION issue72_fail_answer_insert() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'issue72 forced answer insert failure';
      END;
      $$ LANGUAGE plpgsql
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER issue72_fail_answer_insert
      BEFORE INSERT ON answers
      FOR EACH ROW EXECUTE FUNCTION issue72_fail_answer_insert()
    `);

    try {
      const rejected = await request(app)
        .post(`/api/surveys/${survey.id}/responses`)
        .set('Authorization', `Bearer ${respondentToken}`)
        .send({ answers: [{ questionId: survey.questions[0].id, selectedOptionIds: [survey.questions[0].options[0].id] }] });

      expect(rejected.status).toBe(500);
      expect(await submissionState(survey.id)).toEqual(before);
    } finally {
      await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS issue72_fail_answer_insert ON answers');
      await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS issue72_fail_answer_insert()');
    }
  });

  it('accepts one anonymous concurrent submission, stores no respondent link, and returns metadata only', async () => {
    const survey = await createPublishedSurvey(ownerId, { mode: SurveyMode.ANONYMOUS });
    const answer = { questionId: survey.questions[0].id, selectedOptionIds: [survey.questions[0].options[0].id] };
    const submit = () => request(app)
      .post(`/api/surveys/${survey.id}/responses`)
      .set('Authorization', `Bearer ${respondentToken}`)
      .send({ answers: [answer] });

    const attempts = await Promise.all([submit(), submit()]);
    expect(attempts.map((response) => response.status).sort()).toEqual([201, 409]);
    const accepted = attempts.find((response) => response.status === 201)!;
    expect(await prisma.surveyResponse.findMany({ where: { surveyId: survey.id }, select: { respondentId: true } }))
      .toEqual([{ respondentId: null }]);
    expect(await prisma.responseClaim.count({ where: { surveyId: survey.id, userId: respondentId } })).toBe(1);

    const receipt = await request(app)
      .get(`/api/surveys/${survey.id}/responses/${accepted.body.data.responseId}`)
      .set('Authorization', `Bearer ${respondentToken}`);
    expect(receipt.status).toBe(200);
    expect(receipt.body.data).toMatchObject({
      responseId: accepted.body.data.responseId,
      surveyId: survey.id,
      mode: SurveyMode.ANONYMOUS,
      answers: [],
    });
    expect(receipt.body.data).not.toHaveProperty('respondentId');
    expect(receipt.body.data).not.toHaveProperty('userId');
  });

  it('rejects an identified duplicate without adding response, claim, or answer rows', async () => {
    const survey = await createPublishedSurvey(ownerId);
    const answers = [{ questionId: survey.questions[0].id, selectedOptionIds: [survey.questions[0].options[0].id] }];
    const path = `/api/surveys/${survey.id}/responses`;
    const first = await request(app).post(path).set('Authorization', `Bearer ${respondentToken}`).send({ answers });
    expect(first.status).toBe(201);
    const before = await submissionState(survey.id);

    const duplicate = await request(app).post(path).set('Authorization', `Bearer ${respondentToken}`).send({ answers });

    expect({ status: duplicate.status, code: duplicate.body.error.code, state: await submissionState(survey.id) }).toEqual({
      status: 409,
      code: 'DUPLICATE_SUBMISSION',
      state: before,
    });
  });

  it('rejects a closed survey without adding response, claim, or answer rows', async () => {
    const survey = await createPublishedSurvey(ownerId);
    await prisma.survey.update({ where: { id: survey.id }, data: { status: SurveyStatus.CLOSED, closedAt: new Date() } });
    const before = await submissionState(survey.id);

    const rejected = await request(app)
      .post(`/api/surveys/${survey.id}/responses`)
      .set('Authorization', `Bearer ${respondentToken}`)
      .send({ answers: [{ questionId: survey.questions[0].id, selectedOptionIds: [survey.questions[0].options[0].id] }] });

    expect({ status: rejected.status, code: rejected.body.error?.code, state: await submissionState(survey.id) }).toEqual({
      status: 400,
      code: 'SURVEY_NOT_ACCEPTING_RESPONSES',
      state: before,
    });
  });

  it('rejects an ineligible respondent without adding response, claim, or answer rows', async () => {
    const survey = await createPublishedSurvey(ownerId);
    await prisma.surveyEligibility.create({ data: { surveyId: survey.id, userId: otherRespondentId } });
    const before = await submissionState(survey.id);

    const rejected = await request(app)
      .post(`/api/surveys/${survey.id}/responses`)
      .set('Authorization', `Bearer ${respondentToken}`)
      .send({ answers: [{ questionId: survey.questions[0].id, selectedOptionIds: [survey.questions[0].options[0].id] }] });

    expect({ status: rejected.status, code: rejected.body.error?.code, state: await submissionState(survey.id) }).toEqual({
      status: 403,
      code: 'NOT_ELIGIBLE',
      state: before,
    });
  });

  it('rejects malformed answers without adding response, claim, or answer rows', async () => {
    const survey = await createPublishedSurvey(ownerId);
    const before = await submissionState(survey.id);

    const rejected = await request(app)
      .post(`/api/surveys/${survey.id}/responses`)
      .set('Authorization', `Bearer ${respondentToken}`)
      .send({ answers: [{ questionId: survey.questions[0].id, textValue: 'wrong type' }] });

    expect({ status: rejected.status, code: rejected.body.error?.code, state: await submissionState(survey.id) }).toEqual({
      status: 400,
      code: 'INVALID_ANSWER',
      state: before,
    });
  });

  it('denies survey owners without writing response, claim, or answer rows', async () => {
    const survey = await createPublishedSurvey(ownerId);
    const ownerToken = await loginAs('owner1@survey.local');
    const before = await submissionState(survey.id);

    const rejected = await request(app)
      .post(`/api/surveys/${survey.id}/responses`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ answers: [{ questionId: survey.questions[0].id, selectedOptionIds: [survey.questions[0].options[0].id] }] });

    expect(rejected.status).toBe(403);
    expect(rejected.body.error.code).toBe('FORBIDDEN_ROLE');
    expect(JSON.stringify(rejected.body)).not.toContain(survey.title);
    expect(JSON.stringify(rejected.body)).not.toContain(survey.questions[0].prompt);
    expect(await submissionState(survey.id)).toEqual(before);
  });

  it.each([
    ['before', -1, 201],
    ['at', 0, 400],
    ['after', 1, 400],
  ])('uses the exact server-time deadline boundary (%s)', async (_label, offset, expectedStatus) => {
    const closesAt = new Date(Date.now() + 60_000);
    const survey = await createPublishedSurvey(ownerId, { closesAt });
    if (offset >= 0) {
      await prisma.surveyEligibility.create({ data: { surveyId: survey.id, userId: otherRespondentId } });
    }
    const before = await submissionState(survey.id);
    const testTime = new Date(closesAt.getTime() + offset);

    jest.useFakeTimers({
      doNotFake: [
        'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
        'setImmediate', 'clearImmediate', 'nextTick', 'queueMicrotask', 'hrtime', 'performance',
      ],
    });
    jest.setSystemTime(testTime);
    try {
      const submitted = await request(app)
        .post(`/api/surveys/${survey.id}/responses`)
        .set('Authorization', `Bearer ${respondentToken}`)
        .send({ answers: [{ questionId: survey.questions[0].id, selectedOptionIds: [survey.questions[0].options[0].id] }] });

      expect(submitted.status).toBe(expectedStatus);
      if (expectedStatus === 201) {
        expect((await submissionState(survey.id)).responses).toHaveLength(1);
      } else {
        expect(submitted.body.error.code).toBe('SURVEY_NOT_ACCEPTING_RESPONSES');
        expect(await submissionState(survey.id)).toEqual(before);
      }
    } finally {
      jest.useRealTimers();
    }
  });
});
