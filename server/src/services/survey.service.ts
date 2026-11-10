import { Prisma, QuestionType, SurveyStatus } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { HttpError, NotFoundError } from '../utils/errors';
import { parseUuid } from '../utils/uuid';
import {
  validateSurveyStructure,
  type SurveyInput,
} from '../validators/survey.validator';

export const surveyDetailInclude = {
  questions: {
    orderBy: [{ orderIndex: 'asc' as const }, { id: 'asc' as const }],
    include: {
      options: {
        orderBy: [{ orderIndex: 'asc' as const }, { id: 'asc' as const }],
      },
    },
  },
};

function mapQuestionsToCreate(questions: NonNullable<SurveyInput['questions']>) {
  return questions.map((question, questionIndex) => ({
    prompt: question.prompt,
    questionType: question.questionType,
    isRequired: question.isRequired ?? true,
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

export async function getAuthorizedSurvey(
  surveyId: string,
  ownerId: string,
  includeDetails: true,
  tx?: Prisma.TransactionClient
): Promise<Prisma.SurveyGetPayload<{ include: typeof surveyDetailInclude }>>;
export async function getAuthorizedSurvey(
  surveyId: string,
  ownerId: string,
  includeDetails?: false,
  tx?: Prisma.TransactionClient
): Promise<{ id: string; ownerId: string; status: SurveyStatus }>;
export async function getAuthorizedSurvey(
  surveyId: string,
  ownerId: string,
  includeDetails = false,
  tx: Prisma.TransactionClient = prisma
) {
  const validId = parseUuid(surveyId);
  if (!validId) {
    throw new NotFoundError('Survey not found.');
  }

  const survey = includeDetails
    ? await tx.survey.findUnique({
        where: { id: validId },
        include: surveyDetailInclude,
      })
    : await tx.survey.findUnique({
        where: { id: validId },
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

export async function assertSurveyEditable(
  surveyId: string,
  ownerId: string,
  tx?: Prisma.TransactionClient,
  customMessage = 'Only draft surveys can be edited.'
) {
  const existing = await getAuthorizedSurvey(surveyId, ownerId, false, tx);
  if (existing.status !== SurveyStatus.DRAFT) {
    throw new HttpError(400, 'SURVEY_NOT_EDITABLE', customMessage);
  }
  return existing;
}

export async function listOwnerSurveys(ownerId: string) {
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

  return surveys.map((survey) => ({
    id: survey.id,
    title: survey.title,
    status: survey.status,
    mode: survey.mode,
    questionCount: survey._count.questions,
    responseCount: survey._count.responses,
    createdAt: survey.createdAt.toISOString(),
    updatedAt: survey.updatedAt.toISOString(),
  }));
}

export async function createSurvey(ownerId: string, input: SurveyInput) {
  const { title, description, questions } = input;

  return prisma.survey.create({
    data: {
      title,
      description: description || null,
      ownerId,
      status: SurveyStatus.DRAFT,
      questions: {
        create: mapQuestionsToCreate(questions || []),
      },
    },
    include: surveyDetailInclude,
  });
}

export async function getSurveyById(surveyId: string, ownerId: string) {
  return getAuthorizedSurvey(surveyId, ownerId, true);
}

export async function updateSurvey(surveyId: string, ownerId: string, input: SurveyInput) {
  const { title, description, questions } = input;

  return prisma.$transaction(async (tx) => {
    // Acquire row-level exclusive lock to serialize lifecycle operations and prevent concurrent state bypass
    await tx.$queryRaw`SELECT id FROM surveys WHERE id = ${surveyId} FOR UPDATE`;

    // Atomically verify owner and DRAFT status inside transaction per SDS §1.3 & F-02 §3.4
    const existing = await assertSurveyEditable(surveyId, ownerId, tx);

    await tx.question.deleteMany({ where: { surveyId: existing.id } });

    return tx.survey.update({
      where: { id: existing.id },
      data: {
        title,
        description: description || null,
        questions: {
          create: mapQuestionsToCreate(questions || []),
        },
      },
      include: surveyDetailInclude,
    });
  });
}

export async function deleteSurvey(surveyId: string, ownerId: string) {
  return prisma.$transaction(async (tx) => {
    // Acquire row-level exclusive lock to serialize lifecycle operations
    await tx.$queryRaw`SELECT id FROM surveys WHERE id = ${surveyId} FOR UPDATE`;

    const existing = await assertSurveyEditable(
      surveyId,
      ownerId,
      tx,
      'Only draft surveys can be deleted.'
    );
    await tx.survey.delete({ where: { id: existing.id } });
  });
}

export async function publishSurvey(surveyId: string, ownerId: string) {
  return prisma.$transaction(async (tx) => {
    // Acquire row-level exclusive lock to serialize lifecycle operations
    await tx.$queryRaw`SELECT id FROM surveys WHERE id = ${surveyId} FOR UPDATE`;

    const existing = await getAuthorizedSurvey(surveyId, ownerId, true, tx);
    if (existing.status !== SurveyStatus.DRAFT) {
      throw new HttpError(400, 'INVALID_STATE_TRANSITION', 'Only draft surveys can be published.');
    }

    const validation = validateSurveyStructure(existing);
    if (!validation.isValid) {
      const details = validation.error
        ? [
            {
              field:
                validation.error.questionIndex !== undefined
                  ? `questions.${validation.error.questionIndex}`
                  : 'questions',
              message: validation.error.message,
              code: validation.error.code,
            },
          ]
        : undefined;

      throw new HttpError(
        400,
        'INVALID_QUESTION_STRUCTURE',
        validation.error?.message || 'Invalid survey structure.',
        details
      );
    }

    return tx.survey.update({
      where: { id: existing.id },
      data: {
        status: SurveyStatus.PUBLISHED,
        publishedAt: new Date(),
      },
      include: surveyDetailInclude,
    });
  });
}

export async function closeSurvey(surveyId: string, ownerId: string) {
  return prisma.$transaction(async (tx) => {
    // Acquire row-level exclusive lock to serialize lifecycle operations
    await tx.$queryRaw`SELECT id FROM surveys WHERE id = ${surveyId} FOR UPDATE`;

    const existing = await getAuthorizedSurvey(surveyId, ownerId, false, tx);
    if (existing.status !== SurveyStatus.PUBLISHED) {
      throw new HttpError(400, 'INVALID_STATE_TRANSITION', 'Only published surveys can be closed.');
    }

    return tx.survey.update({
      where: { id: existing.id },
      data: {
        status: SurveyStatus.CLOSED,
        closedAt: new Date(),
      },
      include: surveyDetailInclude,
    });
  });
}

export async function getSurveySummary(surveyId: string, ownerId: string) {
  // Authorize owner before querying nested answer data per review feedback
  const authorized = await getAuthorizedSurvey(surveyId, ownerId, false);

  const survey = await prisma.survey.findUniqueOrThrow({
    where: { id: authorized.id },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      mode: true,
      createdAt: true,
      _count: {
        select: { responses: true },
      },
      questions: {
        orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          prompt: true,
          questionType: true,
          options: {
            orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
            select: {
              id: true,
              label: true,
            },
          },
          answers: {
            select: {
              textValue: true,
              selectedOptions: {
                select: { optionId: true },
              },
            },
          },
        },
      },
    },
  });

  const questions = survey.questions.map((question) => {
    const isText =
      question.questionType === QuestionType.SHORT_TEXT ||
      question.questionType === QuestionType.LONG_TEXT;
    const isChoice =
      question.questionType === QuestionType.SINGLE_CHOICE ||
      question.questionType === QuestionType.MULTI_CHOICE ||
      question.questionType === QuestionType.YES_NO ||
      question.questionType === QuestionType.LIKERT;

    if (isText) {
      const validAnswers = question.answers.filter(
        (answer) => typeof answer.textValue === 'string' && answer.textValue.trim().length > 0
      );
      return {
        questionId: question.id,
        prompt: question.prompt,
        questionType: question.questionType,
        answeredCount: validAnswers.length,
        textAnswers: validAnswers.map((answer) => answer.textValue!),
      };
    }

    if (isChoice) {
      const validAnswers = question.answers.filter((answer) => answer.selectedOptions.length > 0);
      const answeredCount = validAnswers.length;

      const options = question.options.map((option) => {
        const count = validAnswers.filter((answer) =>
          answer.selectedOptions.some((selectedOption) => selectedOption.optionId === option.id)
        ).length;
        const percentage = answeredCount > 0 ? Number(((count / answeredCount) * 100).toFixed(2)) : 0;
        return {
          optionId: option.id,
          label: option.label,
          count,
          percentage,
        };
      });

      return {
        questionId: question.id,
        prompt: question.prompt,
        questionType: question.questionType,
        answeredCount,
        options,
      };
    }

    // Sprint 2 question types (RATING, INTEGER, DATE)
    return {
      questionId: question.id,
      prompt: question.prompt,
      questionType: question.questionType,
      answeredCount: 0,
    };
  });

  return {
    surveyId: survey.id,
    title: survey.title,
    description: survey.description,
    status: survey.status,
    mode: survey.mode,
    totalResponses: survey._count.responses,
    createdAt: survey.createdAt,
    questions,
  };
}
