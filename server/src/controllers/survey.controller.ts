import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma, QuestionType, SurveyStatus } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { HttpError, NotFoundError } from '../utils/errors';
import { validateSurveyStructure } from '../validators/survey.validator';

const idParamSchema = z.string().uuid();

const questionOptionInputSchema = z.object({
  label: z.string().trim().min(1, 'Option label is required').max(200, 'Option label must be at most 200 characters'),
});

const questionInputSchema = z
  .object({
    prompt: z.string().trim().min(1, 'Question prompt is required').max(500, 'Question prompt must be at most 500 characters'),
    questionType: z.enum([QuestionType.SINGLE_CHOICE, QuestionType.SHORT_TEXT], {
      errorMap: () => ({ message: 'Invalid question type. Sprint 1 supports SINGLE_CHOICE and SHORT_TEXT.' }),
    }),
    isRequired: z.boolean().optional().default(true),
    options: z.array(questionOptionInputSchema).optional().default([]),
  })
  .refine(
    (question) => {
      if (question.questionType === QuestionType.SHORT_TEXT && question.options && question.options.length > 0) {
        return false;
      }
      return true;
    },
    { message: 'Short text questions cannot have options.', path: ['options'] }
  )
  .refine(
    (question) => {
      if (question.questionType === QuestionType.SINGLE_CHOICE && question.options.length > 0) {
        const labels = question.options.map((option) => option.label.trim().toLowerCase());
        return new Set(labels).size === labels.length;
      }
      return true;
    },
    { message: 'Option labels must be unique within each question.', path: ['options'] }
  );

const surveyInputSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(120, 'Title must be at most 120 characters'),
  description: z.string().trim().max(2000, 'Description must be at most 2,000 characters').optional().nullable(),
  questions: z.array(questionInputSchema).optional().default([]),
});

const surveyDetailInclude = {
  questions: {
    orderBy: [{ orderIndex: 'asc' as const }, { id: 'asc' as const }],
    include: {
      options: {
        orderBy: [{ orderIndex: 'asc' as const }, { id: 'asc' as const }],
      },
    },
  },
};

function mapQuestionsToCreate(questions: z.infer<typeof questionInputSchema>[]) {
  return questions.map((question, questionIndex) => ({
    prompt: question.prompt,
    questionType: question.questionType,
    isRequired: question.isRequired,
    orderIndex: questionIndex,
    options: {
      create:
        question.questionType === QuestionType.SINGLE_CHOICE
          ? (question.options || []).map((option, optionIndex) => ({
              label: option.label,
              orderIndex: optionIndex,
            }))
          : [],
    },
  }));
}

function parseSurveyId(paramId: string): string | null {
  const result = idParamSchema.safeParse(paramId);
  return result.success ? result.data : null;
}

async function getAuthorizedSurvey(
  paramId: string,
  ownerId: string,
  includeDetails: true
): Promise<Prisma.SurveyGetPayload<{ include: typeof surveyDetailInclude }>>;
async function getAuthorizedSurvey(
  paramId: string,
  ownerId: string,
  includeDetails?: false
): Promise<{ id: string; ownerId: string; status: SurveyStatus }>;
async function getAuthorizedSurvey(
  paramId: string,
  ownerId: string,
  includeDetails = false
) {
  const surveyId = parseSurveyId(paramId);
  if (!surveyId) {
    throw new NotFoundError('Survey not found.');
  }

  const survey = includeDetails
    ? await prisma.survey.findUnique({
        where: { id: surveyId },
        include: surveyDetailInclude,
      })
    : await prisma.survey.findUnique({
        where: { id: surveyId },
        select: { id: true, ownerId: true, status: true },
      });

  if (!survey) {
    throw new NotFoundError('Survey not found.');
  }

  if (survey.ownerId !== ownerId) {
    throw new HttpError(403, 'FORBIDDEN_OWNERSHIP', 'You do not own this survey.');
  }

  return survey;
}

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

    const data = surveys.map((survey) => ({
      id: survey.id,
      title: survey.title,
      status: survey.status,
      mode: survey.mode,
      questionCount: survey._count.questions,
      responseCount: survey._count.responses,
      createdAt: survey.createdAt.toISOString(),
      updatedAt: survey.updatedAt.toISOString(),
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
          create: mapQuestionsToCreate(questions),
        },
      },
      include: surveyDetailInclude,
    });

    res.status(201).json({ success: true, data: survey });
  } catch (error) {
    next(error);
  }
}

export async function getSurveyById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ownerId = req.auth!.id;
    const survey = await getAuthorizedSurvey(req.params.id, ownerId, true);
    res.status(200).json({ success: true, data: survey });
  } catch (error) {
    next(error);
  }
}

export async function updateSurvey(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ownerId = req.auth!.id;
    const existing = await getAuthorizedSurvey(req.params.id, ownerId);

    if (existing.status !== SurveyStatus.DRAFT) {
      next(new HttpError(400, 'SURVEY_NOT_EDITABLE', 'Only draft surveys can be edited.'));
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

    const { title, description, questions } = parsed.data;

    const updated = await prisma.$transaction(async (tx) => {
      // Cascade delete existing questions and recreate atomically
      await tx.question.deleteMany({ where: { surveyId: existing.id } });

      return tx.survey.update({
        where: { id: existing.id },
        data: {
          title,
          description: description || null,
          questions: {
            create: mapQuestionsToCreate(questions),
          },
        },
        include: surveyDetailInclude,
      });
    });

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
}

export async function deleteSurvey(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ownerId = req.auth!.id;
    const existing = await getAuthorizedSurvey(req.params.id, ownerId);

    if (existing.status !== SurveyStatus.DRAFT) {
      next(new HttpError(400, 'SURVEY_NOT_EDITABLE', 'Only draft surveys can be deleted.'));
      return;
    }

    await prisma.survey.delete({ where: { id: existing.id } });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function publishSurvey(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ownerId = req.auth!.id;
    const existing = await getAuthorizedSurvey(req.params.id, ownerId, true);

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
      where: { id: existing.id },
      data: {
        status: SurveyStatus.PUBLISHED,
        publishedAt: new Date(),
      },
      include: surveyDetailInclude,
    });

    res.status(200).json({ success: true, data: published });
  } catch (error) {
    next(error);
  }
}

export async function closeSurvey(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ownerId = req.auth!.id;
    const existing = await getAuthorizedSurvey(req.params.id, ownerId);

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
      where: { id: existing.id },
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
