import axios from 'axios';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { getApiErrorMessage } from '../api';
import type { SurveyMode } from '../types/survey';

interface SurveyQuestion {
  id: string;
  prompt: string;
  questionType: string;
  isRequired: boolean;
  orderIndex: number;
  minSelections?: number;
  maxSelections?: number;
  numberMin?: number;
  numberMax?: number;
  options: Array<{ id: string; label: string; orderIndex: number }>;
}

interface SurveyForm {
  id: string;
  title: string;
  description: string | null;
  mode: SurveyMode;
  questions: SurveyQuestion[];
}

interface SurveyReceipt {
  responseId: string;
  surveyId: string;
  submittedAt: string;
  mode?: SurveyMode;
  answers: Array<{
    questionId: string;
    prompt: string;
    textValue: string | null;
    numberValue?: number | null;
    dateValue?: string | null;
    selectedOptions: string[];
  }>;
}

interface ApiErrorBody {
  error?: {
    code?: string;
    details?: { questionIds?: string[] } | Array<{ field: string; message: string }>;
  };
}

function supportsQuestionType(questionType: string): boolean {
  return ['SINGLE_CHOICE', 'MULTI_CHOICE', 'SHORT_TEXT', 'LONG_TEXT', 'YES_NO', 'LIKERT', 'RATING', 'INTEGER', 'DATE'].includes(questionType);
}

function hasAnswer(value: string | string[] | undefined): boolean {
  return Array.isArray(value) ? value.length > 0 : Boolean(value?.trim());
}

