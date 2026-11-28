import { QuestionType, SurveyStatus } from '@prisma/client';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/utils/prisma';
import { seedUsers } from '../prisma/seed-users';
import { truncateTestDatabase } from './setup';

const password = 'Password123!';

async function loginAs(email: string): Promise<string> {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  return res.body.data.token as string;
}

async function createPublishedMetadataSurvey(ownerId: string) {
  return prisma.survey.create({
    data: {
      title: 'Published metadata fixture',
      description: 'Initial description',
      ownerId,
      status: SurveyStatus.PUBLISHED,
      publishedAt: new Date('2026-11-01T00:00:00.000Z'),
      questions: {
        create: [
          {
            prompt: 'Choose one',
            questionType: QuestionType.SINGLE_CHOICE,
            orderIndex: 0,
            options: {
              create: [
                { label: 'Option A', orderIndex: 0 },
                { label: 'Option B', orderIndex: 1 },
              ],
            },
          },
          {
            prompt: 'Optional comment',
            questionType: QuestionType.SHORT_TEXT,
            isRequired: false,
            orderIndex: 1,
          },
        ],
      },
    },
    include: {
      questions: {
        orderBy: { orderIndex: 'asc' },
        include: { options: { orderBy: { orderIndex: 'asc' } } },
      },
    },
  });
}

async function submitFixtureResponse(
  surveyId: string,
  questionId: string,
  optionId: string,
  respondentToken: string
) {
  return request(app)
    .post(`/api/surveys/${surveyId}/responses`)
    .set('Authorization', `Bearer ${respondentToken}`)
    .send({ answers: [{ questionId, selectedOptionIds: [optionId] }] });
}

async function captureSurveySnapshot(surveyId: string) {
  return prisma.survey.findUnique({
    where: { id: surveyId },
    select: {
      ownerId: true,
      mode: true,
      title: true,
      description: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      publishedAt: true,
      closesAt: true,
      closedAt: true,
      _count: { select: { responses: true } },
      questions: {
        orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          prompt: true,
          questionType: true,
          isRequired: true,
          orderIndex: true,
          options: {
            orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
            select: { id: true, label: true, orderIndex: true },
          },
        },
      },
      responses: {
        orderBy: { submittedAt: 'asc' },
        select: {
          id: true,
          respondentId: true,
          submittedAt: true,
          answers: {
            select: {
              id: true,
              questionId: true,
              textValue: true,
              selectedOptions: {
                orderBy: { id: 'asc' },
                select: { id: true, optionId: true },
              },
            },
          },
        },
      },
    },
  });
}

