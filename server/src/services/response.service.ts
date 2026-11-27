import { Prisma, SurveyMode, SurveyStatus } from '@prisma/client';
import { HttpError, NotFoundError } from '../utils/errors';
import { prisma } from '../utils/prisma';
import { getSubmissionIdentity } from '../policies/anonymous-response.policy';
import { evaluateRespondentEligibility } from '../policies/respondent-eligibility.policy';
import { isSurveyAcceptingResponses } from '../policies/scheduled-close.policy';
import { validateResponseAnswers, type ResponseInput } from '../validators/response.validator';

function throwDuplicateSubmission(): never {
  throw new HttpError(409, 'DUPLICATE_SUBMISSION', 'You have already submitted a response to this survey.');
}

function assertSurveyPublished(status: SurveyStatus): void {
  if (status !== SurveyStatus.PUBLISHED) {
    throw new HttpError(400, 'SURVEY_NOT_ACCEPTING_RESPONSES', 'This survey is no longer accepting responses.');
  }
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
  assertSurveyPublished(survey.status);
  return survey;
}

export async function submitSurveyResponse(surveyId: string, userId: string, input: ResponseInput) {
  return prisma.$transaction(async (tx) => {
    // Match F-02 lifecycle locks so a close cannot race a response submission.
    await tx.$queryRaw`SELECT id FROM surveys WHERE id = ${surveyId} FOR UPDATE`;
    const now = new Date();

    const survey = await tx.survey.findUnique({
      where: { id: surveyId },
      select: {
        id: true,
        ownerId: true,
        status: true,
        mode: true,
        closesAt: true,
        questions: {
          select: {
            id: true,
            questionType: true,
            isRequired: true,
            minSelections: true,
            maxSelections: true,
            numberMin: true,
            numberMax: true,
            options: { select: { id: true } },
          },
        },
        eligibility: { select: { userId: true } },
      },
    });
    if (!survey) throw new NotFoundError('Survey not found.');

    if (!isSurveyAcceptingResponses({ status: survey.status, closesAt: survey.closesAt, now })) {
      throw new HttpError(400, 'SURVEY_NOT_ACCEPTING_RESPONSES', 'This survey is no longer accepting responses.');
    }

    const respondent = await tx.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!respondent) throw new HttpError(401, 'INVALID_TOKEN', 'Authentication token is invalid.');
    const eligibility = evaluateRespondentEligibility({
      respondentId: userId,
      respondentRole: respondent.role,
      surveyOwnerId: survey.ownerId,
      eligibleRespondentIds: survey.eligibility.map(({ userId: eligibleId }) => eligibleId),
    });
    if (!eligibility.allowed) {
      const roleDenied = eligibility.reason === 'INVALID_ROLE';
      throw new HttpError(
        403,
        roleDenied ? 'FORBIDDEN_ROLE' : 'NOT_ELIGIBLE',
        roleDenied ? 'Your role does not allow this operation.' : 'You are not eligible to submit a response to this survey.'
      );
    }

    const validation = validateResponseAnswers(survey.questions, input.answers);
    if (!validation.valid) {
      const details = validation.code === 'INVALID_ANSWER'
        ? [{ field: validation.field, message: validation.message }]
        : { questionIds: validation.questionIds };
      throw new HttpError(
        400,
        validation.code,
        validation.code === 'INVALID_ANSWER'
          ? 'One or more submitted answers are invalid.'
          : 'Required questions must be answered.',
        details
      );
    }

    const identity = getSubmissionIdentity(survey.mode, userId);

    try {
      await tx.responseClaim.create({ data: { surveyId, userId: identity.claimUserId } });
      return await tx.surveyResponse.create({
        data: {
          surveyId,
          respondentId: identity.respondentId,
          answers: {
            create: validation.answers.map((answer) => ({
              questionId: answer.questionId,
              ...(answer.textValue !== undefined ? { textValue: answer.textValue } : {}),
              ...(answer.numberValue !== undefined ? { numberValue: answer.numberValue } : {}),
              ...(answer.dateValue !== undefined
                ? { dateValue: new Date(`${answer.dateValue}T00:00:00.000Z`) }
                : {}),
              ...(answer.selectedOptionIds !== undefined
                ? { selectedOptions: { create: answer.selectedOptionIds.map((optionId) => ({ optionId })) } }
                : {}),
            })),
          },
        },
        select: { id: true, surveyId: true, submittedAt: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throwDuplicateSubmission();
      }
      throw error;
    }
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
          numberValue: true,
          dateValue: true,
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
        ...(answer.numberValue !== null ? { numberValue: answer.numberValue } : {}),
        ...(answer.dateValue !== null ? { dateValue: answer.dateValue.toISOString().slice(0, 10) } : {}),
        selectedOptionIds: answer.selectedOptions.map((option) => option.optionId),
        selectedOptions: answer.selectedOptions.map((option) => option.option.label),
      })),
  };
}
