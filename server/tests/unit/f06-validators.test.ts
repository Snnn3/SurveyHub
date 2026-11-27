import { QuestionType } from '@prisma/client';
import { parseSurveyInput, validateSurveyStructure } from '../../src/validators/survey.validator';
import { parseResponseInput, validateResponseAnswers } from '../../src/validators/response.validator';

const ids = {
  single: '10000000-0000-4000-8000-000000000001', singleA: '20000000-0000-4000-8000-000000000001', singleB: '20000000-0000-4000-8000-000000000002',
  multi: '10000000-0000-4000-8000-000000000002', multiA: '30000000-0000-4000-8000-000000000001', multiB: '30000000-0000-4000-8000-000000000002', multiC: '30000000-0000-4000-8000-000000000003',
  short: '10000000-0000-4000-8000-000000000003', long: '10000000-0000-4000-8000-000000000004',
  yesno: '10000000-0000-4000-8000-000000000005', yes: '40000000-0000-4000-8000-000000000001', no: '40000000-0000-4000-8000-000000000002',
  likert: '10000000-0000-4000-8000-000000000006', rating: '10000000-0000-4000-8000-000000000007',
  integer: '10000000-0000-4000-8000-000000000008', date: '10000000-0000-4000-8000-000000000009',
};

const f06Questions = [
  { id: ids.single, questionType: QuestionType.SINGLE_CHOICE, isRequired: true, options: [{ id: ids.singleA }, { id: ids.singleB }] },
  { id: ids.multi, questionType: QuestionType.MULTI_CHOICE, isRequired: true, options: [{ id: ids.multiA }, { id: ids.multiB }, { id: ids.multiC }], minSelections: 1, maxSelections: 2 },
  { id: ids.short, questionType: QuestionType.SHORT_TEXT, isRequired: true, options: [] },
  { id: ids.long, questionType: QuestionType.LONG_TEXT, isRequired: true, options: [] },
  { id: ids.yesno, questionType: QuestionType.YES_NO, isRequired: true, options: [{ id: ids.yes }, { id: ids.no }] },
  { id: ids.likert, questionType: QuestionType.LIKERT, isRequired: true, options: Array.from({ length: 5 }, (_, index) => ({ id: `50000000-0000-4000-8000-00000000000${index + 1}` })) },
  { id: ids.rating, questionType: QuestionType.RATING, isRequired: true, options: [] },
  { id: ids.integer, questionType: QuestionType.INTEGER, isRequired: true, options: [], numberMin: -2, numberMax: 10 },
  { id: ids.date, questionType: QuestionType.DATE, isRequired: true, options: [] },
];

const answers = [
  { questionId: ids.single, selectedOptionIds: [ids.singleA] },
  { questionId: ids.multi, selectedOptionIds: [ids.multiA, ids.multiC] },
  { questionId: ids.short, textValue: '  short  ' },
  { questionId: ids.long, textValue: '  long  ' },
  { questionId: ids.yesno, selectedOptionIds: [ids.yes] },
  { questionId: ids.likert, selectedOptionIds: ['50000000-0000-4000-8000-000000000004'] },
  { questionId: ids.rating, numberValue: 5 },
  { questionId: ids.integer, numberValue: -2 },
  { questionId: ids.date, dateValue: '2024-02-29' },
];

describe('F-06 validators', () => {
  it('accepts and normalizes valid answers for every question type', () => {
    const parsed = parseResponseInput({ answers });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(validateResponseAnswers(f06Questions, parsed.data.answers)).toEqual({
      valid: true,
      answers: [
        ...answers.slice(0, 2),
        { questionId: ids.short, textValue: 'short' },
        { questionId: ids.long, textValue: 'long' },
        ...answers.slice(4),
      ],
    });
  });

  it.each([
    ['too many multi selections', { questionId: ids.multi, selectedOptionIds: [ids.multiA, ids.multiB, ids.multiC] }],
    ['duplicate selections', { questionId: ids.multi, selectedOptionIds: [ids.multiA, ids.multiA] }],
    ['foreign option', { questionId: ids.single, selectedOptionIds: [ids.multiA] }],
    ['short text overflow', { questionId: ids.short, textValue: 'x'.repeat(2001) }],
    ['long text overflow', { questionId: ids.long, textValue: 'x'.repeat(10001) }],
    ['rating below range', { questionId: ids.rating, numberValue: 0 }],
    ['fractional integer', { questionId: ids.integer, numberValue: 1.5 }],
    ['integer out of range', { questionId: ids.integer, numberValue: 11 }],
    ['invalid leap date', { questionId: ids.date, dateValue: '2025-02-29' }],
    ['timestamp date', { questionId: ids.date, dateValue: '2026-11-20T00:00:00Z' }],
  ])('rejects %s', (_name, answer) => {
    const submitted = answers.map((valid) => valid.questionId === answer.questionId ? answer : valid);
    const parsed = parseResponseInput({ answers: submitted });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const result = validateResponseAnswers(f06Questions, parsed.data.answers);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.code).toBe('INVALID_ANSWER');
  });

  it('returns missing required questions and treats optional blank text as unanswered', () => {
    const result = validateResponseAnswers(f06Questions, answers.filter((answer) => answer.questionId !== ids.long));
    expect(result).toEqual({ valid: false, code: 'MISSING_REQUIRED_QUESTIONS', questionIds: [ids.long] });

    const optionalText = [{ ...f06Questions[2], isRequired: false }];
    expect(validateResponseAnswers(optionalText, [{ questionId: ids.short, textValue: '  ' }])).toEqual({ valid: true, answers: [] });
  });

  it('accepts valid F-06 configuration and rejects invalid selection/numeric bounds', () => {
    const question = {
      prompt: 'Choose up to two', questionType: QuestionType.MULTI_CHOICE,
      options: [{ label: 'A' }, { label: 'B' }, { label: 'C' }], minSelections: 1, maxSelections: 2,
    };
    expect(parseSurveyInput({ title: 'F-06', questions: [question] }).success).toBe(true);
    expect(parseSurveyInput({ title: 'F-06', questions: [{ ...question, minSelections: 0 }] }).success).toBe(false);
    expect(parseSurveyInput({ title: 'F-06', questions: [{ prompt: 'Integer', questionType: QuestionType.INTEGER, numberMin: 3, numberMax: 2 }] }).success).toBe(false);
  });

  it('requires canonical ordered fixed options at publish time', () => {
    expect(validateSurveyStructure({ questions: [{
      prompt: 'Choose yes or no', questionType: QuestionType.YES_NO,
      options: [{ label: 'Yes' }, { label: 'No' }],
    }] }).isValid).toBe(true);
    expect(validateSurveyStructure({ questions: [{
      prompt: 'Choose yes or no', questionType: QuestionType.YES_NO,
      options: [{ label: 'No' }, { label: 'Yes' }],
    }] })).toMatchObject({ isValid: false, error: { code: 'INVALID_FIXED_OPTIONS' } });
  });
});