export function SurveyTakePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [survey, setSurvey] = useState<SurveyForm | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [missingIds, setMissingIds] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateAnswer(questionId: string, value: string | string[]) {
    setError(null);
    setAnswers((current) => ({ ...current, [questionId]: value }));
    setMissingIds((current) => current.filter((missingId) => missingId !== questionId));
    setFieldErrors((current) => {
      if (!current[questionId]) return current;
      const next = { ...current };
      delete next[questionId];
      return next;
    });
  }

  useEffect(() => {
    api.get<{ data: SurveyForm }>(`/surveys/${id}/form`)
      .then((response) => setSurvey(response.data.data))
      .catch((err: unknown) => setError(getApiErrorMessage(err, 'Failed to load this survey.')))
      .finally(() => setLoading(false));
  }, [id]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!survey) return;
    setError(null);
    setFieldErrors({});
    const missing = survey.questions
      .filter((question) => question.isRequired && !hasAnswer(answers[question.id]))
      .map((question) => question.id);
    setMissingIds(missing);
    if (missing.length) {
      setError('Please complete all required questions.');
      document.getElementById(`${missing[0]}-input`)?.focus();
      return;
    }

    const localErrors: Record<string, string> = {};
    for (const question of survey.questions) {
      const value = answers[question.id];
      if (!hasAnswer(value)) continue;
      if (question.questionType === 'MULTI_CHOICE' && Array.isArray(value) &&
          (value.length < (question.minSelections ?? 1) || value.length > (question.maxSelections ?? question.options.length))) {
        localErrors[question.id] = 'Select within the allowed number of options.';
      }
      if (question.questionType === 'INTEGER' && typeof value === 'string') {
        const number = Number(value);
        if (!Number.isInteger(number) || (question.numberMin != null && number < question.numberMin) || (question.numberMax != null && number > question.numberMax)) {
          localErrors[question.id] = 'Enter a whole number within the allowed bounds.';
        }
      }
    }
    if (Object.keys(localErrors).length) {
      setFieldErrors(localErrors);
      setError('Please correct the highlighted answers.');
      document.getElementById(`${Object.keys(localErrors)[0]}-input`)?.focus();
      return;
    }

    const payload: Array<{ questionId: string; selectedOptionIds?: string[]; textValue?: string; numberValue?: number; dateValue?: string }> = [];
    for (const question of survey.questions) {
      const value = answers[question.id];
      if (!hasAnswer(value)) continue;
      if (['SINGLE_CHOICE', 'YES_NO', 'LIKERT'].includes(question.questionType) && typeof value === 'string') {
        payload.push({ questionId: question.id, selectedOptionIds: [value] });
      } else if (question.questionType === 'MULTI_CHOICE' && Array.isArray(value)) {
        payload.push({ questionId: question.id, selectedOptionIds: value });
      } else if (['SHORT_TEXT', 'LONG_TEXT'].includes(question.questionType) && typeof value === 'string') {
        payload.push({ questionId: question.id, textValue: value.trim() });
      } else if (['RATING', 'INTEGER'].includes(question.questionType) && typeof value === 'string') {
        payload.push({ questionId: question.id, numberValue: Number(value) });
      } else if (question.questionType === 'DATE' && typeof value === 'string') {
        payload.push({ questionId: question.id, dateValue: value });
      }
    }

    setPending(true);
    try {
      const response = await api.post<{ data: { responseId: string } }>(`/surveys/${id}/responses`, { answers: payload });
      navigate(`/surveys/${id}/confirmation/${response.data.data.responseId}`);
    } catch (err: unknown) {
      const apiError = axios.isAxiosError<ApiErrorBody>(err) ? err.response?.data.error : undefined;
      if (apiError?.code === 'DUPLICATE_SUBMISSION') {
        setError('You have already submitted a response to this survey.');
      } else if (apiError?.code === 'SURVEY_NOT_ACCEPTING_RESPONSES') {
        setError('This survey is no longer accepting responses.');
      } else if (apiError?.code === 'MISSING_REQUIRED_QUESTIONS') {
        const questionIds = Array.isArray(apiError.details) ? [] : apiError.details?.questionIds || [];
        setMissingIds(questionIds);
        setError('Please complete all required questions.');
        document.getElementById(`${questionIds[0]}-input`)?.focus();
      } else if (apiError?.code === 'INVALID_ANSWER' && Array.isArray(apiError.details)) {
        const errors: Record<string, string> = {};
        for (const detail of apiError.details) {
          const answerIndex = detail.field.match(/^answers\.(\d+)(?:\.|$)/)?.[1];
          const questionId = answerIndex === undefined ? undefined : payload[Number(answerIndex)]?.questionId;
          if (questionId) errors[questionId] = detail.message;
        }
        if (Object.keys(errors).length) {
          setFieldErrors(errors);
          setMissingIds([]);
          setError('Please correct the highlighted answers.');
          document.getElementById(`${Object.keys(errors)[0]}-input`)?.focus();
        } else {
          setError(getApiErrorMessage(err, 'Failed to submit your response.'));
        }
      } else {
        setError(getApiErrorMessage(err, 'Failed to submit your response.'));
      }
    } finally {
      setPending(false);
    }
  }

  if (loading) return <p role="status" className="text-sm text-slate-600">Loading survey…</p>;
  if (error && !survey) return <p role="alert" aria-live="polite" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>;
  if (!survey) return null;
  if (survey.questions.some((question) => !supportsQuestionType(question.questionType))) {
    return (
      <section className="space-y-4" aria-labelledby="survey-title">
        <h2 id="survey-title" className="text-2xl font-bold text-slate-900">{survey.title}</h2>
        <p role="alert" aria-live="polite" className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
          This survey includes a question type that is not available yet.
        </p>
        <Link to="/surveys" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">← Available surveys</Link>
      </section>
    );
  }

  if (survey.mode === 'ANONYMOUS') {
    return (
      <section className="space-y-4" aria-labelledby="survey-title">
        <h2 id="survey-title" className="text-2xl font-bold text-slate-900">{survey.title}</h2>
        <p role="status" className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
          This survey is configured for anonymous responses, which are not available yet. No response has been submitted.
        </p>
        <Link to="/surveys" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">← Available surveys</Link>
      </section>
    );
  }

  return (
    <section className="space-y-6" aria-labelledby="survey-title">
      <div>
        <Link to="/surveys" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">← Available surveys</Link>
        <h2 id="survey-title" className="mt-3 text-2xl font-bold text-slate-900">{survey.title}</h2>
        {survey.description && <p className="mt-1 text-sm text-slate-600">{survey.description}</p>}
      </div>
      {error && <p role="alert" aria-live="polite" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <form noValidate onSubmit={submit} className="space-y-5">
        {survey.questions.map((question) => {
          const missing = missingIds.includes(question.id);
          const validationError = missing ? 'This question is required.' : fieldErrors[question.id];
          const answer = answers[question.id];
          const textAnswer = typeof answer === 'string' ? answer : '';
          const selectedIds = Array.isArray(answer) ? answer : [];
          const choiceQuestion = ['SINGLE_CHOICE', 'YES_NO', 'LIKERT'].includes(question.questionType);
          const textQuestion = question.questionType === 'SHORT_TEXT' || question.questionType === 'LONG_TEXT';
          return (
            <fieldset key={question.id} aria-describedby={validationError ? `${question.id}-error` : undefined} className={`rounded-xl border bg-white p-5 ${validationError ? 'border-red-400' : 'border-slate-200'}`}>
              <legend className="max-w-full px-1 text-sm font-semibold text-slate-900">
                {question.prompt} {question.isRequired && <span className="text-red-600">Required</span>}
              </legend>
              {choiceQuestion ? (
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
                        onChange={() => updateAnswer(question.id, option.id)}
                        className="h-4 w-4 accent-indigo-600"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              ) : question.questionType === 'MULTI_CHOICE' ? (
                <div className="mt-3 space-y-2">
                  {question.options.map((option, index) => (
                    <label key={option.id} className="flex items-center gap-3 text-sm text-slate-700">
                      <input
                        id={index === 0 ? `${question.id}-input` : undefined}
                        type="checkbox"
                        value={option.id}
                        checked={selectedIds.includes(option.id)}
                        aria-invalid={Boolean(validationError)}
                        onChange={(event) => updateAnswer(question.id, event.target.checked
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
              ) : textQuestion ? (
                <div className="mt-3">
                  <label htmlFor={`${question.id}-input`} className="mb-1 block text-sm font-medium text-slate-700">
                    Your answer
                  </label>
                  <textarea
                    id={`${question.id}-input`}
                    value={textAnswer}
                    maxLength={question.questionType === 'SHORT_TEXT' ? 2000 : 10000}
                    required={question.isRequired}
                    aria-invalid={Boolean(validationError)}
                    aria-describedby={`${validationError ? `${question.id}-error ` : ''}${question.id}-counter`}
                    onChange={(event) => updateAnswer(question.id, event.target.value)}
                    className="min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                  <p id={`${question.id}-counter`} className="mt-1 text-right text-xs text-slate-500">{textAnswer.length}/{question.questionType === 'SHORT_TEXT' ? '2,000' : '10,000'}</p>
                </div>
              ) : question.questionType === 'RATING' ? (
                <div className="mt-3 flex gap-3" role="group" aria-label="Rating from 1 to 5">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <label key={rating} className="flex items-center gap-1 text-sm text-slate-700">
                      <input id={rating === 1 ? `${question.id}-input` : undefined} type="radio" name={question.id}
                        checked={textAnswer === String(rating)} required={question.isRequired}
                        aria-invalid={Boolean(validationError)} onChange={() => updateAnswer(question.id, String(rating))}
                        className="h-4 w-4 accent-indigo-600" />{rating}
                    </label>
                  ))}
                </div>
              ) : question.questionType === 'INTEGER' ? (
                <div className="mt-3">
                  <label htmlFor={`${question.id}-input`} className="mb-1 block text-sm font-medium text-slate-700">Whole number</label>
                  <input id={`${question.id}-input`} type="number" step={1} min={question.numberMin} max={question.numberMax}
                    value={textAnswer} required={question.isRequired} aria-invalid={Boolean(validationError)}
                    onChange={(event) => updateAnswer(question.id, event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
              ) : (
                <div className="mt-3">
                  <label htmlFor={`${question.id}-input`} className="mb-1 block text-sm font-medium text-slate-700">Date</label>
                  <input id={`${question.id}-input`} type="date" value={textAnswer} required={question.isRequired}
                    aria-invalid={Boolean(validationError)} onChange={(event) => updateAnswer(question.id, event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
              )}
              {validationError && <p id={`${question.id}-error`} className="mt-2 text-sm text-red-700">{validationError}</p>}
            </fieldset>
          );
        })}
        <button type="submit" disabled={pending} className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60">
          {pending ? 'Submitting…' : 'Submit response'}
        </button>
      </form>
    </section>
  );
}

export function SurveyReceiptPage() {
  const { id = '', responseId = '' } = useParams();
  const [receipt, setReceipt] = useState<SurveyReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadReceipt() {
    setError(null);
    setLoading(true);
    try {
      const response = await api.get<{ data: SurveyReceipt }>(`/surveys/${id}/responses/${responseId}`);
      setReceipt(response.data.data);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to load your receipt.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReceipt();
  }, [id, responseId]);

  if (loading && !receipt) return <p role="status" className="text-sm text-slate-600">Loading your confirmation…</p>;
  if (!receipt) return (
    <div className="space-y-4">
      <p role="alert" aria-live="polite" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error || 'Receipt not found.'}</p>
      <Link to="/surveys" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">Back to available surveys</Link>
    </div>
  );

  return (
    <section aria-labelledby="confirmation-heading" className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
      <h2 id="confirmation-heading" className="text-2xl font-bold text-emerald-900">Your response is recorded</h2>
      <p className="mt-2 text-sm text-emerald-800">Survey response successfully recorded.</p>
      {receipt.mode === 'ANONYMOUS' && (
        <p className="mt-2 text-sm text-emerald-800">This anonymous confirmation contains no answers. Keep the response ID for your records.</p>
      )}
      <dl className="mt-4 space-y-2 text-sm text-emerald-900">
        <div><dt className="inline font-semibold">Response ID: </dt><dd className="inline break-all">{receipt.responseId}</dd></div>
        <div><dt className="inline font-semibold">Submitted: </dt><dd className="inline"><time dateTime={receipt.submittedAt}>{new Date(receipt.submittedAt).toLocaleString()}</time></dd></div>
      </dl>
      {error && <p role="alert" aria-live="polite" className="mt-4 text-sm text-red-700">{error}</p>}
      <button type="button" onClick={loadReceipt} disabled={loading} className="mt-5 rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60">
        {loading ? 'Loading receipt…' : 'View receipt'}
      </button>
      {receipt.mode !== 'ANONYMOUS' && (
        <div className="mt-5 border-t border-emerald-200 pt-4">
          <h3 className="font-semibold text-emerald-900">Your answers</h3>
          <ul className="mt-3 space-y-3">
            {receipt.answers.map((answer) => (
              <li key={answer.questionId} className="text-sm text-emerald-900">
                <p className="font-medium">{answer.prompt}</p>
                <p>{answer.textValue ?? (answer.selectedOptions.length ? answer.selectedOptions.join(', ') : undefined) ?? answer.numberValue ?? answer.dateValue ?? ''}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Link to="/surveys" className="mt-5 inline-block text-sm font-semibold text-emerald-800 hover:text-emerald-950">Return to surveys</Link>
    </section>
  );
}
