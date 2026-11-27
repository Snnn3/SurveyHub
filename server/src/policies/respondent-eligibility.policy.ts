import { Role } from '@prisma/client';

export type EligibilityReason = 'ALLOWED' | 'SURVEY_OWNER' | 'INVALID_ROLE' | 'NOT_ELIGIBLE';

export function evaluateRespondentEligibility(input: {
  respondentId: string;
  respondentRole: Role;
  surveyOwnerId: string;
  eligibleRespondentIds: readonly string[];
}): { allowed: boolean; reason: EligibilityReason } {
  if (input.respondentId === input.surveyOwnerId) return { allowed: false, reason: 'SURVEY_OWNER' };
  if (input.respondentRole !== Role.RESPONDENT) return { allowed: false, reason: 'INVALID_ROLE' };
  if (input.eligibleRespondentIds.length > 0 && !input.eligibleRespondentIds.includes(input.respondentId)) {
    return { allowed: false, reason: 'NOT_ELIGIBLE' };
  }
  return { allowed: true, reason: 'ALLOWED' };
}
