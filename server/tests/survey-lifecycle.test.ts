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

describe('F-02 Survey Lifecycle and Authoring (STS-F02-01 to STS-F02-11)', () => {
  let ownerAToken: string;
  let ownerBToken: string;
  let respToken: string;
  let ownerAId: string;
  let ownerBId: string;

  beforeEach(async () => {
    await truncateTestDatabase();
    const users = await prisma.$transaction(seedUsers);
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

    // Either publish won and put got SURVEY_NOT_EDITABLE (400),
    // or put won (200) and publish succeeded (200) on updated structure.
    // In neither case should an inconsistent state exist.
    const statuses = [publishRes.status, putRes.status];
    expect(statuses).toContain(200);

    const dbSurvey = await prisma.survey.findUnique({
      where: { id: survey.id },
      include: { questions: true },
    });

    if (publishRes.status === 200 && putRes.status === 400) {
      expect(putRes.body.error.code).toBe('SURVEY_NOT_EDITABLE');
      expect(dbSurvey?.status).toBe('PUBLISHED');
      expect(dbSurvey?.title).toBe('Race Condition Test');
    } else if (publishRes.status === 200 && putRes.status === 200) {
      expect(dbSurvey?.status).toBe('PUBLISHED');
    }
  });
});
