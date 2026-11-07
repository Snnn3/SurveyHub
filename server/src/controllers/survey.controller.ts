import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { QuestionType, SurveyStatus } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { HttpError, NotFoundError } from '../utils/errors';
import { validateSurveyStructure } from '../validators/survey.validator';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(id: string): boolean {
  return uuidRegex.test(id);
}

const questionOptionInputSchema = z.object({
  label: z.string().trim().min(1, 'Option label is required').max(200, 'Option label must be at most 200 characters'),
});

const questionInputSchema = z.object({
  prompt: z.string().trim().min(1, 'Question prompt is required').max(500, 'Question prompt must be at most 500 characters'),
  questionType: z.nativeEnum(QuestionType, { errorMap: () => ({ message: 'Invalid question type' }) }),
  isRequired: z.boolean().optional().default(true),
  options: z.array(questionOptionInputSchema).optional().default([]),
});

const surveyInputSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(120, 'Title must be at most 120 characters'),
  description: z.string().trim().max(2000, 'Description must be at most 2,000 characters').optional().nullable(),
  questions: z.array(questionInputSchema).optional().default([]),
});

export async function listOwnerSurveys(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ownerId = req.auth!.id;
    const surveys = await prisma.survey.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
        mode: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            questions: true,
            responses: true,
          },
        },
      },
    });

    const data = surveys.map((s) => ({
      id: s.id,
      title: s.title,
      status: s.status,
      mode: s.mode,
      questionCount: s._count.questions,
      responseCount: s._count.responses,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }));

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function createSurvey(req: Request, res: Response, next: NextFunction): Promise<void> {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const parsed = surveyInputSchema.safeParse(body);

  if (!parsed.success) {
    next(
      new HttpError(
        400,
        'VALIDATION_ERROR',
        'Invalid survey data.',
        parsed.error.flatten().fieldErrors
      )
    );
    return;
  }

  try {
    const ownerId = req.auth!.id;
    const { title, description, questions } = parsed.data;

    const survey = await prisma.survey.create({
      data: {
        title,
        description: description || null,
        ownerId,
        status: SurveyStatus.DRAFT,
        questions: {
          create: questions.map((q, qIndex) => ({
            prompt: q.prompt,
            questionType: q.questionType,
            isRequired: q.isRequired,
            orderIndex: qIndex,
            options: {
              create: (q.options || []).map((opt, optIndex) => ({
                label: opt.label,
                orderIndex: optIndex,
              })),
            },
          })),
        },
      },
      include: {
        questions: {
          orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
          include: {
            options: {
              orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
            },
          },
        },
      },
    });

    res.status(201).json({ success: true, data: survey });
  } catch (error) {
    next(error);
  }
}

export async function getSurveyById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const ownerId = req.auth!.id;

    if (!isValidUUID(id)) {
      next(new NotFoundError('Survey not found.'));
      return;
    }

    const survey = await prisma.survey.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
          include: {
            options: {
              orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
            },
          },
        },
      },
    });

    if (!survey) {
      next(new NotFoundError('Survey not found.'));
      return;
    }

    if (survey.ownerId !== ownerId) {
      next(new HttpError(403, 'FORBIDDEN_OWNERSHIP', 'You do not own this survey.'));
      return;
    }

    res.status(200).json({ success: true, data: survey });
  } catch (error) {
    next(error);
  }
}

