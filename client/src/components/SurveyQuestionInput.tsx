interface SurveyQuestionOption {
  id: string;
  label: string;
}

export interface SurveyQuestionInputModel {
  id: string;
  questionType: string;
  isRequired: boolean;
  options: SurveyQuestionOption[];
  minSelections?: number;
  maxSelections?: number;
  numberMin?: number;
  numberMax?: number;
}

interface SurveyQuestionInputProps {
  question: SurveyQuestionInputModel;
  answer: string | string[] | undefined;
  validationError?: string;
  onChange: (value: string | string[]) => void;
}

export function SurveyQuestionInput({ question, answer, validationError, onChange }: SurveyQuestionInputProps) {
  const textAnswer = typeof answer === 'string' ? answer : '';
  const selectedIds = Array.isArray(answer) ? answer : [];
  const choiceQuestion = ['SINGLE_CHOICE', 'YES_NO', 'LIKERT'].includes(question.questionType);
  const textQuestion = question.questionType === 'SHORT_TEXT' || question.questionType === 'LONG_TEXT';

  if (choiceQuestion) {
    return (
      <div className="mt-3 space-y-2">
        {question.options.map((option, index) => (
          <label key={option.id} className="flex items-center gap-3 text-sm text-slate-700">
            <input
              id={index === 0 ? `${question.id}-input` : undefined}
              type="radio"
              name={question.id}
              value={option.id}
              checked={textAnswer === option.id}
              required={question.isRequired}
              aria-invalid={Boolean(validationError)}
              onChange={() => onChange(option.id)}
              className="h-4 w-4 accent-indigo-600"
            />
            {option.label}
          </label>
        ))}
      </div>
    );
  }

  if (question.questionType === 'MULTI_CHOICE') {
    return (
      <div className="mt-3 space-y-2">
        {question.options.map((option, index) => (
          <label key={option.id} className="flex items-center gap-3 text-sm text-slate-700">
            <input
              id={index === 0 ? `${question.id}-input` : undefined}
              type="checkbox"
              value={option.id}
              checked={selectedIds.includes(option.id)}
              aria-invalid={Boolean(validationError)}
              onChange={(event) => onChange(event.target.checked
                ? [...selectedIds, option.id]
                : selectedIds.filter((id) => id !== option.id))}
              className="h-4 w-4 rounded accent-indigo-600"
            />
            {option.label}
          </label>
        ))}
        <p className="text-xs text-slate-500" aria-live="polite">
          {selectedIds.length} selected. Choose {question.minSelections ?? 1}–{question.maxSelections ?? question.options.length} options.
        </p>
      </div>
    );
  }

  if (textQuestion) {
    const maxLength = question.questionType === 'SHORT_TEXT' ? 2000 : 10000;
    const maxLabel = question.questionType === 'SHORT_TEXT' ? '2,000' : '10,000';
    return (
      <div className="mt-3">
        <label htmlFor={`${question.id}-input`} className="mb-1 block text-sm font-medium text-slate-700">
          Your answer
        </label>
        <textarea
          id={`${question.id}-input`}
          value={textAnswer}
          maxLength={maxLength}
          required={question.isRequired}
          aria-invalid={Boolean(validationError)}
          aria-describedby={`${validationError ? `${question.id}-error ` : ''}${question.id}-counter`}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
        <p id={`${question.id}-counter`} className="mt-1 text-right text-xs text-slate-500">
          {textAnswer.length}/{maxLabel}
        </p>
      </div>
    );
  }

  if (question.questionType === 'RATING') {
    return (
      <div className="mt-3 flex gap-3" role="group" aria-label="Rating from 1 to 5">
        {[1, 2, 3, 4, 5].map((rating) => (
          <label key={rating} className="flex items-center gap-1 text-sm text-slate-700">
            <input
              id={rating === 1 ? `${question.id}-input` : undefined}
              type="radio"
              name={question.id}
              checked={textAnswer === String(rating)}
              required={question.isRequired}
              aria-invalid={Boolean(validationError)}
              onChange={() => onChange(String(rating))}
              className="h-4 w-4 accent-indigo-600"
            />
            {rating}
          </label>
        ))}
      </div>
    );
  }

  if (question.questionType === 'INTEGER') {
    return (
      <div className="mt-3">
        <label htmlFor={`${question.id}-input`} className="mb-1 block text-sm font-medium text-slate-700">
          Whole number
        </label>
        <input
          id={`${question.id}-input`}
          type="number"
          step={1}
          min={question.numberMin}
          max={question.numberMax}
          value={textAnswer}
          required={question.isRequired}
          aria-invalid={Boolean(validationError)}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
    );
  }

  return (
    <div className="mt-3">
      <label htmlFor={`${question.id}-input`} className="mb-1 block text-sm font-medium text-slate-700">
        Date
      </label>
      <input
        id={`${question.id}-input`}
        type="date"
        value={textAnswer}
        required={question.isRequired}
        aria-invalid={Boolean(validationError)}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
    </div>
  );
}
