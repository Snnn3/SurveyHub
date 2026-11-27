import { QuestionType, SurveyMode } from '@prisma/client';
import { z } from 'zod';

export const FIXED_QUESTION_OPTIONS: Partial<Record<QuestionType, string[]>> = {
  [QuestionType.YES_NO]: ['Yes', 'No'],
  [QuestionType.LIKERT]: [
    'Strongly disagree',
    'Disagree',
    'Neither agree nor disagree',
    'Agree',
    'Strongly agree',
  ],
};

export const questionOptionInputSchema = z
  .object({
    label: z.string().trim().min(1, 'Option label is required').max(200, 'Option label must be at most 200 characters'),
  })
  .strict();

export const questionInputSchema = z
  .object({
    prompt: z.string().trim().min(1, 'Question prompt is required').max(500, 'Question prompt must be at most 500 characters'),
    questionType: z.nativeEnum(QuestionType),
    isRequired: z.boolean().optional().default(true),
    options: z.array(questionOptionInputSchema).optional().default([]),
    minSelections: z.number().int().optional(),
    maxSelections: z.number().int().optional(),
    numberMin: z.number().int().optional(),
    numberMax: z.number().int().optional(),
  })
  .strict()
  .superRefine((question, context) => {
    const isChoice = question.questionType === QuestionType.SINGLE_CHOICE || question.questionType === QuestionType.MULTI_CHOICE;
    if (!isChoice && question.options.length > 0) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['options'], message: `${question.questionType} questions cannot have custom options.` });
    }

    if (isChoice) {
      if (question.options.length > 20) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['options'], message: 'Choice questions cannot have more than 20 options.' });
      }
      const labels = question.options.map((option) => option.label.toLowerCase());
      if (new Set(labels).size !== labels.length) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['options'], message: 'Option labels must be unique within each question.' });
      }
    }

    if (question.questionType === QuestionType.MULTI_CHOICE) {
      const min = question.minSelections;
      const max = question.maxSelections;
      if (min === undefined || max === undefined || min < 1 || max < min || max > question.options.length) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['minSelections'], message: 'Multi-choice bounds must satisfy 1 <= minimum <= maximum <= option count.' });
      }
    } else if (question.minSelections !== undefined || question.maxSelections !== undefined) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['minSelections'], message: 'Selection bounds are only valid for multi-choice questions.' });
    }

    if (question.questionType === QuestionType.INTEGER) {
      if (question.numberMin !== undefined && question.numberMax !== undefined && question.numberMin > question.numberMax) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['numberMin'], message: 'Minimum must be less than or equal to maximum.' });
      }
    } else if (question.numberMin !== undefined || question.numberMax !== undefined) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['numberMin'], message: 'Numeric bounds are only valid for integer questions.' });
    }
  });

export const surveyInputSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(120, 'Title must be at most 120 characters'),
    description: z.string().trim().max(2000, 'Description must be at most 2,000 characters').optional().nullable(),
    mode: z.nativeEnum(SurveyMode).optional(),
    questions: z.array(questionInputSchema).optional().default([]),
  })
  .strict();

export type SurveyInput = z.infer<typeof surveyInputSchema>;

export function parseSurveyInput(body: unknown) {
  const normalized = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  return surveyInputSchema.safeParse(normalized);
}

export interface OptionValidationInput {
  label?: string | null;
}

