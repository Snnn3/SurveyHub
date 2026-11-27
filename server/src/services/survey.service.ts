import { Prisma, QuestionType, SurveyMode, SurveyStatus } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { HttpError, NotFoundError } from '../utils/errors';
import { parseUuid } from '../utils/uuid';
import { isSurveyAcceptingResponses } from '../policies/scheduled-close.policy';
import { getNumberStats } from '../utils/number-stats';
import {
  FIXED_QUESTION_OPTIONS,
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
  return questions.map((question, questionIndex) => {
    const labels = question.questionType === QuestionType.SINGLE_CHOICE || question.questionType === QuestionType.MULTI_CHOICE
      ? question.options.map((option) => option.label)
      : FIXED_QUESTION_OPTIONS[question.questionType] ?? [];
    return {
      prompt: question.prompt,
      questionType: question.questionType,
      isRequired: question.isRequired,
      orderIndex: questionIndex,
      ...(question.questionType === QuestionType.MULTI_CHOICE
        ? { minSelections: question.minSelections, maxSelections: question.maxSelections }
        : {}),
      ...(question.questionType === QuestionType.INTEGER
        ? { numberMin: question.numberMin, numberMax: question.numberMax }
        : {}),
      options: {
        create: labels.map((label, optionIndex) => ({ label, orderIndex: optionIndex })),
      },
    };
  });
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
      closesAt: true,
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

  const now = new Date();
  return surveys.map((survey) => ({
    id: survey.id,
    title: survey.title,
    status: survey.status,
    mode: survey.mode,
    closesAt: survey.closesAt?.toISOString() ?? null,
    acceptingResponses: isSurveyAcceptingResponses({ status: survey.status, closesAt: survey.closesAt, now }),
    questionCount: survey._count.questions,
    responseCount: survey._count.responses,
    createdAt: survey.createdAt.toISOString(),
    updatedAt: survey.updatedAt.toISOString(),
  }));
}

export async function createSurvey(ownerId: string, input: SurveyInput) {
  const { title, description, mode, questions } = input;

  return prisma.survey.create({
    data: {
      title,
      description: description || null,
      ownerId,
      status: SurveyStatus.DRAFT,
      mode: mode ?? SurveyMode.IDENTIFIED,
      questions: {
        create: mapQuestionsToCreate(questions || []),
      },
    },
    include: surveyDetailInclude,
  });
}

export async function getSurveyById(surveyId: string, ownerId: string) {
  const survey = await getAuthorizedSurvey(surveyId, ownerId, true);
  return {
    ...survey,
    closesAt: survey.closesAt?.toISOString() ?? null,
    acceptingResponses: isSurveyAcceptingResponses({ status: survey.status, closesAt: survey.closesAt, now: new Date() }),
  };
}

export async function getSurveyQuestionSettings(surveyId: string) {
  const questions = await prisma.question.findMany({
    where: { surveyId },
    orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
    select: { id: true, minSelections: true, maxSelections: true, numberMin: true, numberMax: true },
  });
  return new Map(questions.map((question) => [question.id, question]));
}

export async function updateSurvey(surveyId: string, ownerId: string, input: SurveyInput) {
  const { title, description, mode, questions } = input;

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
        ...(mode ? { mode } : {}),
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
              numberValue: true,
              dateValue: true,
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

    if (question.questionType === QuestionType.RATING || question.questionType === QuestionType.INTEGER) {
      const values = question.answers
        .map((answer) => answer.numberValue)
        .filter((value): value is number => value !== null && Number.isInteger(value));
      const numberStats = getNumberStats(values);
      return {
        questionId: question.id,
        prompt: question.prompt,
        questionType: question.questionType,
        answeredCount: numberStats.count,
        numberStats,
        ...(question.questionType === QuestionType.RATING
          ? { ratingDistribution: [1, 2, 3, 4, 5].map((rating) => ({ rating, count: values.filter((value) => value === rating).length })) }
          : {}),
      };
    }

    if (question.questionType === QuestionType.DATE) {
      const dateCounts = new Map<string, number>();
      for (const answer of question.answers) {
        if (!answer.dateValue) continue;
        const date = answer.dateValue.toISOString().slice(0, 10);
        dateCounts.set(date, (dateCounts.get(date) ?? 0) + 1);
      }
      const dates = [...dateCounts].sort(([left], [right]) => left.localeCompare(right));
      return {
        questionId: question.id,
        prompt: question.prompt,
        questionType: question.questionType,
        answeredCount: dates.reduce((sum, [, count]) => sum + count, 0),
        dateCounts: dates.map(([date, count]) => ({ date, count })),
      };
    }

    // Unknown persisted enum values should fail safe without exposing answer data.
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
