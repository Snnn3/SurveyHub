import { Prisma, QuestionType, SurveyMode, SurveyStatus } from '@prisma/client';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../src/app';
import { env } from '../src/config/environment';
import { prisma } from '../src/utils/prisma';
import { seedUsers } from '../prisma/seed-users';
import { truncateTestDatabase } from './setup';

const password = 'Password123!';
const responseIdLow = '00000000-0000-4000-8000-000000000001';
const responseIdHigh = '00000000-0000-4000-8000-000000000002';
const claimId = '00000000-0000-4000-8000-000000000003';
const submittedAt = new Date('2030-01-01T10:00:00.000Z');

const definitions: Array<{ type: QuestionType; prompt: string; options?: string[] }> = [
  { type: QuestionType.SINGLE_CHOICE, prompt: '=1+1, single choice?', options: ['First, "choice"', 'Second'] },
  { type: QuestionType.MULTI_CHOICE, prompt: 'Multi choice', options: ['One', 'Two', 'Three'] },
  { type: QuestionType.SHORT_TEXT, prompt: 'Short text' },
  { type: QuestionType.LONG_TEXT, prompt: 'Long text' },
  { type: QuestionType.YES_NO, prompt: 'Yes or no', options: ['Yes', 'No'] },
  { type: QuestionType.LIKERT, prompt: 'Agreement', options: [
    'Strongly disagree', 'Disagree', 'Neither agree nor disagree', 'Agree', 'Strongly agree',
  ] },
  { type: QuestionType.RATING, prompt: 'Rating' },
  { type: QuestionType.INTEGER, prompt: 'Integer' },
  { type: QuestionType.DATE, prompt: 'Date' },
];

function parseCsv(csv: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      record.push(field);
      field = '';
    } else if (character === '\r' && csv[index + 1] === '\n') {
      record.push(field);
      records.push(record);
      record = [];
      field = '';
      index += 1;
    } else {
      field += character;
    }
  }

  return records;
}

async function loginAs(email: string): Promise<string> {
  const response = await request(app).post('/api/auth/login').send({ email, password });
  return response.body.data.token as string;
}

type SeedAnswer = Omit<Prisma.AnswerCreateWithoutResponseInput, 'question'> & { questionId: string };

async function createExportSurvey(ownerId: string, mode: SurveyMode = SurveyMode.IDENTIFIED) {
  return prisma.survey.create({
    data: {
      title: '=Survey, title',
      ownerId,
      mode,
      status: SurveyStatus.PUBLISHED,
      publishedAt: submittedAt,
      questions: {
        create: definitions.map((definition, orderIndex) => ({
          prompt: definition.prompt,
          questionType: definition.type,
          orderIndex,
          isRequired: false,
          ...(definition.type === QuestionType.INTEGER ? { numberMin: 0, numberMax: 100 } : {}),
          ...(definition.options
            ? { options: { create: definition.options.map((label, optionIndex) => ({ label, orderIndex: optionIndex })) } }
            : {}),
        })),
      },
    },
    include: { questions: { orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }], include: { options: { orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }] } } } },
  });
}

function identifiedAnswerData(survey: Awaited<ReturnType<typeof createExportSurvey>>): SeedAnswer[] {
  const questions = survey.questions;
  return [
    { questionId: questions[0].id, selectedOptions: { create: [{ optionId: questions[0].options[0].id }] } },
    { questionId: questions[1].id, selectedOptions: { create: [
      { optionId: questions[1].options[2].id }, { optionId: questions[1].options[0].id },
    ] } },
    { questionId: questions[2].id, textValue: '=SUM(A1:A2), text answer' },
    { questionId: questions[3].id, textValue: 'คำตอบ, "long"\r\nsecond line' },
    { questionId: questions[4].id, selectedOptions: { create: [{ optionId: questions[4].options[1].id }] } },
    { questionId: questions[5].id, selectedOptions: { create: [{ optionId: questions[5].options[4].id }] } },
    { questionId: questions[6].id, numberValue: 4 },
    { questionId: questions[7].id, numberValue: 7 },
    { questionId: questions[8].id, dateValue: new Date('2030-01-02T00:00:00.000Z') },
  ];
}