async function waitForLockWaiters(expectedCount: number) {
  const deadline = Date.now() + 5000;

  while (Date.now() < deadline) {
    const [result] = await prisma.$queryRaw<Array<{ waiters: number }>>`
      SELECT COUNT(*)::int AS waiters
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid()
        AND wait_event_type = 'Lock'
        AND state = 'active'
    `;
    if ((result?.waiters ?? 0) >= expectedCount) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  throw new Error(`Timed out waiting for ${expectedCount} PostgreSQL lock waiter(s).`);
}

async function runRequestsInSurveyLockOrder<TFirst, TSecond>(
  surveyId: string,
  startFirst: () => PromiseLike<TFirst>,
  startSecond: () => PromiseLike<TSecond>
): Promise<[TFirst, TSecond]> {
  let releaseLock!: () => void;
  let signalLocked!: () => void;
  const lockReleased = new Promise<void>((resolve) => { releaseLock = resolve; });
  const rowLocked = new Promise<void>((resolve) => { signalLocked = resolve; });
  const lockHolder = prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM surveys WHERE id = ${surveyId} FOR UPDATE`;
    signalLocked();
    await lockReleased;
  }, { maxWait: 5000, timeout: 15000 });
  const pendingRequests: Promise<unknown>[] = [];

  try {
    await rowLocked;
    const first = Promise.resolve(startFirst());
    pendingRequests.push(first);
    await waitForLockWaiters(1);

    const second = Promise.resolve(startSecond());
    pendingRequests.push(second);
    await waitForLockWaiters(2);

    releaseLock();
    await lockHolder;
    return await Promise.all([first, second]);
  } catch (error) {
    releaseLock();
    await lockHolder;
    await Promise.allSettled(pendingRequests);
    throw error;
  }
}

describe('F-02 Survey Lifecycle and Authoring (STS-F02-01 to STS-F02-11)', () => {
  let ownerAToken: string;
  let ownerBToken: string;
  let respToken: string;
  let ownerAId: string;
  let ownerBId: string;

  beforeEach(async () => {
    await truncateTestDatabase();
    const users = await prisma.$transaction((tx) => seedUsers(tx, password));
    ownerAId = users['owner1@survey.local'].id;
    ownerBId = users['owner2@survey.local'].id;

    ownerAToken = await loginAs('owner1@survey.local');
    ownerBToken = await loginAs('owner2@survey.local');
    respToken = await loginAs('resp1@survey.local');
  });

  it('STS-F02-01: AC-F02-01 GET /api/surveys returns only the authenticated owner surveys with counts', async () => {
    // Owner A creates 2 surveys
    await prisma.survey.create({
      data: {
        title: 'Survey A1',
        ownerId: ownerAId,
        status: SurveyStatus.DRAFT,
        questions: {
          create: [{ prompt: 'Q1', questionType: QuestionType.SHORT_TEXT }],
        },
      },
    });

    await prisma.survey.create({
      data: {
        title: 'Survey A2',
        ownerId: ownerAId,
        status: SurveyStatus.PUBLISHED,
      },
    });

    // Owner B creates 1 survey
    await prisma.survey.create({
      data: {
        title: 'Survey B1',
        ownerId: ownerBId,
        status: SurveyStatus.DRAFT,
      },
    });

    const res = await request(app)
      .get('/api/surveys')
      .set('Authorization', `Bearer ${ownerAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);

    const titles = res.body.data.map((s: { title: string }) => s.title);
    expect(titles).toContain('Survey A1');
    expect(titles).toContain('Survey A2');
    expect(titles).not.toContain('Survey B1');

    const sA1 = res.body.data.find((s: { title: string }) => s.title === 'Survey A1');
    expect(sA1.questionCount).toBe(1);
    expect(sA1.responseCount).toBe(0);
    expect(sA1.status).toBe('DRAFT');
    expect(sA1.createdAt).toBeDefined();
    expect(sA1.updatedAt).toBeDefined();
  });

  it('STS-F02-02: AC-F02-02 POST /api/surveys creates a DRAFT with ordered questions and options', async () => {
    const payload = {
      title: 'CPE 334 Midterm Feedback',
      description: 'Please give honest feedback.',
      questions: [
        {
          prompt: 'How satisfied are you with the course?',
          questionType: 'SINGLE_CHOICE',
          isRequired: true,
          options: [
            { label: 'Very satisfied' },
            { label: 'Neutral' },
            { label: 'Unsatisfied' },
          ],
        },
        {
          prompt: 'What should improve?',
          questionType: 'SHORT_TEXT',
          isRequired: false,
        },
      ],
    };

    const res = await request(app)
      .post('/api/surveys')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe(payload.title);
    expect(res.body.data.description).toBe(payload.description);
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.questions).toHaveLength(2);

    const [q1, q2] = res.body.data.questions;
    expect(q1.prompt).toBe('How satisfied are you with the course?');
    expect(q1.questionType).toBe('SINGLE_CHOICE');
    expect(q1.isRequired).toBe(true);
    expect(q1.orderIndex).toBe(0);
    expect(q1.options).toHaveLength(3);
    expect(q1.options[0].label).toBe('Very satisfied');
    expect(q1.options[0].orderIndex).toBe(0);
    expect(q1.options[1].label).toBe('Neutral');
    expect(q1.options[1].orderIndex).toBe(1);
    expect(q1.options[2].label).toBe('Unsatisfied');
    expect(q1.options[2].orderIndex).toBe(2);

    expect(q2.prompt).toBe('What should improve?');
    expect(q2.questionType).toBe('SHORT_TEXT');
    expect(q2.isRequired).toBe(false);
    expect(q2.orderIndex).toBe(1);

    // Verify in database
    const dbSurvey = await prisma.survey.findUnique({
      where: { id: res.body.data.id },
      include: {
        questions: {
          include: { options: true },
        },
      },
    });
    expect(dbSurvey).not.toBeNull();
    expect(dbSurvey?.questions).toHaveLength(2);
  });

  it('STS-F02-03: AC-F02-03 GET /api/surveys/:id returns the owner full survey detail with ordered items', async () => {
    const survey = await prisma.survey.create({
      data: {
        title: 'Survey Detail Test',
        ownerId: ownerAId,
        status: SurveyStatus.DRAFT,
        questions: {
          create: [
            {
              prompt: 'Question 1',
              questionType: QuestionType.SINGLE_CHOICE,
              orderIndex: 0,
              options: {
                create: [
                  { label: 'Option 1A', orderIndex: 0 },
                  { label: 'Option 1B', orderIndex: 1 },
                ],
              },
            },
            {
              prompt: 'Question 2',
              questionType: QuestionType.SHORT_TEXT,
              orderIndex: 1,
            },
          ],
        },
      },
    });

    const res = await request(app)
      .get(`/api/surveys/${survey.id}`)
      .set('Authorization', `Bearer ${ownerAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(survey.id);
    expect(res.body.data.questions).toHaveLength(2);
    expect(res.body.data.questions[0].prompt).toBe('Question 1');
    expect(res.body.data.questions[0].options).toHaveLength(2);
    expect(res.body.data.questions[1].prompt).toBe('Question 2');
  });

  it('STS-F02-04: AC-F02-04 PUT /api/surveys/:id updates a draft title, description, and replaces questions atomically', async () => {
    const survey = await prisma.survey.create({
      data: {
        title: 'Initial Title',
        ownerId: ownerAId,
        status: SurveyStatus.DRAFT,
        questions: {
          create: [
            {
              prompt: 'Old Question',
              questionType: QuestionType.SHORT_TEXT,
              orderIndex: 0,
            },
          ],
        },
      },
      include: { questions: true },
    });
    const oldQuestionId = survey.questions[0].id;

    const updatePayload = {
      title: 'Updated Title',
      description: 'Updated Description',
      questions: [
        {
          prompt: 'New Question 1',
          questionType: 'SINGLE_CHOICE',
          isRequired: true,
          options: [{ label: 'Yes' }, { label: 'No' }],
        },
      ],
    };

    const res = await request(app)
      .put(`/api/surveys/${survey.id}`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send(updatePayload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Updated Title');
    expect(res.body.data.description).toBe('Updated Description');
    expect(res.body.data.questions).toHaveLength(1);
    expect(res.body.data.questions[0].prompt).toBe('New Question 1');
    expect(res.body.data.questions[0].id).not.toBe(oldQuestionId);

    // Old question was deleted
    const oldQ = await prisma.question.findUnique({ where: { id: oldQuestionId } });
    expect(oldQ).toBeNull();
  });

  it('STS-F02-05: AC-F02-05 DELETE /api/surveys/:id deletes draft and cascades questions and options', async () => {
    const survey = await prisma.survey.create({
      data: {
        title: 'To Be Deleted',
        ownerId: ownerAId,
        status: SurveyStatus.DRAFT,
        questions: {
          create: [
            {
              prompt: 'Q to delete',
              questionType: QuestionType.SINGLE_CHOICE,
              options: {
                create: [{ label: 'Opt 1' }, { label: 'Opt 2' }],
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

    const questionId = survey.questions[0].id;
    const optionIds = survey.questions[0].options.map((o) => o.id);

    const res = await request(app)
      .delete(`/api/surveys/${survey.id}`)
      .set('Authorization', `Bearer ${ownerAToken}`);

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});

    // Survey, question, and options must be gone from DB
    const dbSurvey = await prisma.survey.findUnique({ where: { id: survey.id } });
    expect(dbSurvey).toBeNull();

    const dbQuestion = await prisma.question.findUnique({ where: { id: questionId } });
    expect(dbQuestion).toBeNull();

    const dbOptions = await prisma.option.findMany({ where: { id: { in: optionIds } } });
    expect(dbOptions).toHaveLength(0);
  });

  it('STS-F02-06: AC-F02-06 PATCH /api/surveys/:id/publish publishes a valid draft and sets publishedAt', async () => {
    const survey = await prisma.survey.create({
      data: {
        title: 'Valid Draft',
        ownerId: ownerAId,
        status: SurveyStatus.DRAFT,
        questions: {
          create: [
            {
              prompt: 'Choose one',
              questionType: QuestionType.SINGLE_CHOICE,
              options: {
                create: [{ label: 'Option A' }, { label: 'Option B' }],
              },
            },
          ],
        },
      },
    });

    const res = await request(app)
      .patch(`/api/surveys/${survey.id}/publish`)
      .set('Authorization', `Bearer ${ownerAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('PUBLISHED');
    expect(res.body.data.publishedAt).toBeDefined();

    const dbSurvey = await prisma.survey.findUnique({ where: { id: survey.id } });
    expect(dbSurvey?.status).toBe('PUBLISHED');
    expect(dbSurvey?.publishedAt).not.toBeNull();
  });

  it('STS-F02-07: AC-F02-07 PATCH /api/surveys/:id/publish rejects invalid structure and leaves status DRAFT', async () => {
    // Case 1: Draft with no questions
    const emptySurvey = await prisma.survey.create({
      data: {
        title: 'Empty Survey',
        ownerId: ownerAId,
        status: SurveyStatus.DRAFT,
      },
    });

    const res1 = await request(app)
      .patch(`/api/surveys/${emptySurvey.id}/publish`)
      .set('Authorization', `Bearer ${ownerAToken}`);

    expect(res1.status).toBe(400);
    expect(res1.body.error.code).toBe('INVALID_QUESTION_STRUCTURE');
    expect(Array.isArray(res1.body.error.details)).toBe(true);
    expect(res1.body.error.details[0].field).toBe('questions');

    const dbEmpty = await prisma.survey.findUnique({ where: { id: emptySurvey.id } });
    expect(dbEmpty?.status).toBe('DRAFT');

    // Case 2: Single-choice with only 1 option
    const oneOptSurvey = await prisma.survey.create({
      data: {
        title: 'One Option Survey',
        ownerId: ownerAId,
        status: SurveyStatus.DRAFT,
        questions: {
          create: [
            {
              prompt: 'Only one choice?',
              questionType: QuestionType.SINGLE_CHOICE,
              options: {
                create: [{ label: 'Only One' }],
              },
            },
          ],
        },
      },
    });

    const res2 = await request(app)
      .patch(`/api/surveys/${oneOptSurvey.id}/publish`)
      .set('Authorization', `Bearer ${ownerAToken}`);

    expect(res2.status).toBe(400);
    expect(res2.body.error.code).toBe('INVALID_QUESTION_STRUCTURE');
    expect(Array.isArray(res2.body.error.details)).toBe(true);
    expect(res2.body.error.details[0].field).toBe('questions.0');

    const dbOneOpt = await prisma.survey.findUnique({ where: { id: oneOptSurvey.id } });
    expect(dbOneOpt?.status).toBe('DRAFT');
  });

  it('STS-F02-08: AC-F02-08 PATCH /api/surveys/:id/close closes a published survey and sets closedAt', async () => {
    const survey = await prisma.survey.create({
      data: {
        title: 'Published Survey',
        ownerId: ownerAId,
        status: SurveyStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });

    const res = await request(app)
      .patch(`/api/surveys/${survey.id}/close`)
      .set('Authorization', `Bearer ${ownerAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('CLOSED');
    expect(res.body.data.closedAt).toBeDefined();

    const dbSurvey = await prisma.survey.findUnique({ where: { id: survey.id } });
    expect(dbSurvey?.status).toBe('CLOSED');
    expect(dbSurvey?.closedAt).not.toBeNull();
  });

  it('STS-F02-09: AC-F02-09 Non-owner gets 403 FORBIDDEN_OWNERSHIP for GET, PUT, DELETE, publish, close', async () => {
    const survey = await prisma.survey.create({
      data: {
        title: 'Owner A Private Survey',
        ownerId: ownerAId,
        status: SurveyStatus.DRAFT,
        questions: {
          create: [
            {
              prompt: 'Question 1',
              questionType: QuestionType.SINGLE_CHOICE,
              options: {
                create: [{ label: 'A' }, { label: 'B' }],
              },
            },
          ],
        },
      },
    });

    // Owner B attempts GET
    const getRes = await request(app)
      .get(`/api/surveys/${survey.id}`)
      .set('Authorization', `Bearer ${ownerBToken}`);
    expect(getRes.status).toBe(403);
    expect(getRes.body.error.code).toBe('FORBIDDEN_OWNERSHIP');

    // Owner B attempts PUT with invalid payload (ownership checked before validation)
    const putRes = await request(app)
      .put(`/api/surveys/${survey.id}`)
      .set('Authorization', `Bearer ${ownerBToken}`)
      .send({ title: '', questions: 'invalid' });
    expect(putRes.status).toBe(403);
    expect(putRes.body.error.code).toBe('FORBIDDEN_OWNERSHIP');

    // Owner B attempts DELETE
    const delRes = await request(app)
      .delete(`/api/surveys/${survey.id}`)
      .set('Authorization', `Bearer ${ownerBToken}`);
    expect(delRes.status).toBe(403);
    expect(delRes.body.error.code).toBe('FORBIDDEN_OWNERSHIP');

    // Owner B attempts publish
    const pubRes = await request(app)
      .patch(`/api/surveys/${survey.id}/publish`)
      .set('Authorization', `Bearer ${ownerBToken}`);
    expect(pubRes.status).toBe(403);
    expect(pubRes.body.error.code).toBe('FORBIDDEN_OWNERSHIP');

    // Owner B attempts close
    const closeRes = await request(app)
      .patch(`/api/surveys/${survey.id}/close`)
      .set('Authorization', `Bearer ${ownerBToken}`);
    expect(closeRes.status).toBe(403);
    expect(closeRes.body.error.code).toBe('FORBIDDEN_OWNERSHIP');

    // Database is unchanged
    const dbSurvey = await prisma.survey.findUnique({ where: { id: survey.id } });
    expect(dbSurvey?.title).toBe('Owner A Private Survey');
    expect(dbSurvey?.status).toBe('DRAFT');
  });

  it('STS-F02-10: AC-F02-10 Updating or deleting a published or closed survey returns 400 SURVEY_NOT_EDITABLE', async () => {
    const published = await prisma.survey.create({
      data: {
        title: 'Published Survey',
        ownerId: ownerAId,
        status: SurveyStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });

    const closed = await prisma.survey.create({
      data: {
        title: 'Closed Survey',
        ownerId: ownerAId,
        status: SurveyStatus.CLOSED,
        closedAt: new Date(),
      },
    });

    // PUT published
    const putPub = await request(app)
      .put(`/api/surveys/${published.id}`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ title: 'New Title', questions: [] });
    expect(putPub.status).toBe(400);
    expect(putPub.body.error.code).toBe('SURVEY_NOT_EDITABLE');

    // PUT published with invalid body (DRAFT status checked per Spec F-02 §3.4 before shape validation)
    const putPubInvalid = await request(app)
      .put(`/api/surveys/${published.id}`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ title: '', questions: 'invalid' });
    expect(putPubInvalid.status).toBe(400);
    expect(putPubInvalid.body.error.code).toBe('SURVEY_NOT_EDITABLE');

    // DELETE published
    const delPub = await request(app)
      .delete(`/api/surveys/${published.id}`)
      .set('Authorization', `Bearer ${ownerAToken}`);
    expect(delPub.status).toBe(400);
    expect(delPub.body.error.code).toBe('SURVEY_NOT_EDITABLE');

    // PUT closed
    const putClosed = await request(app)
      .put(`/api/surveys/${closed.id}`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ title: 'New Title', questions: [] });
    expect(putClosed.status).toBe(400);
    expect(putClosed.body.error.code).toBe('SURVEY_NOT_EDITABLE');

    // DELETE closed
    const delClosed = await request(app)
      .delete(`/api/surveys/${closed.id}`)
      .set('Authorization', `Bearer ${ownerAToken}`);
    expect(delClosed.status).toBe(400);
    expect(delClosed.body.error.code).toBe('SURVEY_NOT_EDITABLE');
  });

  it('STS-F02-11: AC-F02-11 Invalid state transitions return 400 INVALID_STATE_TRANSITION', async () => {
    const draft = await prisma.survey.create({
      data: {
        title: 'Draft Survey',
        ownerId: ownerAId,
        status: SurveyStatus.DRAFT,
      },
    });

    const published = await prisma.survey.create({
      data: {
        title: 'Published Survey',
        ownerId: ownerAId,
        status: SurveyStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });

    const closed = await prisma.survey.create({
      data: {
        title: 'Closed Survey',
        ownerId: ownerAId,
        status: SurveyStatus.CLOSED,
        closedAt: new Date(),
      },
    });

    // Publish already published
    const pubPublished = await request(app)
      .patch(`/api/surveys/${published.id}/publish`)
      .set('Authorization', `Bearer ${ownerAToken}`);
    expect(pubPublished.status).toBe(400);
    expect(pubPublished.body.error.code).toBe('INVALID_STATE_TRANSITION');

    // Publish closed
    const pubClosed = await request(app)
      .patch(`/api/surveys/${closed.id}/publish`)
      .set('Authorization', `Bearer ${ownerAToken}`);
    expect(pubClosed.status).toBe(400);
    expect(pubClosed.body.error.code).toBe('INVALID_STATE_TRANSITION');

    // Close draft
    const closeDraft = await request(app)
      .patch(`/api/surveys/${draft.id}/close`)
      .set('Authorization', `Bearer ${ownerAToken}`);
    expect(closeDraft.status).toBe(400);
    expect(closeDraft.body.error.code).toBe('INVALID_STATE_TRANSITION');

    // Close closed
    const closeClosed = await request(app)
      .patch(`/api/surveys/${closed.id}/close`)
      .set('Authorization', `Bearer ${ownerAToken}`);
    expect(closeClosed.status).toBe(400);
    expect(closeClosed.body.error.code).toBe('INVALID_STATE_TRANSITION');
  });

  it('rejects access from respondents with 403 FORBIDDEN_ROLE', async () => {
    const res = await request(app)
      .get('/api/surveys')
      .set('Authorization', `Bearer ${respToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
  });

  it('returns 404 NOT_FOUND for non-existent survey ID or malformed UUID', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app)
      .get(`/api/surveys/${fakeId}`)
      .set('Authorization', `Bearer ${ownerAToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');

    const malformedRes = await request(app)
      .get('/api/surveys/not-a-valid-uuid')
      .set('Authorization', `Bearer ${ownerAToken}`);

    expect(malformedRes.status).toBe(404);
    expect(malformedRes.body.error.code).toBe('NOT_FOUND');
  });

  it('rejects duplicate option labels with 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/surveys')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({
        title: 'Duplicate Option Test',
        questions: [
          {
            prompt: 'Choose one',
            questionType: 'SINGLE_CHOICE',
            options: [{ label: 'Option A' }, { label: 'option a' }],
          },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects Sprint 2 question types with 400 VALIDATION_ERROR in Sprint 1', async () => {
    const res = await request(app)
      .post('/api/surveys')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({
        title: 'Sprint 2 Question Type',
        questions: [
          {
            prompt: 'Rate 1 to 5',
            questionType: 'RATING',
          },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects SHORT_TEXT questions with options with 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/surveys')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({
        title: 'Short Text With Options',
        questions: [
          {
            prompt: 'Explain why',
            questionType: 'SHORT_TEXT',
            options: [{ label: 'Option 1' }],
          },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects SINGLE_CHOICE questions with more than 20 options with 400 VALIDATION_ERROR', async () => {
    const options = Array.from({ length: 21 }, (_, i) => ({ label: `Option ${i + 1}` }));
    const res = await request(app)
      .post('/api/surveys')
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({
        title: 'Too Many Options Survey',
        questions: [
          {
            prompt: 'Choose one of many',
            questionType: 'SINGLE_CHOICE',
            options,
          },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('handles concurrent PUT and PATCH publish requests atomically', async () => {
    const survey = await prisma.survey.create({
      data: {
        title: 'Race Condition Test',
        ownerId: ownerAId,
        status: SurveyStatus.DRAFT,
        questions: {
          create: [
            {
              prompt: 'Original Question',
              questionType: QuestionType.SINGLE_CHOICE,
              options: {
                create: [{ label: 'Option A' }, { label: 'Option B' }],
              },
            },
          ],
        },
      },
    });

    // Fire PUT and PATCH publish simultaneously
    const [publishRes, putRes] = await Promise.all([
      request(app)
        .patch(`/api/surveys/${survey.id}/publish`)
        .set('Authorization', `Bearer ${ownerAToken}`),
      request(app)
        .put(`/api/surveys/${survey.id}`)
        .set('Authorization', `Bearer ${ownerAToken}`)
        .send({
          title: 'Updated During Publish',
          questions: [
            {
              prompt: 'Updated Question',
              questionType: 'SHORT_TEXT',
            },
          ],
        }),
    ]);

    // Under row-level locking, publish must always succeed (200),
    // and PUT must either win first (200) or be rejected once published (400 SURVEY_NOT_EDITABLE).
    expect(publishRes.status).toBe(200);
    expect([200, 400]).toContain(putRes.status);

    const dbSurvey = await prisma.survey.findUnique({
      where: { id: survey.id },
      include: { questions: true },
    });

    expect(dbSurvey?.status).toBe(SurveyStatus.PUBLISHED);

    if (putRes.status === 400) {
      expect(putRes.body.error.code).toBe('SURVEY_NOT_EDITABLE');
      expect(dbSurvey?.title).toBe('Race Condition Test');
      expect(dbSurvey?.questions).toHaveLength(1);
      expect(dbSurvey?.questions[0].prompt).toBe('Original Question');
    } else {
      expect(putRes.status).toBe(200);
      expect(dbSurvey?.title).toBe('Updated During Publish');
      expect(dbSurvey?.questions).toHaveLength(1);
      expect(dbSurvey?.questions[0].prompt).toBe('Updated Question');
    }
  });

  it('STS-LAB7-01: owner edits PUBLISHED metadata at the title limit without changing saved responses', async () => {
    const survey = await prisma.survey.create({
      data: {
        title: 'Initial published title',
        description: 'Initial respondent instructions',
        ownerId: ownerAId,
        status: SurveyStatus.PUBLISHED,
        publishedAt: new Date('2026-11-01T00:00:00.000Z'),
        questions: {
          create: [
            {
              prompt: 'Choose one',
              questionType: QuestionType.SINGLE_CHOICE,
              orderIndex: 0,
              options: {
                create: [
                  { label: 'Option A', orderIndex: 0 },
                  { label: 'Option B', orderIndex: 1 },
                ],
              },
            },
            {
              prompt: 'Optional comment',
              questionType: QuestionType.SHORT_TEXT,
              isRequired: false,
              orderIndex: 1,
            },
          ],
        },
      },
      include: {
        questions: {
          orderBy: { orderIndex: 'asc' },
          include: { options: { orderBy: { orderIndex: 'asc' } } },
        },
      },
    });

    const [choiceQuestion] = survey.questions;
    const submitRes = await request(app)
      .post(`/api/surveys/${survey.id}/responses`)
      .set('Authorization', `Bearer ${respToken}`)
      .send({
        answers: [{
          questionId: choiceQuestion.id,
          selectedOptionIds: [choiceQuestion.options[0].id],
        }],
      });
    expect(submitRes.status).toBe(201);

    const readSnapshot = async () => prisma.survey.findUnique({
      where: { id: survey.id },
      select: {
        ownerId: true,
        mode: true,
        status: true,
        createdAt: true,
        publishedAt: true,
        closesAt: true,
        closedAt: true,
        _count: { select: { responses: true } },
        questions: {
          orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            prompt: true,
            questionType: true,
            isRequired: true,
            orderIndex: true,
            options: {
              orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
              select: { id: true, label: true, orderIndex: true },
            },
          },
        },
        responses: {
          orderBy: { submittedAt: 'asc' },
          select: {
            id: true,
            respondentId: true,
            submittedAt: true,
            answers: {
              select: {
                id: true,
                questionId: true,
                textValue: true,
                selectedOptions: {
                  orderBy: { id: 'asc' },
                  select: { id: true, optionId: true },
                },
              },
            },
          },
        },
      },
    });
    const before = await readSnapshot();

    const updatedTitle = 'T'.repeat(120);
    const paddedDescription = '  Updated respondent instructions  ';
    const updateRes = await request(app)
      .patch(`/api/surveys/${survey.id}/metadata`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ title: updatedTitle, description: paddedDescription });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.title).toBe(updatedTitle);
    expect(updateRes.body.data.description).toBe(paddedDescription);
    expect(await readSnapshot()).toEqual(before);

    const ownerReload = await request(app)
      .get(`/api/surveys/${survey.id}`)
      .set('Authorization', `Bearer ${ownerAToken}`);
    expect(ownerReload.status).toBe(200);
    expect(ownerReload.body.data.title).toBe(updatedTitle);
    expect(ownerReload.body.data.description).toBe(paddedDescription);

    const respondentForm = await request(app)
      .get(`/api/surveys/${survey.id}/form`)
      .set('Authorization', `Bearer ${respToken}`);
    expect(respondentForm.status).toBe(200);
    expect(respondentForm.body.data.title).toBe(updatedTitle);
    expect(respondentForm.body.data.description).toBe(paddedDescription);

    const existingReceipt = await request(app)
      .get(`/api/surveys/${survey.id}/responses/${submitRes.body.data.responseId}`)
      .set('Authorization', `Bearer ${respToken}`);
    expect(existingReceipt.status).toBe(200);
  });

  it('STS-LAB7-02: validates metadata boundaries, preserves padded descriptions, and supports partial updates', async () => {
    const survey = await createPublishedMetadataSurvey(ownerAId);
    const patch = (body: Record<string, unknown>) => request(app)
      .patch(`/api/surveys/${survey.id}/metadata`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send(body);

    const titleOnly = await patch({ title: '  Title only  ' });
    expect(titleOnly.status).toBe(200);
    expect(titleOnly.body.data.title).toBe('Title only');
    expect(titleOnly.body.data.description).toBe('Initial description');

    const paddedDescription = '  Preserve these spaces  ';
    const descriptionOnly = await patch({ description: paddedDescription });
    expect(descriptionOnly.status).toBe(200);
    expect(descriptionOnly.body.data.title).toBe('Title only');
    expect(descriptionOnly.body.data.description).toBe(paddedDescription);

    const exactLimits = await patch({ title: 'T'.repeat(120), description: 'D'.repeat(2000) });
    expect(exactLimits.status).toBe(200);
    expect(exactLimits.body.data.title).toHaveLength(120);
    expect(exactLimits.body.data.description).toHaveLength(2000);

    for (const invalidBody of [
      { title: ' '.repeat(4) },
      { title: 'T'.repeat(121) },
      { description: 'D'.repeat(2001) },
      {},
    ]) {
      const before = await captureSurveySnapshot(survey.id);
      const invalid = await patch(invalidBody);
      expect(invalid.status).toBe(400);
      expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
      expect(await captureSurveySnapshot(survey.id)).toEqual(before);
    }

    for (const clearValue of [null, '']) {
      const cleared = await patch({ description: clearValue });
      expect(cleared.status).toBe(200);
      expect(cleared.body.data.description).toBeNull();
      expect(cleared.body.data.title).toHaveLength(120);
    }
  });

  it('STS-LAB7-03: rejects structural and lifecycle fields atomically', async () => {
    const survey = await createPublishedMetadataSurvey(ownerAId);
    const [choiceQuestion] = survey.questions;
    const submitRes = await submitFixtureResponse(
      survey.id,
      choiceQuestion.id,
      choiceQuestion.options[0].id,
      respToken
    );
    expect(submitRes.status).toBe(201);
    const before = await captureSurveySnapshot(survey.id);

    const forbiddenFields: Array<[string, unknown]> = [
      ['questions', []],
      ['options', []],
      ['mode', 'ANONYMOUS'],
      ['id', '00000000-0000-4000-a000-000000000099'],
      ['ownerId', ownerBId],
      ['status', 'CLOSED'],
      ['createdAt', new Date().toISOString()],
      ['updatedAt', new Date().toISOString()],
      ['publishedAt', new Date().toISOString()],
      ['closesAt', new Date().toISOString()],
      ['closedAt', new Date().toISOString()],
    ];

    for (const [field, value] of forbiddenFields) {
      const invalid = await request(app)
        .patch(`/api/surveys/${survey.id}/metadata`)
        .set('Authorization', `Bearer ${ownerAToken}`)
        .send({ title: 'Must not save', [field]: value });
      expect(invalid.status).toBe(400);
      expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
      expect(await captureSurveySnapshot(survey.id)).toEqual(before);
    }
  });

  it('STS-LAB7-04: enforces owner role and PUBLISHED state for metadata edits', async () => {
    const published = await createPublishedMetadataSurvey(ownerAId);
    const publishedBefore = await captureSurveySnapshot(published.id);

    const otherOwner = await request(app)
      .patch(`/api/surveys/${published.id}/metadata`)
      .set('Authorization', `Bearer ${ownerBToken}`)
      .send({ title: 'Other owner must not save' });
    expect(otherOwner.status).toBe(403);
    expect(otherOwner.body.error.code).toBe('FORBIDDEN_OWNERSHIP');
    expect(await captureSurveySnapshot(published.id)).toEqual(publishedBefore);

    const respondent = await request(app)
      .patch(`/api/surveys/${published.id}/metadata`)
      .set('Authorization', `Bearer ${respToken}`)
      .send({ title: 'Respondent must not save' });
    expect(respondent.status).toBe(403);
    expect(respondent.body.error.code).toBe('FORBIDDEN_ROLE');
    expect(await captureSurveySnapshot(published.id)).toEqual(publishedBefore);

    const draft = await prisma.survey.create({
      data: { title: 'Draft metadata fixture', ownerId: ownerAId, status: SurveyStatus.DRAFT },
    });
    const draftBefore = await captureSurveySnapshot(draft.id);
    const draftPatch = await request(app)
      .patch(`/api/surveys/${draft.id}/metadata`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ title: 'Draft must stay locked for metadata endpoint' });
    expect(draftPatch.status).toBe(400);
    expect(draftPatch.body.error.code).toBe('SURVEY_NOT_EDITABLE');
    expect(await captureSurveySnapshot(draft.id)).toEqual(draftBefore);

    const closeRes = await request(app)
      .patch(`/api/surveys/${published.id}/close`)
      .set('Authorization', `Bearer ${ownerAToken}`);
    expect(closeRes.status).toBe(200);
    const closedBefore = await captureSurveySnapshot(published.id);
    const closedPatch = await request(app)
      .patch(`/api/surveys/${published.id}/metadata`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ title: 'Closed must stay locked' });
    expect(closedPatch.status).toBe(400);
    expect(closedPatch.body.error.code).toBe('SURVEY_NOT_EDITABLE');
    expect(await captureSurveySnapshot(published.id)).toEqual(closedBefore);
  });

  it('STS-LAB7-05a: a close that acquires the row lock first prevents metadata changes', async () => {
    const survey = await createPublishedMetadataSurvey(ownerAId);
    const before = await captureSurveySnapshot(survey.id);
    const [closeRes, metadataRes] = await runRequestsInSurveyLockOrder(
      survey.id,
      () => request(app)
        .patch(`/api/surveys/${survey.id}/close`)
        .set('Authorization', `Bearer ${ownerAToken}`),
      () => request(app)
        .patch(`/api/surveys/${survey.id}/metadata`)
        .set('Authorization', `Bearer ${ownerAToken}`)
        .send({ title: 'Must not save after close' })
    );

    expect(closeRes.status).toBe(200);
    expect(metadataRes.status).toBe(400);
    expect(metadataRes.body.error.code).toBe('SURVEY_NOT_EDITABLE');

    const after = await captureSurveySnapshot(survey.id);
    expect(after?.status).toBe(SurveyStatus.CLOSED);
    expect(after?.closedAt).not.toBeNull();
    expect(after?.title).toBe(before?.title);
    expect(after?.description).toBe(before?.description);
    expect(after?.questions).toEqual(before?.questions);
    expect(after?.responses).toEqual(before?.responses);
    expect(after?._count).toEqual(before?._count);
  }, 15000);

  it('STS-LAB7-05b: a metadata update that acquires the row lock first completes before close', async () => {
    const survey = await createPublishedMetadataSurvey(ownerAId);
    const before = await captureSurveySnapshot(survey.id);
    const [metadataRes, closeRes] = await runRequestsInSurveyLockOrder(
      survey.id,
      () => request(app)
        .patch(`/api/surveys/${survey.id}/metadata`)
        .set('Authorization', `Bearer ${ownerAToken}`)
        .send({ title: 'Updated before close' }),
      () => request(app)
        .patch(`/api/surveys/${survey.id}/close`)
        .set('Authorization', `Bearer ${ownerAToken}`)
    );

    expect(metadataRes.status).toBe(200);
    expect(metadataRes.body.data.title).toBe('Updated before close');
    expect(closeRes.status).toBe(200);
    const after = await captureSurveySnapshot(survey.id);
    expect(after?.status).toBe(SurveyStatus.CLOSED);
    expect(after?.closedAt).not.toBeNull();
    expect(after?.title).toBe('Updated before close');
    expect(after?.description).toBe(before?.description);
    expect(after?.questions).toEqual(before?.questions);
    expect(after?.responses).toEqual(before?.responses);
    expect(after?._count).toEqual(before?._count);
  }, 15000);
});
