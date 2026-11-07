import { Prisma, QuestionType, SurveyStatus } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { HttpError, NotFoundError } from '../utils/errors';
import {
  validateSurveyStructure,
  parseSurveyId,
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
  paramId: string,
  ownerId: string,
  includeDetails: true
): Promise<Prisma.SurveyGetPayload<{ include: typeof surveyDetailInclude }>>;
export async function getAuthorizedSurvey(
  paramId: string,
  ownerId: string,
  includeDetails?: false
): Promise<{ id: string; ownerId: string; status: SurveyStatus }>;
export async function getAuthorizedSurvey(
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

export async function assertSurveyEditable(id: string, ownerId: string) {
  const existing = await getAuthorizedSurvey(id, ownerId);
  if (existing.status !== SurveyStatus.DRAFT) {
    throw new HttpError(400, 'SURVEY_NOT_EDITABLE', 'Only draft surveys can be edited.');
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

export async function getSurveyById(id: string, ownerId: string) {
  return getAuthorizedSurvey(id, ownerId, true);
}

export async function updateSurvey(id: string, ownerId: string, input: SurveyInput) {
  const { title, description, questions } = input;

  return prisma.$transaction(async (tx) => {
    // Atomically verify owner and DRAFT status inside transaction per F-02 §3.4
    const existing = await tx.survey.findUnique({
      where: { id },
      select: { id: true, ownerId: true, status: true },
    });

    if (!existing) {
      throw new NotFoundError('Survey not found.');
    }
    if (existing.ownerId !== ownerId) {
      throw new HttpError(403, 'FORBIDDEN_OWNERSHIP', 'You do not own this survey.');
    }
    if (existing.status !== SurveyStatus.DRAFT) {
      throw new HttpError(400, 'SURVEY_NOT_EDITABLE', 'Only draft surveys can be edited.');
    }

    await tx.question.deleteMany({ where: { surveyId: id } });

    return tx.survey.update({
      where: { id },
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

export async function deleteSurvey(id: string, ownerId: string) {
  const existing = await getAuthorizedSurvey(id, ownerId);

  if (existing.status !== SurveyStatus.DRAFT) {
    throw new HttpError(400, 'SURVEY_NOT_EDITABLE', 'Only draft surveys can be deleted.');
  }

  await prisma.survey.delete({ where: { id: existing.id } });
}

export async function publishSurvey(id: string, ownerId: string) {
  const existing = await getAuthorizedSurvey(id, ownerId, true);

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

  return prisma.survey.update({
    where: { id: existing.id },
    data: {
      status: SurveyStatus.PUBLISHED,
      publishedAt: new Date(),
    },
    include: surveyDetailInclude,
  });
}

export async function closeSurvey(id: string, ownerId: string) {
  const existing = await getAuthorizedSurvey(id, ownerId);

  if (existing.status !== SurveyStatus.PUBLISHED) {
    throw new HttpError(400, 'INVALID_STATE_TRANSITION', 'Only published surveys can be closed.');
  }

  return prisma.survey.update({
    where: { id: existing.id },
    data: {
      status: SurveyStatus.CLOSED,
      closedAt: new Date(),
    },
    include: surveyDetailInclude,
  });
}
