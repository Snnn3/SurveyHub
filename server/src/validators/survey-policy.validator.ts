import { z } from 'zod';

export const eligibilityInputSchema = z.object({
  respondentEmails: z.array(z.string().trim().email()),
}).strict().superRefine(({ respondentEmails }, context) => {
  const seen = new Set<string>();
  respondentEmails.forEach((email, index) => {
    const normalized = email.toLowerCase();
    if (seen.has(normalized)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['respondentEmails', index],
        message: 'Respondent email addresses must be unique.',
      });
    }
    seen.add(normalized);
  });
});

export const scheduleInputSchema = z.object({
  closesAt: z.string().datetime({ offset: true }).nullable(),
}).strict();
