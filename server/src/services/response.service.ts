import { Prisma, QuestionType, SurveyStatus } from '@prisma/client';
import { HttpError, NotFoundError } from '../utils/errors';
import { prisma } from '../utils/prisma';
import type { ResponseInput } from '../validators/response.validator';

function invalidAnswer(): never {
  throw new HttpError(400, 'INVALID_ANSWER', 'One or more submitted answers are invalid.');
}

function assertSurveyAcceptingResponses(status: SurveyStatus): void {
  if (status !== SurveyStatus.PUBLISHED) {
    throw new HttpError(400, 'SURVEY_NOT_ACCEPTING_RESPONSES', 'This survey is no longer accepting responses.');
  }
}

function normalizeAnswers(
  questions: Array<{
    id: string;
    questionType: QuestionType;
    isRequired: boolean;
    options: Array<{ id: string }>;
  }>,
  answers: ResponseInput['answers']
) {
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const seenQuestionIds = new Set<string>();
  const normalized: Array<{ questionId: string; textValue?: string; selectedOptionIds?: string[] }> = [];

  for (const answer of answers) {
    if (seenQuestionIds.has(answer.questionId)) invalidAnswer();
    seenQuestionIds.add(answer.questionId);

    const question = questionById.get(answer.questionId);
    if (!question) invalidAnswer();

    if (question.questionType === QuestionType.SINGLE_CHOICE) {
      const selectedOptionIds = answer.selectedOptionIds;
      if (
        answer.textValue !== undefined ||
        !selectedOptionIds ||
        selectedOptionIds.length !== 1 ||
        !question.options.some((option) => option.id === selectedOptionIds[0])
      ) {
        invalidAnswer();
      }
      normalized.push({ questionId: answer.questionId, selectedOptionIds });
    } else if (question.questionType === QuestionType.SHORT_TEXT) {
      if (answer.selectedOptionIds !== undefined) invalidAnswer();
      const textValue = answer.textValue?.trim();
      if (textValue && textValue.length > 2000) invalidAnswer();
      if (textValue) normalized.push({ questionId: answer.questionId, textValue });
    } else {
      invalidAnswer();
    }
  }

  const missingQuestionIds = questions
    .filter((question) => question.isRequired && !normalized.some((answer) => answer.questionId === question.id))
    .map((question) => question.id);
  if (missingQuestionIds.length > 0) {
    throw new HttpError(
      400,
      'MISSING_REQUIRED_QUESTIONS',
      'Required questions must be answered.',
      { questionIds: missingQuestionIds }
    );
  }

  return normalized;
}

export async function listActiveSurveys(userId: string) {
  const surveys = await prisma.survey.findMany({
    where: { status: SurveyStatus.PUBLISHED },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      _count: { select: { questions: true } },
      claims: { where: { userId }, select: { id: true } },
      responses: { where: { respondentId: userId }, select: { id: true } },
    },
  });

  return surveys.map((survey) => ({
    id: survey.id,
    title: survey.title,
    description: survey.description,
    status: survey.status,
    questionCount: survey._count.questions,
    hasSubmitted: survey.claims.length > 0,
    ...(survey.claims.length > 0 && survey.responses[0]
      ? { responseId: survey.responses[0].id }
      : {}),
  }));
}

export async function getSurveyForm(surveyId: string) {
  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
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
    },
  });

  if (!survey) throw new NotFoundError('Survey not found.');
  assertSurveyAcceptingResponses(survey.status);
  return survey;
}

export async function submitSurveyResponse(surveyId: string, userId: string, input: ResponseInput) {
  return prisma.$transaction(async (tx) => {
    // Match F-02 lifecycle locks so a close cannot race a response submission.
    await tx.$queryRaw`SELECT id FROM surveys WHERE id = ${surveyId} FOR UPDATE`;

    const survey = await tx.survey.findUnique({
      where: { id: surveyId },
      select: {
        id: true,
        status: true,
        questions: {
          select: {
            id: true,
            questionType: true,
            isRequired: true,
            options: { select: { id: true } },
          },
        },
      },
    });
    if (!survey) throw new NotFoundError('Survey not found.');
    assertSurveyAcceptingResponses(survey.status);

    const answers = normalizeAnswers(survey.questions, input.answers);

    try {
      await tx.responseClaim.create({ data: { surveyId, userId } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new HttpError(409, 'DUPLICATE_SUBMISSION', 'You have already submitted a response to this survey.');
      }
      throw error;
    }

    return tx.surveyResponse.create({
      data: {
        surveyId,
        respondentId: userId,
        answers: {
          create: answers.map((answer) => ({
            questionId: answer.questionId,
            ...(answer.textValue !== undefined ? { textValue: answer.textValue } : {}),
            ...(answer.selectedOptionIds
              ? { selectedOptions: { create: answer.selectedOptionIds.map((optionId) => ({ optionId })) } }
              : {}),
          })),
        },
      },
      select: { id: true, surveyId: true, submittedAt: true },
    });
  });
}

export async function getSurveyReceipt(surveyId: string, responseId: string, userId: string) {
  const response = await prisma.surveyResponse.findFirst({
    where: { id: responseId, surveyId },
    select: {
      id: true,
      surveyId: true,
      respondentId: true,
      submittedAt: true,
      answers: {
        select: {
          questionId: true,
          textValue: true,
          question: { select: { prompt: true, questionType: true, orderIndex: true } },
          selectedOptions: { select: { optionId: true, option: { select: { label: true } } } },
        },
      },
    },
  });

  if (!response) throw new NotFoundError('Response not found.');
  if (response.respondentId !== userId) {
    throw new HttpError(403, 'FORBIDDEN_CROSS_RESPONSE_ACCESS', 'You may only view your own response.');
  }

  return {
    responseId: response.id,
    surveyId: response.surveyId,
    submittedAt: response.submittedAt.toISOString(),
    answers: response.answers
      .sort((left, right) => left.question.orderIndex - right.question.orderIndex)
      .map((answer) => ({
        questionId: answer.questionId,
        prompt: answer.question.prompt,
        questionType: answer.question.questionType,
        textValue: answer.textValue,
        selectedOptionIds: answer.selectedOptions.map((option) => option.optionId),
        selectedOptions: answer.selectedOptions.map((option) => option.option.label),
      })),
  };
}
