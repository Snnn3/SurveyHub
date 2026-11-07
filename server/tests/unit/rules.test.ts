import { QuestionType } from '@prisma/client';
import { validateSurveyStructure } from '../../src/validators/survey.validator';

describe('Sprint 1 Supporting Unit Tests - Rules (STS-U-01, STS-U-02)', () => {
  it('STS-U-01: rejects a draft with zero questions with code NO_QUESTIONS', () => {
    const result = validateSurveyStructure({ questions: [] });
    expect(result.isValid).toBe(false);
    expect(result.error?.code).toBe('NO_QUESTIONS');
  });

  it('STS-U-02: rejects a single-choice question with fewer than two options with code TOO_FEW_OPTIONS', () => {
    const result = validateSurveyStructure({
      questions: [
        {
          prompt: 'Which track do you prefer?',
          questionType: QuestionType.SINGLE_CHOICE,
          options: [{ label: 'Track A' }],
        },
      ],
    });
    expect(result.isValid).toBe(false);
    expect(result.error?.code).toBe('TOO_FEW_OPTIONS');
  });

  it('rejects single-choice options with empty or over 200 character labels with code INVALID_OPTION_LABEL', () => {
    const longLabel = 'A'.repeat(201);
    const result = validateSurveyStructure({
      questions: [
        {
          prompt: 'Which track do you prefer?',
          questionType: QuestionType.SINGLE_CHOICE,
          options: [{ label: 'Track A' }, { label: longLabel }],
        },
      ],
    });
    expect(result.isValid).toBe(false);
    expect(result.error?.code).toBe('INVALID_OPTION_LABEL');
  });

  it('rejects an empty question prompt with code EMPTY_PROMPT', () => {
    const result = validateSurveyStructure({
      questions: [
        {
          prompt: '   ',
          questionType: QuestionType.SHORT_TEXT,
        },
      ],
    });
    expect(result.isValid).toBe(false);
    expect(result.error?.code).toBe('EMPTY_PROMPT');
    expect(result.error?.questionIndex).toBe(0);
  });

  it('rejects a question prompt exceeding 500 characters with code PROMPT_TOO_LONG', () => {
    const result = validateSurveyStructure({
      questions: [
        {
          prompt: 'P'.repeat(501),
          questionType: QuestionType.SHORT_TEXT,
        },
      ],
    });
    expect(result.isValid).toBe(false);
    expect(result.error?.code).toBe('PROMPT_TOO_LONG');
    expect(result.error?.questionIndex).toBe(0);
  });

  it('rejects a single-choice question with more than 20 options with code TOO_MANY_OPTIONS', () => {
    const options = Array.from({ length: 21 }, (_, i) => ({ label: `Option ${i + 1}` }));
    const result = validateSurveyStructure({
      questions: [
        {
          prompt: 'Which option?',
          questionType: QuestionType.SINGLE_CHOICE,
          options,
        },
      ],
    });
    expect(result.isValid).toBe(false);
    expect(result.error?.code).toBe('TOO_MANY_OPTIONS');
    expect(result.error?.questionIndex).toBe(0);
  });

  it('rejects single-choice duplicate option labels with code DUPLICATE_OPTIONS', () => {
    const result = validateSurveyStructure({
      questions: [
        {
          prompt: 'Which track do you prefer?',
          questionType: QuestionType.SINGLE_CHOICE,
          options: [{ label: 'Track A' }, { label: 'track a' }],
        },
      ],
    });
    expect(result.isValid).toBe(false);
    expect(result.error?.code).toBe('DUPLICATE_OPTIONS');
    expect(result.error?.questionIndex).toBe(0);
  });

  it('accepts a valid draft structure with single-choice and short-text questions', () => {
    const result = validateSurveyStructure({
      questions: [
        {
          prompt: 'Which track do you prefer?',
          questionType: QuestionType.SINGLE_CHOICE,
          options: [{ label: 'Track A' }, { label: 'Track B' }],
        },
        {
          prompt: 'Any additional feedback?',
          questionType: QuestionType.SHORT_TEXT,
        },
      ],
    });
    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
  });
});
