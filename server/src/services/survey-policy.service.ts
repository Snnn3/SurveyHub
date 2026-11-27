import { Role, SurveyStatus } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { HttpError, NotFoundError } from '../utils/errors';
import { getAuthorizedSurvey } from './survey.service';
import { evaluateRespondentEligibility } from '../policies/respondent-eligibility.policy';
import { isSurveyAcceptingResponses } from '../policies/scheduled-close.policy';
import { formatZodDetails } from '../validators/validation';
import { eligibilityInputSchema, scheduleInputSchema } from '../validators/survey-policy.validator';

function assertSurveyPolicyEditable(status: SurveyStatus): void {
  if (status === SurveyStatus.CLOSED) {
    throw new HttpError(400, 'SURVEY_NOT_EDITABLE', 'Manually closed surveys cannot change eligibility or schedule settings.');
  }
}

function invalidPolicyInput(details: unknown): HttpError {
  return new HttpError(400, 'VALIDATION_ERROR', 'Invalid survey policy data.', details);
}

function mapEligibleRespondents(rows: Array<{ user: { id: string; email: string; fullName: string } }>) {
  return rows.map(({ user }) => ({ userId: user.id, email: user.email, fullName: user.fullName }))
    .sort((left, right) => left.email.localeCompare(right.email));
}

function schedulePayload(survey: { id: string; status: SurveyStatus; closesAt: Date | null }, now = new Date()) {
  return {
    surveyId: survey.id,
    status: survey.status,
    closesAt: survey.closesAt?.toISOString() ?? null,
    acceptingResponses: isSurveyAcceptingResponses({ status: survey.status, closesAt: survey.closesAt, now }),
  };
}

export async function getSurveyEligibility(surveyId: string, ownerId: string) {
  const survey = await getAuthorizedSurvey(surveyId, ownerId);
  const eligibleRespondents = await prisma.surveyEligibility.findMany({
    where: { surveyId: survey.id },
    select: { user: { select: { id: true, email: true, fullName: true } } },
  });
  return { surveyId: survey.id, eligibleRespondents: mapEligibleRespondents(eligibleRespondents) };
}

export async function replaceSurveyEligibility(surveyId: string, ownerId: string, body: unknown) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM surveys WHERE id = ${surveyId} FOR UPDATE`;
    const survey = await getAuthorizedSurvey(surveyId, ownerId, false, tx);
    assertSurveyPolicyEditable(survey.status);

    const parsed = eligibilityInputSchema.safeParse(body);
    if (!parsed.success) throw invalidPolicyInput(formatZodDetails(parsed.error));

    const normalizedEmails = parsed.data.respondentEmails.map((email) => email.toLowerCase());
    const users = normalizedEmails.length === 0 ? [] : await tx.user.findMany({
      where: {
        OR: normalizedEmails.map((email) => ({ email: { equals: email, mode: 'insensitive' as const } })),
      },
      select: { id: true, email: true, fullName: true, role: true },
    });
    const userByEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]));
    const selected = normalizedEmails.map((email) => userByEmail.get(email));
    if (selected.some((user) => !user || user.role !== Role.RESPONDENT)) {
      throw new HttpError(400, 'INVALID_ELIGIBILITY', 'One or more respondents are invalid.');
    }

    await tx.surveyEligibility.deleteMany({ where: { surveyId: survey.id } });
    if (selected.length > 0) {
      await tx.surveyEligibility.createMany({
        data: selected.map((user) => ({ surveyId: survey.id, userId: user!.id })),
      });
    }
    const eligibleRespondents = await tx.surveyEligibility.findMany({
      where: { surveyId: survey.id },
      select: { user: { select: { id: true, email: true, fullName: true } } },
    });
    return { surveyId: survey.id, eligibleRespondents: mapEligibleRespondents(eligibleRespondents) };
  });
}

export async function getSurveySchedule(surveyId: string, ownerId: string) {
  const survey = await getAuthorizedSurvey(surveyId, ownerId, false);
  const schedule = await prisma.survey.findUniqueOrThrow({
    where: { id: survey.id },
    select: { id: true, status: true, closesAt: true },
  });
  return schedulePayload(schedule);
}

export async function updateSurveySchedule(surveyId: string, ownerId: string, body: unknown) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM surveys WHERE id = ${surveyId} FOR UPDATE`;
    const existing = await getAuthorizedSurvey(surveyId, ownerId, false, tx);
    assertSurveyPolicyEditable(existing.status);

    const parsed = scheduleInputSchema.safeParse(body);
    if (!parsed.success) throw invalidPolicyInput(formatZodDetails(parsed.error));

    const closesAt = parsed.data.closesAt === null ? null : new Date(parsed.data.closesAt);
    if (closesAt && closesAt.getTime() <= Date.now()) {
      throw invalidPolicyInput([{ field: 'closesAt', message: 'The close time must be in the future.' }]);
    }

    const survey = await tx.survey.update({
      where: { id: existing.id },
      data: { closesAt },
      select: { id: true, status: true, closesAt: true },
    });
    return schedulePayload(survey);
  });
}

export async function assertRespondentCanViewForm(surveyId: string, respondentId: string): Promise<void> {
  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
    select: {
      id: true,
      ownerId: true,
      status: true,
      closesAt: true,
      eligibility: { select: { userId: true } },
    },
  });
  if (!survey) throw new NotFoundError('Survey not found.');

  if (!isSurveyAcceptingResponses({ status: survey.status, closesAt: survey.closesAt, now: new Date() })) {
    throw new HttpError(400, 'SURVEY_NOT_ACCEPTING_RESPONSES', 'This survey is no longer accepting responses.');
  }
  const eligibility = evaluateRespondentEligibility({
    respondentId,
    respondentRole: Role.RESPONDENT,
    surveyOwnerId: survey.ownerId,
    eligibleRespondentIds: survey.eligibility.map(({ userId }) => userId),
  });
  if (!eligibility.allowed) {
    throw new HttpError(403, 'NOT_ELIGIBLE', 'You are not eligible to access this survey.');
  }
}

export async function applyRespondentPolicies<T extends { id: string }>(respondentId: string, activeSurveys: T[]) {
  if (activeSurveys.length === 0) return [];
  const surveys = await prisma.survey.findMany({
    where: { id: { in: activeSurveys.map(({ id }) => id) }, status: SurveyStatus.PUBLISHED },
    select: {
      id: true,
      ownerId: true,
      status: true,
      closesAt: true,
      eligibility: { select: { userId: true } },
    },
  });
  const surveyById = new Map(surveys.map((survey) => [survey.id, survey]));
  const now = new Date();

  return activeSurveys.flatMap((activeSurvey) => {
    const survey = surveyById.get(activeSurvey.id);
    if (!survey) return [];
    const eligibility = evaluateRespondentEligibility({
      respondentId,
      respondentRole: Role.RESPONDENT,
      surveyOwnerId: survey.ownerId,
      eligibleRespondentIds: survey.eligibility.map(({ userId }) => userId),
    });
    if (!eligibility.allowed) return [];
    return [{
      ...activeSurvey,
      closesAt: survey.closesAt?.toISOString() ?? null,
      acceptingResponses: isSurveyAcceptingResponses({ status: survey.status, closesAt: survey.closesAt, now }),
    }];
  });
}