export interface QuestionValidationInput {
  prompt?: string | null;
  questionType: QuestionType | string;
  isRequired?: boolean;
  options?: OptionValidationInput[] | null;
  minSelections?: number | null;
  maxSelections?: number | null;
  numberMin?: number | null;
  numberMax?: number | null;
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
  | 'INVALID_OPTION_LABEL'
  | 'INVALID_SELECTION_BOUNDS'
  | 'INVALID_NUMBER_BOUNDS'
  | 'INVALID_FIXED_OPTIONS';

export interface SurveyStructureValidationIssue {
  code: SurveyStructureErrorCode;
  message: string;
  questionIndex?: number;
}

export interface SurveyStructureValidationResult {
  isValid: boolean;
  error?: SurveyStructureValidationIssue;
}

function invalidStructure(
  code: SurveyStructureErrorCode,
  message: string,
  questionIndex: number
): SurveyStructureValidationResult {
  return { isValid: false, error: { code, message, questionIndex } };
}

/** Enforces the F-06 question configuration contract before publishing. */
export function validateSurveyStructure(
  survey: SurveyStructureValidationInput
): SurveyStructureValidationResult {
  const questions = survey.questions ?? [];
  if (questions.length === 0) {
    return { isValid: false, error: { code: 'NO_QUESTIONS', message: 'Survey must contain at least one question to be published.' } };
  }

  for (const [index, question] of questions.entries()) {
    const prompt = question.prompt?.trim() ?? '';
    if (!prompt) return invalidStructure('EMPTY_PROMPT', 'Question prompt cannot be empty.', index);
    if (prompt.length > 500) return invalidStructure('PROMPT_TOO_LONG', 'Question prompt must be at most 500 characters.', index);

    const options = question.options ?? [];
    const isChoice = question.questionType === QuestionType.SINGLE_CHOICE || question.questionType === QuestionType.MULTI_CHOICE;
    const fixedOptions = FIXED_QUESTION_OPTIONS[question.questionType as QuestionType];

    if (isChoice) {
      if (options.length < 2) return invalidStructure('TOO_FEW_OPTIONS', 'Choice questions must have at least 2 options.', index);
      if (options.length > 20) return invalidStructure('TOO_MANY_OPTIONS', 'Choice questions must have at most 20 options.', index);
      const labels = options.map((option) => option.label?.trim().toLowerCase() ?? '');
      if (options.some((option) => !option.label?.trim() || option.label.trim().length > 200)) {
        return invalidStructure('INVALID_OPTION_LABEL', 'Option labels must be between 1 and 200 characters.', index);
      }
      if (new Set(labels).size !== labels.length) return invalidStructure('DUPLICATE_OPTIONS', 'Option labels must be unique within each question.', index);
    } else if (fixedOptions) {
      if (options.length !== fixedOptions.length || options.some((option, optionIndex) => option.label !== fixedOptions[optionIndex])) {
        return invalidStructure('INVALID_FIXED_OPTIONS', `${question.questionType} options must use the canonical labels and order.`, index);
      }
    } else if (options.length > 0) {
      return invalidStructure('INVALID_FIXED_OPTIONS', `${question.questionType} questions cannot have options.`, index);
    }

    if (question.questionType === QuestionType.MULTI_CHOICE) {
      const min = question.minSelections;
      const max = question.maxSelections;
      if (!Number.isInteger(min) || !Number.isInteger(max) || min! < 1 || max! < min! || max! > options.length) {
        return invalidStructure('INVALID_SELECTION_BOUNDS', 'Multi-choice bounds must satisfy 1 <= minimum <= maximum <= option count.', index);
      }
    } else if (question.minSelections != null || question.maxSelections != null) {
      return invalidStructure('INVALID_SELECTION_BOUNDS', 'Selection bounds are only valid for multi-choice questions.', index);
    }

    if (question.questionType === QuestionType.INTEGER &&
      ((question.numberMin != null && !Number.isInteger(question.numberMin)) ||
       (question.numberMax != null && !Number.isInteger(question.numberMax)) ||
       (question.numberMin != null && question.numberMax != null && question.numberMin > question.numberMax))) {
      return invalidStructure('INVALID_NUMBER_BOUNDS', 'Integer bounds must be whole numbers and minimum must not exceed maximum.', index);
    }
    if (question.questionType !== QuestionType.INTEGER && (question.numberMin != null || question.numberMax != null)) {
      return invalidStructure('INVALID_NUMBER_BOUNDS', 'Numeric bounds are only valid for integer questions.', index);
    }
  }

  return { isValid: true };
}
