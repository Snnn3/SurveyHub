import { QuestionType, SurveyStatus } from '@prisma/client';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/utils/prisma';
import * as responseService from '../src/services/response.service';
import { seedUsers } from '../prisma/seed-users';
import { truncateTestDatabase } from './setup';

const password = 'Password123!';

async function loginAs(email: string): Promise<string> {
  const response = await request(app).post('/api/auth/login').send({ email, password });
  return response.body.data.token as string;
}

async function createSurvey(
  ownerId: string,
  status: SurveyStatus = SurveyStatus.PUBLISHED,
  title = 'Response test survey'
) {
  return prisma.survey.create({
    data: {
      title,
      ownerId,
      status,
      publishedAt: status === SurveyStatus.PUBLISHED ? new Date() : null,
      closedAt: status === SurveyStatus.CLOSED ? new Date() : null,
      questions: {
        create: [
          {
            prompt: 'How was it?',
            questionType: QuestionType.SINGLE_CHOICE,
            orderIndex: 0,
            isRequired: true,
            options: { create: [{ label: 'Good', orderIndex: 0 }, { label: 'Bad', orderIndex: 1 }] },
          },
          {
            prompt: 'Anything else?',
            questionType: QuestionType.SHORT_TEXT,
            orderIndex: 1,
            isRequired: false,
          },
        ],
      },
    },
    include: { questions: { include: { options: true } } },
  });
}

