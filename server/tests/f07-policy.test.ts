import { Role, SurveyStatus } from '@prisma/client';
import { evaluateRespondentEligibility } from '../src/policies/respondent-eligibility.policy';
import { isSurveyAcceptingResponses } from '../src/policies/scheduled-close.policy';

describe('F-07 respondent eligibility policy', () => {
  const base = {
    respondentId: 'respondent-1',
    respondentRole: Role.RESPONDENT,
    surveyOwnerId: 'owner-1',
  };

  it('allows any respondent for an empty allowlist', () => {
    expect(evaluateRespondentEligibility({ ...base, eligibleRespondentIds: [] }))
      .toEqual({ allowed: true, reason: 'ALLOWED' });
  });

  it('allows a listed respondent and denies an unlisted respondent', () => {
    expect(evaluateRespondentEligibility({ ...base, eligibleRespondentIds: ['respondent-1'] }))
      .toEqual({ allowed: true, reason: 'ALLOWED' });
    expect(evaluateRespondentEligibility({ ...base, respondentId: 'respondent-2', eligibleRespondentIds: ['respondent-1'] }))
      .toEqual({ allowed: false, reason: 'NOT_ELIGIBLE' });
  });

  it('denies an owner and a non-respondent role', () => {
    expect(evaluateRespondentEligibility({ ...base, respondentId: 'owner-1', eligibleRespondentIds: [] }))
      .toEqual({ allowed: false, reason: 'SURVEY_OWNER' });
    expect(evaluateRespondentEligibility({ ...base, respondentRole: Role.SURVEY_OWNER, eligibleRespondentIds: [] }))
      .toEqual({ allowed: false, reason: 'INVALID_ROLE' });
  });
});

describe('F-07 scheduled-close policy', () => {
  const now = new Date('2026-11-27T10:00:00.000Z');

  it('accepts a published survey with no deadline or before a future deadline', () => {
    expect(isSurveyAcceptingResponses({ status: SurveyStatus.PUBLISHED, closesAt: null, now })).toBe(true);
    expect(isSurveyAcceptingResponses({ status: SurveyStatus.PUBLISHED, closesAt: new Date('2026-11-27T10:00:00.001Z'), now })).toBe(true);
  });

  it('stops exactly at the deadline and after it', () => {
    expect(isSurveyAcceptingResponses({ status: SurveyStatus.PUBLISHED, closesAt: now, now })).toBe(false);
    expect(isSurveyAcceptingResponses({ status: SurveyStatus.PUBLISHED, closesAt: new Date('2026-11-27T09:59:59.999Z'), now })).toBe(false);
  });

  it('does not accept draft or manually closed surveys', () => {
    expect(isSurveyAcceptingResponses({ status: SurveyStatus.DRAFT, closesAt: null, now })).toBe(false);
    expect(isSurveyAcceptingResponses({ status: SurveyStatus.CLOSED, closesAt: null, now })).toBe(false);
  });
});
