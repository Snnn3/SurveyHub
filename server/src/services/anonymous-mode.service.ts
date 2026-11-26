import { SurveyMode } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { NotFoundError } from '../utils/errors';

export async function getSurveyMode(surveyId: string): Promise<SurveyMode> {
  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
    select: { mode: true },
  });
  if (!survey) throw new NotFoundError('Survey not found.');
  return survey.mode;
}

export async function getSurveySubmissionState(surveyId: string) {
  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
    select: { mode: true, status: true },
  });
  if (!survey) throw new NotFoundError('Survey not found.');
  return survey;
}

export async function getAnonymousReceipt(surveyId: string, responseId: string) {
  const response = await prisma.surveyResponse.findFirst({
    where: {
      id: responseId,
      surveyId,
      respondentId: null,
      survey: { is: { mode: SurveyMode.ANONYMOUS } },
    },
    select: { id: true, surveyId: true, submittedAt: true },
  });
  if (!response) throw new NotFoundError('Response not found.');

  return {
    responseId: response.id,
    surveyId: response.surveyId,
    submittedAt: response.submittedAt.toISOString(),
    mode: SurveyMode.ANONYMOUS,
    answers: [],
  };
}
