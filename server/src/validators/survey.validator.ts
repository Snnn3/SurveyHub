import { QuestionType } from '@prisma/client';
import { z } from 'zod';

export const questionOptionInputSchema = z.object({
  label: z.string().trim().min(1, 'Option label is required').max(200, 'Option label must be at most 200 characters'),
});

export const questionInputSchema = z
  .object({
    prompt: z.string().trim().min(1, 'Question prompt is required').max(500, 'Question prompt must be at most 500 characters'),
    questionType: z.enum([QuestionType.SINGLE_CHOICE, QuestionType.SHORT_TEXT], {
      errorMap: () => ({ message: 'Invalid question type. Sprint 1 supports SINGLE_CHOICE and SHORT_TEXT.' }),
    }),
    isRequired: z.boolean().optional().default(true),
    options: z.array(questionOptionInputSchema).optional().default([]),
  })
  .refine(
    (question) => {
      if (question.questionType === QuestionType.SHORT_TEXT && question.options && question.options.length > 0) {
        return false;
      }
      return true;
    },
    { message: 'Short text questions cannot have options.', path: ['options'] }
  )
  .refine(
    (question) => {
      if (question.questionType === QuestionType.SINGLE_CHOICE && question.options.length > 0) {
        const labels = question.options.map((option) => option.label.trim().toLowerCase());
        return new Set(labels).size === labels.length;
      }
      return true;
    },
    { message: 'Option labels must be unique within each question.', path: ['options'] }
  );

export const surveyInputSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(120, 'Title must be at most 120 characters'),
  description: z.string().trim().max(2000, 'Description must be at most 2,000 characters').optional().nullable(),
  questions: z.array(questionInputSchema).optional().default([]),
});

export type SurveyInput = z.infer<typeof surveyInputSchema>;

export function formatZodDetails(error: z.ZodError): Array<{ field: string; message: string }> {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}

export function parseSurveyInput(body: unknown) {
  const normalized = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  return surveyInputSchema.safeParse(normalized);
}

const idParamSchema = z.string().uuid();

export function parseSurveyId(paramId: string): string | null {
  const result = idParamSchema.safeParse(paramId);
  return result.success ? result.data : null;
}

export interface OptionValidationInput {
  label?: string | null;
}

export interface QuestionValidationInput {
  prompt?: string | null;
  questionType: QuestionType | string;
  isRequired?: boolean;
  options?: OptionValidationInput[] | null;
}

export interface SurveyStructureValidationInput {
  questions?: QuestionValidationInput[] | null;
}

export type SurveyStructureErrorCode =
  | 'NO_QUESTIONS'
  | 'EMPTY_PROMPT'
  | 'PROMPT_TOO_LONG'
  | 'TOO_FEW_OPTIONS'
  | 'TOO_MANY_OPTIONS'
  | 'DUPLICATE_OPTIONS'
  | 'INVALID_OPTION_LABEL';

export interface SurveyStructureValidationIssue {
  code: SurveyStructureErrorCode;
  message: string;
  questionIndex?: number;
}

export interface SurveyStructureValidationResult {
  isValid: boolean;
  error?: SurveyStructureValidationIssue;
}

/**
 * Validates a survey's structure against business rule BR-06 for publishing.
 * Sprint 1 subset:
 * - Must have at least 1 question (STS-U-01).
 * - Every question prompt must be non-empty and <= 500 characters.
 * - Single-choice questions must have between 2 and 20 options (STS-U-02).
 * - Option labels must be non-empty, <= 200 characters, and unique (case-insensitive) per question.
 */
export function validateSurveyStructure(
  survey: SurveyStructureValidationInput
): SurveyStructureValidationResult {
  const questions = survey.questions ?? [];

  if (questions.length === 0) {
    return {
      isValid: false,
      error: {
        code: 'NO_QUESTIONS',
        message: 'Survey must contain at least one question to be published.',
      },
    };
  }

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    const prompt = question.prompt ? question.prompt.trim() : '';

    if (prompt.length === 0) {
      return {
        isValid: false,
        error: {
          code: 'EMPTY_PROMPT',
          message: 'Question prompt cannot be empty.',
          questionIndex: i,
        },
      };
    }

    if (prompt.length > 500) {
      return {
        isValid: false,
        error: {
          code: 'PROMPT_TOO_LONG',
          message: 'Question prompt must be at most 500 characters.',
          questionIndex: i,
        },
      };
    }

    if (question.questionType === QuestionType.SINGLE_CHOICE) {
      const options = question.options ?? [];

      if (options.length < 2) {
        return {
          isValid: false,
          error: {
            code: 'TOO_FEW_OPTIONS',
            message: 'Single-choice questions must have at least 2 options.',
            questionIndex: i,
          },
        };
      }

      if (options.length > 20) {
        return {
          isValid: false,
          error: {
            code: 'TOO_MANY_OPTIONS',
            message: 'Single-choice questions must have at most 20 options.',
            questionIndex: i,
          },
        };
      }

      const labels = options.map((option) => (option.label ? option.label.trim().toLowerCase() : ''));

      // Check empty or exceeding 200 characters limit
      if (
        options.some(
          (option) =>
            !option.label ||
            option.label.trim().length === 0 ||
            option.label.trim().length > 200
        )
      ) {
        return {
          isValid: false,
          error: {
            code: 'INVALID_OPTION_LABEL',
            message: 'Option labels must be between 1 and 200 characters.',
            questionIndex: i,
          },
        };
      }

      if (new Set(labels).size !== labels.length) {
        return {
          isValid: false,
          error: {
            code: 'DUPLICATE_OPTIONS',
            message: 'Option labels must be unique within each question.',
            questionIndex: i,
          },
        };
      }
    }
  }

  return { isValid: true };
}
