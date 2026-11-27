import { SurveyStatus } from '@prisma/client';

export function isSurveyAcceptingResponses(input: {
  status: SurveyStatus;
  closesAt: Date | null;
  now: Date;
}): boolean {
  return input.status === SurveyStatus.PUBLISHED &&
    (input.closesAt === null || input.now.getTime() < input.closesAt.getTime());
}