async function addResponse(
  survey: Awaited<ReturnType<typeof createExportSurvey>>,
  input: { id: string; respondentId: string | null; answers?: SeedAnswer[] }
) {
  return prisma.surveyResponse.create({
    data: {
      id: input.id,
      surveyId: survey.id,
      respondentId: input.respondentId,
      submittedAt,
      ...(input.answers
        ? { answers: { create: input.answers.map(({ questionId, ...answer }) => ({ ...answer, question: { connect: { id: questionId } } })) } }
        : {}),
    },
  });
}

async function snapshot(surveyId: string) {
  const [survey, responses, claims] = await Promise.all([
    prisma.survey.findUnique({ where: { id: surveyId }, select: { id: true, title: true, mode: true } }),
    prisma.surveyResponse.findMany({
      where: { surveyId },
      orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
      include: { answers: { include: { selectedOptions: true } } },
    }),
    prisma.responseClaim.findMany({ where: { surveyId }, orderBy: { id: 'asc' } }),
  ]);
  return JSON.stringify({ survey, responses, claims });
}

describe('F-08 owner CSV export (Issue #63 Stage 2)', () => {
  let ownerId: string;
  let otherOwnerId: string;
  let respondentId: string;
  let otherRespondentId: string;
  let ownerToken: string;
  let otherOwnerToken: string;
  let respondentToken: string;

  beforeEach(async () => {
    await truncateTestDatabase();
    const users = await prisma.$transaction((tx) => seedUsers(tx, password));
    ownerId = users['owner1@survey.local'].id;
    otherOwnerId = users['owner2@survey.local'].id;
    respondentId = users['resp1@survey.local'].id;
    otherRespondentId = users['resp2@survey.local'].id;
    ownerToken = await loginAs('owner1@survey.local');
    otherOwnerToken = await loginAs('owner2@survey.local');
    respondentToken = await loginAs('resp1@survey.local');
  });

  it('exports identified typed response/question rows in stable order without changing persisted data', async () => {
    const survey = await createExportSurvey(ownerId);
    await addResponse(survey, { id: responseIdHigh, respondentId, answers: identifiedAnswerData(survey) });
    await addResponse(survey, { id: responseIdLow, respondentId: otherRespondentId });
    const before = await snapshot(survey.id);

    const first = await request(app)
      .get(`/api/surveys/${survey.id}/export?format=csv`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const second = await request(app)
      .get(`/api/surveys/${survey.id}/export?format=csv`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(first.status).toBe(200);
    expect(first.headers['content-type']).toMatch(/^text\/csv; charset=utf-8/);
    expect(first.headers['content-disposition']).toContain(`survey-${survey.id}-identified.csv`);
    expect(first.text.charCodeAt(0)).not.toBe(0xfeff);
    expect(first.text).toBe(second.text);

    const rows = parseCsv(first.text);
    expect(rows[0]).toEqual([
      'survey_id', 'survey_title', 'response_id', 'submitted_at', 'respondent_id', 'respondent_full_name',
      'respondent_email', 'question_id', 'question_order', 'question_prompt', 'question_type', 'text_value',
      'number_value', 'date_value', 'selected_options_json',
    ]);
    expect(rows).toHaveLength(1 + definitions.length * 2);
    expect(rows.slice(1).map((row) => row[2])).toEqual([
      ...Array(definitions.length).fill(responseIdLow),
      ...Array(definitions.length).fill(responseIdHigh),
    ]);
    expect(rows.slice(1, 1 + definitions.length).map((row) => row[8])).toEqual(definitions.map((_, index) => String(index)));

    const answerRows = rows.slice(1 + definitions.length);
    expect(answerRows.map((row) => row[10])).toEqual(definitions.map(({ type }) => type));
    expect(answerRows[0][11]).toBe('');
    expect(answerRows[0][14]).toBe(JSON.stringify([{ optionId: survey.questions[0].options[0].id, label: 'First, "choice"' }]));
    expect(answerRows[1][14]).toBe(JSON.stringify([
      { optionId: survey.questions[1].options[0].id, label: 'One' },
      { optionId: survey.questions[1].options[2].id, label: 'Three' },
    ]));
    expect(answerRows[2][11]).toBe("'=SUM(A1:A2), text answer");
    expect(answerRows[3][11]).toBe('คำตอบ, "long"\r\nsecond line');
    expect(answerRows[4][14]).toBe(JSON.stringify([{ optionId: survey.questions[4].options[1].id, label: 'No' }]));
    expect(answerRows[5][14]).toBe(JSON.stringify([{ optionId: survey.questions[5].options[4].id, label: 'Strongly agree' }]));
    expect(answerRows[6][12]).toBe('4');
    expect(answerRows[7][12]).toBe('7');
    expect(answerRows[8][13]).toBe('2030-01-02');
    expect(answerRows[0][14]).toBe(JSON.stringify([{ optionId: survey.questions[0].options[0].id, label: 'First, "choice"' }]));
    expect(await snapshot(survey.id)).toBe(before);
  });

  it('exports anonymous aggregates only, including configured buckets and statistics', async () => {
    const survey = await createExportSurvey(ownerId, SurveyMode.ANONYMOUS);
    await addResponse(survey, { id: responseIdHigh, respondentId: null, answers: identifiedAnswerData(survey) });
    await prisma.responseClaim.create({ data: { id: claimId, surveyId: survey.id, userId: respondentId } });
    const before = await snapshot(survey.id);

    const response = await request(app)
      .get(`/api/surveys/${survey.id}/export?format=csv`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.headers['content-disposition']).toContain(`survey-${survey.id}-aggregate.csv`);
    expect(response.text).not.toContain(responseIdHigh);
    expect(response.text).not.toContain(claimId);
    expect(response.text).not.toContain(respondentId);
    expect(response.text).not.toContain('resp1@survey.local');
    expect(response.text).not.toContain('=SUM(A1:A2), text answer');
    expect(response.text).not.toContain('คำตอบ, "long"');

    const rows = parseCsv(response.text);
    expect(rows[0]).toEqual([
      'survey_id', 'survey_title', 'question_id', 'question_order', 'question_prompt', 'question_type', 'metric',
      'bucket_value', 'count', 'answered_count', 'total_responses', 'percentage', 'average', 'minimum', 'maximum',
    ]);
    const singleRows = rows.filter((row) => row[5] === 'SINGLE_CHOICE');
    expect(singleRows.map((row) => [row[7], row[8], row[11]])).toEqual([['First, "choice"', '1', '100'], ['Second', '0', '0']]);
    const textRows = rows.filter((row) => row[5] === 'SHORT_TEXT' || row[5] === 'LONG_TEXT');
    expect(textRows.map((row) => [row[6], row[7], row[8], row[9], row[11]])).toEqual([
      ['answered_count', '', '1', '1', ''], ['answered_count', '', '1', '1', ''],
    ]);
    const ratingRows = rows.filter((row) => row[5] === 'RATING');
    expect(ratingRows.map((row) => [row[7], row[8], row[12], row[13], row[14]])).toEqual([
      ['1', '0', '4', '4', '4'], ['2', '0', '4', '4', '4'], ['3', '0', '4', '4', '4'],
      ['4', '1', '4', '4', '4'], ['5', '0', '4', '4', '4'],
    ]);
    expect(rows.filter((row) => row[5] === 'INTEGER').map((row) => [row[7], row[8], row[11]])).toEqual([['7', '1', '']]);
    expect(rows.filter((row) => row[5] === 'DATE').map((row) => [row[7], row[8], row[11]])).toEqual([['2030-01-02', '1', '']]);
    expect(await snapshot(survey.id)).toBe(before);
  });

  it('returns empty rows for zero-answer questions and header-only output for a response-free identified survey', async () => {
    const anonymousSurvey = await createExportSurvey(ownerId, SurveyMode.ANONYMOUS);
    const anonymous = await request(app)
      .get(`/api/surveys/${anonymousSurvey.id}/export?format=csv`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const anonymousRows = parseCsv(anonymous.text);
    expect(anonymousRows).toHaveLength(1 + 2 + 3 + 1 + 1 + 2 + 5 + 5 + 1 + 1);
    expect(anonymousRows.slice(1).every((row) => row[8] === '0' && row[9] === '0' && row[10] === '0')).toBe(true);
    expect(anonymousRows.filter((row) => ['SINGLE_CHOICE', 'MULTI_CHOICE', 'YES_NO', 'LIKERT', 'RATING'].includes(row[5]))
      .every((row) => row[11] === '')).toBe(true);

    const identifiedSurvey = await createExportSurvey(ownerId);
    const identified = await request(app)
      .get(`/api/surveys/${identifiedSurvey.id}/export?format=csv`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(parseCsv(identified.text)).toEqual([[
      'survey_id', 'survey_title', 'response_id', 'submitted_at', 'respondent_id', 'respondent_full_name',
      'respondent_email', 'question_id', 'question_order', 'question_prompt', 'question_type', 'text_value',
      'number_value', 'date_value', 'selected_options_json',
    ]]);
  });

  it('rejects invalid formats and forbidden callers without disclosing data or mutating the database', async () => {
    const survey = await createExportSurvey(ownerId);
    await addResponse(survey, { id: responseIdHigh, respondentId, answers: identifiedAnswerData(survey) });
    const before = await snapshot(survey.id);

    for (const path of [
      `/api/surveys/${survey.id}/export`,
      `/api/surveys/${survey.id}/export?format=json`,
      `/api/surveys/${survey.id}/export?format=csv&format=json`,
    ]) {
      const invalid = await request(app).get(path).set('Authorization', `Bearer ${ownerToken}`);
      expect(invalid.status).toBe(400);
      expect(invalid.body.error?.code).toBe('VALIDATION_ERROR');
      expect(JSON.stringify(invalid.body)).not.toContain('=SUM(A1:A2)');
    }

    for (const [token, code] of [
      [respondentToken, 'FORBIDDEN_ROLE'],
      [otherOwnerToken, 'FORBIDDEN_OWNERSHIP'],
    ]) {
      const forbidden = await request(app)
        .get(`/api/surveys/${survey.id}/export?format=csv`)
        .set('Authorization', `Bearer ${token}`);
      expect(forbidden.status).toBe(403);
      expect(forbidden.body.error?.code).toBe(code);
      expect(JSON.stringify(forbidden.body)).not.toContain(survey.title);
      expect(JSON.stringify(forbidden.body)).not.toContain(responseIdHigh);
      expect(JSON.stringify(forbidden.body)).not.toContain('=SUM(A1:A2)');
    }

    const missing = await request(app).get(`/api/surveys/${survey.id}/export?format=csv`);
    const malformed = await request(app)
      .get(`/api/surveys/${survey.id}/export?format=csv`)
      .set('Authorization', 'Bearer not-a-jwt');
    const expiredToken = jwt.sign({ sub: ownerId, ver: 0 }, env.JWT_SECRET, { algorithm: 'HS256', expiresIn: -60 });
    const expired = await request(app)
      .get(`/api/surveys/${survey.id}/export?format=csv`)
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(missing.status).toBe(401);
    expect(malformed.status).toBe(401);
    expect(expired.status).toBe(401);
    expect(JSON.stringify([missing.body, malformed.body, expired.body])).not.toContain(responseIdHigh);

    await prisma.user.update({ where: { id: ownerId }, data: { tokenVersion: { increment: 1 } } });
    const revoked = await request(app)
      .get(`/api/surveys/${survey.id}/export?format=csv`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(revoked.status).toBe(401);
    expect(revoked.body.error?.code).toBe('TOKEN_REVOKED');
    expect(await snapshot(survey.id)).toBe(before);
  });

  it('returns 404 for an unknown survey and 403 when a non-owner requests an anonymous survey', async () => {
    const unknown = await request(app)
      .get('/api/surveys/00000000-0000-4000-8000-000000000099/export?format=csv')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(unknown.status).toBe(404);
    expect(unknown.body.error?.code).toBe('NOT_FOUND');

    const survey = await createExportSurvey(ownerId, SurveyMode.ANONYMOUS);
    const forbidden = await request(app)
      .get(`/api/surveys/${survey.id}/export?format=csv`)
      .set('Authorization', `Bearer ${otherOwnerToken}`);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error?.code).toBe('FORBIDDEN_OWNERSHIP');
    expect(JSON.stringify(forbidden.body)).not.toContain(survey.title);
  });
});
