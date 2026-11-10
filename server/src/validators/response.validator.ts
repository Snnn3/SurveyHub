import { z } from 'zod';

const responseAnswerSchema = z
  .object({
    questionId: z.string().uuid(),
    selectedOptionIds: z.array(z.string().uuid()).optional(),
    textValue: z.string().optional(),
  })
  .strict();

export const responseInputSchema = z.object({ answers: z.array(responseAnswerSchema) }).strict();

export type ResponseInput = z.infer<typeof responseInputSchema>;

export function parseResponseInput(body: unknown) {
  return responseInputSchema.safeParse(body);
}
