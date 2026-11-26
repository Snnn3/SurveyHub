import { SurveyMode } from '@prisma/client';
import { getSubmissionIdentity } from '../../src/policies/anonymous-response.policy';

describe('F-05 anonymous response policy', () => {
  it('keeps the response identity separate from the duplicate claim in anonymous mode', () => {
    expect(getSubmissionIdentity(SurveyMode.IDENTIFIED, 'user-1')).toEqual({
      respondentId: 'user-1',
      claimUserId: 'user-1',
    });
    expect(getSubmissionIdentity(SurveyMode.ANONYMOUS, 'user-1')).toEqual({
      respondentId: null,
      claimUserId: 'user-1',
    });
  });
});
