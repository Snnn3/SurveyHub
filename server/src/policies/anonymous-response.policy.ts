import { SurveyMode } from '@prisma/client';
import { HttpError } from '../utils/errors';

export function getSubmissionIdentity(mode: SurveyMode, userId: string) {
  return {
    respondentId: mode === SurveyMode.IDENTIFIED ? userId : null,
    claimUserId: userId,
  };
}

export function assertAnonymousSubmissionReady(mode: SurveyMode): void {
  if (mode === SurveyMode.ANONYMOUS) {
    throw new HttpError(400, 'ANONYMOUS_MODE_NOT_READY', 'Anonymous responses are not available yet.');
  }
}