describe('F-03 survey submission and receipts (STS-F03-01 to STS-F03-10)', () => {
  let ownerId: string;
  let respondentId: string;
  let otherRespondentId: string;
  let ownerToken: string;
  let respondentToken: string;
  let otherRespondentToken: string;

  beforeEach(async () => {
    await truncateTestDatabase();
    const users = await prisma.$transaction(seedUsers);
    ownerId = users['owner1@survey.local'].id;
    respondentId = users['resp1@survey.local'].id;
    otherRespondentId = users['resp2@survey.local'].id;
    ownerToken = await loginAs('owner1@survey.local');
    respondentToken = await loginAs('resp1@survey.local');
    otherRespondentToken = await loginAs('resp2@survey.local');
  });

  it('STS-F03-01: lists published surveys and only the caller’s submission state and receipt id', async () => {
    const submittedSurvey = await createSurvey(ownerId, SurveyStatus.PUBLISHED, 'Submitted');
    const unsubmittedSurvey = await createSurvey(ownerId, SurveyStatus.PUBLISHED, 'Unsubmitted');
    await createSurvey(ownerId, SurveyStatus.DRAFT, 'Draft');
    await createSurvey(ownerId, SurveyStatus.CLOSED, 'Closed');

    const submitted = await request(app)
      .post(`/api/surveys/${submittedSurvey.id}/responses`)
      .set('Authorization', `Bearer ${respondentToken}`)
      .send({ answers: [{ questionId: submittedSurvey.questions[0].id, selectedOptionIds: [submittedSurvey.questions[0].options[0].id] }] });
    expect(submitted.status).toBe(201);
    const otherSubmission = await request(app)
      .post(`/api/surveys/${unsubmittedSurvey.id}/responses`)
      .set('Authorization', `Bearer ${otherRespondentToken}`)
      .send({ answers: [{ questionId: unsubmittedSurvey.questions[0].id, selectedOptionIds: [unsubmittedSurvey.questions[0].options[0].id] }] });
    expect(otherSubmission.status).toBe(201);

    const response = await request(app)
      .get('/api/surveys/active')
      .set('Authorization', `Bearer ${respondentToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data.find((item: { id: string }) => item.id === submittedSurvey.id)).toMatchObject({
      status: 'PUBLISHED',
      hasSubmitted: true,
      responseId: submitted.body.data.responseId,
    });
    expect(response.body.data.find((item: { id: string }) => item.id === unsubmittedSurvey.id)).toMatchObject({
      status: 'PUBLISHED',
      hasSubmitted: false,
    });
    expect(response.body.data.find((item: { id: string }) => item.id === unsubmittedSurvey.id).responseId).toBeUndefined();
  });

  it('STS-F03-02: returns ordered questions and options for a published survey', async () => {
    const survey = await createSurvey(ownerId);
    const choiceQuestion = survey.questions.find((question) => question.questionType === QuestionType.SINGLE_CHOICE)!;
    const textQuestion = survey.questions.find((question) => question.questionType === QuestionType.SHORT_TEXT)!;
    const goodOption = choiceQuestion.options.find((option) => option.label === 'Good')!;
    const badOption = choiceQuestion.options.find((option) => option.label === 'Bad')!;

    await prisma.question.update({ where: { id: choiceQuestion.id }, data: { orderIndex: 1 } });
    await prisma.question.update({ where: { id: textQuestion.id }, data: { orderIndex: 0 } });
    await prisma.option.update({ where: { id: goodOption.id }, data: { orderIndex: 1 } });
    await prisma.option.update({ where: { id: badOption.id }, data: { orderIndex: 0 } });

    const response = await request(app)
      .get(`/api/surveys/${survey.id}/form`)
      .set('Authorization', `Bearer ${respondentToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.questions.map((question: { id: string }) => question.id)).toEqual(
      [textQuestion.id, choiceQuestion.id]
    );
    expect(response.body.data.questions[1].options.map((option: { id: string }) => option.id)).toEqual(
      [badOption.id, goodOption.id]
    );
  });

  it('STS-F03-03: persists a response, answers, selected option, and claim atomically', async () => {
    const survey = await createSurvey(ownerId);
    const response = await request(app)
      .post(`/api/surveys/${survey.id}/responses`)
      .set('Authorization', `Bearer ${respondentToken}`)
      .send({
        answers: [
          { questionId: survey.questions[0].id, selectedOptionIds: [survey.questions[0].options[0].id] },
          { questionId: survey.questions[1].id, textValue: '  More lab time, please.  ' },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      responseId: expect.any(String),
      surveyId: survey.id,
      submittedAt: expect.any(String),
      message: 'Survey response successfully recorded.',
    });
    const stored = await prisma.surveyResponse.findUnique({
      where: { id: response.body.data.responseId },
      include: { answers: { include: { selectedOptions: true } } },
    });
    expect(stored?.respondentId).toBe(respondentId);
    expect(stored?.answers).toHaveLength(2);
    expect(stored?.answers.find((answer) => answer.questionId === survey.questions[0].id)?.selectedOptions[0].optionId)
      .toBe(survey.questions[0].options[0].id);
    expect(stored?.answers.find((answer) => answer.questionId === survey.questions[1].id)?.textValue)
      .toBe('More lab time, please.');
    expect(await prisma.responseClaim.count({ where: { surveyId: survey.id, userId: respondentId } })).toBe(1);
  });

  it('STS-F03-04: returns one duplicate conflict sequentially and under concurrent submissions', async () => {
    const survey = await createSurvey(ownerId);
    const payload = { answers: [{ questionId: survey.questions[0].id, selectedOptionIds: [survey.questions[0].options[0].id] }] };
    const submit = (token: string) => request(app)
      .post(`/api/surveys/${survey.id}/responses`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    const first = await submit(respondentToken);
    const duplicate = await submit(respondentToken);
    expect(first.status).toBe(201);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('DUPLICATE_SUBMISSION');
    expect(await prisma.surveyResponse.count({ where: { surveyId: survey.id, respondentId } })).toBe(1);

    const concurrent = await Promise.all([submit(otherRespondentToken), submit(otherRespondentToken)]);
    expect(concurrent.map((item) => item.status).sort()).toEqual([201, 409]);
    expect(concurrent.find((item) => item.status === 409)?.body.error.code).toBe('DUPLICATE_SUBMISSION');
    expect(await prisma.surveyResponse.count({ where: { surveyId: survey.id, respondentId: otherRespondentId } })).toBe(1);
    expect(await prisma.responseClaim.count({ where: { surveyId: survey.id, userId: otherRespondentId } })).toBe(1);
  });

  it('STS-F03-05: rejects submissions to draft and closed surveys', async () => {
    for (const status of [SurveyStatus.DRAFT, SurveyStatus.CLOSED]) {
      const survey = await createSurvey(ownerId, status, status);
      const response = await request(app)
        .post(`/api/surveys/${survey.id}/responses`)
        .set('Authorization', `Bearer ${respondentToken}`)
        .send({ answers: [] });
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('SURVEY_NOT_ACCEPTING_RESPONSES');
    }
  });

  it('STS-F03-06: reports missing required questions and accepts omitted optional questions', async () => {
    const survey = await createSurvey(ownerId);
    const missing = await request(app)
      .post(`/api/surveys/${survey.id}/responses`)
      .set('Authorization', `Bearer ${respondentToken}`)
      .send({ answers: [] });
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe('MISSING_REQUIRED_QUESTIONS');
    expect(missing.body.error.details.questionIds).toContain(survey.questions[0].id);

    const accepted = await request(app)
      .post(`/api/surveys/${survey.id}/responses`)
      .set('Authorization', `Bearer ${respondentToken}`)
      .send({ answers: [{ questionId: survey.questions[0].id, selectedOptionIds: [survey.questions[0].options[0].id] }] });
    expect(accepted.status).toBe(201);
  });

  it('rejects malformed response bodies before entering the submission service', async () => {
    const survey = await createSurvey(ownerId);
    const submit = jest.spyOn(responseService, 'submitSurveyResponse');
    const response = await request(app)
      .post(`/api/surveys/${survey.id}/responses`)
      .set('Authorization', `Bearer ${respondentToken}`)
      .send({ answers: 'invalid' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_ANSWER');
    expect(response.body.error.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'answers' }),
    ]));
    expect(submit).not.toHaveBeenCalled();
    submit.mockRestore();
  });

  it('STS-F03-07: rejects wrong types, foreign options, duplicate questions, mixed values, and long text', async () => {
    const survey = await createSurvey(ownerId);
    const otherSurvey = await createSurvey(ownerId);
    const singleChoice = survey.questions[0];
    const shortText = survey.questions[1];
    const invalidPayloads = [
      { answers: [{ questionId: singleChoice.id, selectedOptionIds: [otherSurvey.questions[0].options[0].id] }] },
      { answers: [
        { questionId: singleChoice.id, selectedOptionIds: [singleChoice.options[0].id] },
        { questionId: singleChoice.id, selectedOptionIds: [singleChoice.options[1].id] },
      ] },
      { answers: [{ questionId: singleChoice.id, selectedOptionIds: [singleChoice.options[0].id], textValue: 'mixed' }] },
      { answers: [{ questionId: singleChoice.id, textValue: 'wrong type' }] },
      { answers: [{ questionId: shortText.id, selectedOptionIds: [singleChoice.options[0].id] }] },
      { answers: [{ questionId: shortText.id, textValue: 'x'.repeat(2001) }] },
      { answers: [{ questionId: '00000000-0000-4000-a000-000000000099', textValue: 'unknown question' }] },
    ];

    for (const payload of invalidPayloads) {
      const response = await request(app)
        .post(`/api/surveys/${survey.id}/responses`)
        .set('Authorization', `Bearer ${respondentToken}`)
        .send(payload);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_ANSWER');
      expect(response.body.error.details).toEqual(expect.arrayContaining([
        expect.objectContaining({ field: expect.stringMatching(/^answers\./) }),
      ]));
    }
    expect(await prisma.surveyResponse.count({ where: { surveyId: survey.id } })).toBe(0);
    expect(await prisma.responseClaim.count({ where: { surveyId: survey.id } })).toBe(0);
  });

  it('STS-F03-08: denies a different respondent access to a receipt without returning answers', async () => {
    const survey = await createSurvey(ownerId);
    const submitted = await request(app)
      .post(`/api/surveys/${survey.id}/responses`)
      .set('Authorization', `Bearer ${respondentToken}`)
      .send({ answers: [{ questionId: survey.questions[0].id, selectedOptionIds: [survey.questions[0].options[0].id] }] });
    const response = await request(app)
      .get(`/api/surveys/${survey.id}/responses/${submitted.body.data.responseId}`)
      .set('Authorization', `Bearer ${otherRespondentToken}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN_CROSS_RESPONSE_ACCESS');
    expect(response.body.data).toBeUndefined();
    expect(response.body).not.toHaveProperty('answers');
  });

  it('STS-F03-09: rejects owner access to respondent submission endpoints', async () => {
    const survey = await createSurvey(ownerId);
    const response = await request(app)
      .post(`/api/surveys/${survey.id}/responses`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ answers: [] });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN_ROLE');
    expect(await prisma.surveyResponse.count({ where: { surveyId: survey.id } })).toBe(0);
  });

  it('STS-F03-10: retrieves the same persisted receipt and timestamp after another request', async () => {
    const survey = await createSurvey(ownerId);
    const submitted = await request(app)
      .post(`/api/surveys/${survey.id}/responses`)
      .set('Authorization', `Bearer ${respondentToken}`)
      .send({ answers: [
        { questionId: survey.questions[0].id, selectedOptionIds: [survey.questions[0].options[0].id] },
        { questionId: survey.questions[1].id, textValue: 'Persist this receipt.' },
      ] });
    const path = `/api/surveys/${survey.id}/responses/${submitted.body.data.responseId}`;
    const first = await request(app).get(path).set('Authorization', `Bearer ${respondentToken}`);
    const reloaded = await request(app).get(path).set('Authorization', `Bearer ${respondentToken}`);

    expect(first.status).toBe(200);
    expect(reloaded.status).toBe(200);
    expect(reloaded.body.data).toEqual(first.body.data);
    expect(first.body.data.answers).toEqual(expect.arrayContaining([
      expect.objectContaining({ questionId: survey.questions[0].id, selectedOptionIds: [survey.questions[0].options[0].id] }),
      expect.objectContaining({ questionId: survey.questions[1].id, textValue: 'Persist this receipt.' }),
    ]));
  });
});