export async function updateSurvey(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { id } = req.params;
  const ownerId = req.auth!.id;

  if (!isValidUUID(id)) {
    next(new NotFoundError('Survey not found.'));
    return;
  }

  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const parsed = surveyInputSchema.safeParse(body);

  if (!parsed.success) {
    next(
      new HttpError(
        400,
        'VALIDATION_ERROR',
        'Invalid survey structure.',
        parsed.error.flatten().fieldErrors
      )
    );
    return;
  }

  try {
    const existing = await prisma.survey.findUnique({
      where: { id },
      select: { id: true, ownerId: true, status: true },
    });

    if (!existing) {
      next(new NotFoundError('Survey not found.'));
      return;
    }

    if (existing.ownerId !== ownerId) {
      next(new HttpError(403, 'FORBIDDEN_OWNERSHIP', 'You do not own this survey.'));
      return;
    }

    if (existing.status !== SurveyStatus.DRAFT) {
      next(new HttpError(400, 'SURVEY_NOT_EDITABLE', 'Only draft surveys can be edited.'));
      return;
    }

    const { title, description, questions } = parsed.data;

    const updated = await prisma.$transaction(async (tx) => {
      // Cascade delete existing questions and recreate atomically
      await tx.question.deleteMany({ where: { surveyId: id } });

      return tx.survey.update({
        where: { id },
        data: {
          title,
          description: description || null,
          questions: {
            create: questions.map((q, qIndex) => ({
              prompt: q.prompt,
              questionType: q.questionType,
              isRequired: q.isRequired,
              orderIndex: qIndex,
              options: {
                create: (q.options || []).map((opt, optIndex) => ({
                  label: opt.label,
                  orderIndex: optIndex,
                })),
              },
            })),
          },
        },
        include: {
          questions: {
            orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
            include: {
              options: {
                orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
              },
            },
          },
        },
      });
    });

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
}

export async function deleteSurvey(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const ownerId = req.auth!.id;

    if (!isValidUUID(id)) {
      next(new NotFoundError('Survey not found.'));
      return;
    }

    const existing = await prisma.survey.findUnique({
      where: { id },
      select: { id: true, ownerId: true, status: true },
    });

    if (!existing) {
      next(new NotFoundError('Survey not found.'));
      return;
    }

    if (existing.ownerId !== ownerId) {
      next(new HttpError(403, 'FORBIDDEN_OWNERSHIP', 'You do not own this survey.'));
      return;
    }

    if (existing.status !== SurveyStatus.DRAFT) {
      next(new HttpError(400, 'SURVEY_NOT_EDITABLE', 'Only draft surveys can be deleted.'));
      return;
    }

    await prisma.survey.delete({ where: { id } });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function publishSurvey(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const ownerId = req.auth!.id;

    if (!isValidUUID(id)) {
      next(new NotFoundError('Survey not found.'));
      return;
    }

    const existing = await prisma.survey.findUnique({
      where: { id },
      include: {
        questions: {
          include: {
            options: true,
          },
        },
      },
    });

    if (!existing) {
      next(new NotFoundError('Survey not found.'));
      return;
    }

    if (existing.ownerId !== ownerId) {
      next(new HttpError(403, 'FORBIDDEN_OWNERSHIP', 'You do not own this survey.'));
      return;
    }

    if (existing.status !== SurveyStatus.DRAFT) {
      next(
        new HttpError(
          400,
          'INVALID_STATE_TRANSITION',
          'Only draft surveys can be published.'
        )
      );
      return;
    }

    // Structure Validation per BR-06 & SDS §3.5
    const validation = validateSurveyStructure(existing);
    if (!validation.isValid) {
      next(
        new HttpError(
          400,
          'INVALID_QUESTION_STRUCTURE',
          validation.error?.message || 'Invalid survey structure.',
          validation.error
        )
      );
      return;
    }

    const published = await prisma.survey.update({
      where: { id },
      data: {
        status: SurveyStatus.PUBLISHED,
        publishedAt: new Date(),
      },
      include: {
        questions: {
          orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
          include: {
            options: {
              orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
            },
          },
        },
      },
    });

    res.status(200).json({ success: true, data: published });
  } catch (error) {
    next(error);
  }
}

export async function closeSurvey(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const ownerId = req.auth!.id;

    if (!isValidUUID(id)) {
      next(new NotFoundError('Survey not found.'));
      return;
    }

    const existing = await prisma.survey.findUnique({
      where: { id },
      select: { id: true, ownerId: true, status: true },
    });

    if (!existing) {
      next(new NotFoundError('Survey not found.'));
      return;
    }

    if (existing.ownerId !== ownerId) {
      next(new HttpError(403, 'FORBIDDEN_OWNERSHIP', 'You do not own this survey.'));
      return;
    }

    if (existing.status !== SurveyStatus.PUBLISHED) {
      next(
        new HttpError(
          400,
          'INVALID_STATE_TRANSITION',
          'Only published surveys can be closed.'
        )
      );
      return;
    }

    const closed = await prisma.survey.update({
      where: { id },
      data: {
        status: SurveyStatus.CLOSED,
        closedAt: new Date(),
      },
    });

    res.status(200).json({ success: true, data: closed });
  } catch (error) {
    next(error);
  }
}
