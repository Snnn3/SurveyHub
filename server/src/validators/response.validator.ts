import { z } from 'zod';
import { QuestionType } from '@prisma/client';
import { isDatabaseInteger } from '../utils/database-integer';

const responseAnswerSchema = z
  .object({
    questionId: z.string().uuid(),
    selectedOptionIds: z.array(z.string().uuid()).optional(),
    textValue: z.string().optional(),
    numberValue: z.number().finite().optional(),
    dateValue: z.string().optional(),
  })
  .strict();

export const responseInputSchema = z.object({ answers: z.array(responseAnswerSchema) }).strict();

export type ResponseInput = z.infer<typeof responseInputSchema>;

export function parseResponseInput(body: unknown) {
  return responseInputSchema.safeParse(body);
}

export interface AnswerValidationQuestion {
  id: string;
  questionType: QuestionType;
  isRequired: boolean;
  options: Array<{ id: string }>;
  minSelections?: number | null;
  maxSelections?: number | null;
  numberMin?: number | null;
  numberMax?: number | null;
}

export type ValidatedAnswer = {
  questionId: string;
  selectedOptionIds?: string[];
  textValue?: string;
  numberValue?: number;
  dateValue?: string;
};

export type AnswerValidationResult =
  | { valid: true; answers: ValidatedAnswer[] }
  | { valid: false; code: 'INVALID_ANSWER'; field: string; message: string }
  | { valid: false; code: 'MISSING_REQUIRED_QUESTIONS'; questionIds: string[] };

function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= days[month - 1];
}

/** Type-aware F-06 answer validation; kept pure for #72 transaction integration. */
export function validateResponseAnswers(
  questions: AnswerValidationQuestion[],
  answers: ResponseInput['answers']
): AnswerValidationResult {
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const seen = new Set<string>();
  const normalized: ValidatedAnswer[] = [];

  const invalid = (field: string, message: string): AnswerValidationResult => ({
    valid: false,
    code: 'INVALID_ANSWER',
    field,
    message,
  });

  for (const [index, answer] of answers.entries()) {
    const field = `answers.${index}`;
    if (seen.has(answer.questionId)) return invalid(`${field}.questionId`, 'This question was answered more than once.');
    seen.add(answer.questionId);
    const question = questionById.get(answer.questionId);
    if (!question) return invalid(`${field}.questionId`, 'This question is no longer available.');

    const hasText = answer.textValue !== undefined;
    const hasOptions = answer.selectedOptionIds !== undefined;
    const hasNumber = answer.numberValue !== undefined;
    const hasDate = answer.dateValue !== undefined;
    const fields = [hasText, hasOptions, hasNumber, hasDate].filter(Boolean).length;
    if (fields !== 1) return invalid(field, 'Provide exactly one answer value for this question.');

    if (question.questionType === QuestionType.SINGLE_CHOICE || question.questionType === QuestionType.MULTI_CHOICE ||
        question.questionType === QuestionType.YES_NO || question.questionType === QuestionType.LIKERT) {
      if (!hasOptions || !answer.selectedOptionIds?.length) return invalid(`${field}.selectedOptionIds`, 'Select an available option.');
      const ids = answer.selectedOptionIds;
      if (new Set(ids).size !== ids.length || ids.some((id) => !question.options.some((option) => option.id === id))) {
        return invalid(`${field}.selectedOptionIds`, 'Selections must be unique options from this question.');
      }
      if (question.questionType === QuestionType.SINGLE_CHOICE && ids.length !== 1) return invalid(`${field}.selectedOptionIds`, 'Select exactly one option.');
      if (question.questionType === QuestionType.MULTI_CHOICE &&
          (ids.length < (question.minSelections ?? 1) || ids.length > (question.maxSelections ?? question.options.length))) {
        return invalid(`${field}.selectedOptionIds`, 'Select within the allowed number of options.');
      }
      if ((question.questionType === QuestionType.YES_NO || question.questionType === QuestionType.LIKERT) && ids.length !== 1) {
        return invalid(`${field}.selectedOptionIds`, 'Select exactly one option.');
      }
      normalized.push({ questionId: answer.questionId, selectedOptionIds: ids });
      continue;
    }

    if (question.questionType === QuestionType.SHORT_TEXT || question.questionType === QuestionType.LONG_TEXT) {
      if (!hasText) return invalid(`${field}.textValue`, 'Enter text for this question.');
      const text = answer.textValue!.trim();
      const max = question.questionType === QuestionType.SHORT_TEXT ? 2000 : 10000;
      if (text.length > max) return invalid(`${field}.textValue`, `Answer must be at most ${max.toLocaleString('en-US')} characters.`);
      if (text) normalized.push({ questionId: answer.questionId, textValue: text });
      continue;
    }

    if (question.questionType === QuestionType.RATING) {
      if (!hasNumber || !Number.isInteger(answer.numberValue) || answer.numberValue! < 1 || answer.numberValue! > 5) {
        return invalid(`${field}.numberValue`, 'Rating must be a whole number from 1 to 5.');
      }
      normalized.push({ questionId: answer.questionId, numberValue: answer.numberValue });
      continue;
    }

    if (question.questionType === QuestionType.INTEGER) {
      const value = answer.numberValue;
      if (!hasNumber || !isDatabaseInteger(value) ||
          (question.numberMin != null && value! < question.numberMin) ||
          (question.numberMax != null && value! > question.numberMax)) {
        return invalid(`${field}.numberValue`, 'Enter a whole number within the allowed bounds.');
      }
      normalized.push({ questionId: answer.questionId, numberValue: value });
      continue;
    }

    if (question.questionType === QuestionType.DATE) {
      if (!hasDate || !isCalendarDate(answer.dateValue!)) return invalid(`${field}.dateValue`, 'Enter a real calendar date in YYYY-MM-DD format.');
      normalized.push({ questionId: answer.questionId, dateValue: answer.dateValue });
    }
  }

  const questionIds = questions
    .filter((question) => question.isRequired && !normalized.some((answer) => answer.questionId === question.id))
    .map((question) => question.id);
  if (questionIds.length) return { valid: false, code: 'MISSING_REQUIRED_QUESTIONS', questionIds };
  return { valid: true, answers: normalized };
}
