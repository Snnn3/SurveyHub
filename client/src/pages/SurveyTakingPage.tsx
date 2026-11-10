import axios from 'axios';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { getApiErrorMessage } from '../api';

interface SurveyQuestion {
  id: string;
  prompt: string;
  questionType: string;
  isRequired: boolean;
  orderIndex: number;
  options: Array<{ id: string; label: string; orderIndex: number }>;
}

interface SurveyForm {
  id: string;
  title: string;
  description: string | null;
  questions: SurveyQuestion[];
}

interface SurveyReceipt {
  responseId: string;
  surveyId: string;
  submittedAt: string;
  answers: Array<{
    questionId: string;
    prompt: string;
    textValue: string | null;
    selectedOptions: string[];
  }>;
}

interface ApiErrorBody {
  error?: {
    code?: string;
    details?: { questionIds?: string[] };
  };
}

function supportsQuestionType(questionType: string): boolean {
  return questionType === 'SINGLE_CHOICE' || questionType === 'SHORT_TEXT';
}

export function SurveyTakePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [survey, setSurvey] = useState<SurveyForm | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [missingIds, setMissingIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const missing = survey.questions
      .filter((question) => question.isRequired && !(answers[question.id] || '').trim())
      .map((question) => question.id);
    setMissingIds(missing);
    if (missing.length) {
      setError('Please complete all required questions.');
      document.getElementById(`${missing[0]}-input`)?.focus();
      return;
    }

    const payload: Array<{ questionId: string; selectedOptionIds?: string[]; textValue?: string }> = [];
    for (const question of survey.questions) {
      const value = (answers[question.id] || '').trim();
      if (!value) continue;
      payload.push(question.questionType === 'SINGLE_CHOICE'
        ? { questionId: question.id, selectedOptionIds: [value] }
        : { questionId: question.id, textValue: value });
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
        const questionIds = apiError.details?.questionIds || [];
        setMissingIds(questionIds);
        setError('Please complete all required questions.');
        document.getElementById(`${questionIds[0]}-input`)?.focus();
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
          return (
            <fieldset key={question.id} aria-describedby={missing ? `${question.id}-error` : undefined} className={`rounded-xl border bg-white p-5 ${missing ? 'border-red-400' : 'border-slate-200'}`}>
              <legend className="max-w-full px-1 text-sm font-semibold text-slate-900">
                {question.prompt} {question.isRequired && <span className="text-red-600">Required</span>}
              </legend>
              {question.questionType === 'SINGLE_CHOICE' ? (
                <div className="mt-3 space-y-2">
                  {question.options.map((option, index) => (
                    <label key={option.id} className="flex items-center gap-3 text-sm text-slate-700">
                      <input
                        id={index === 0 ? `${question.id}-input` : undefined}
                        type="radio"
                        name={question.id}
                        value={option.id}
                        checked={answers[question.id] === option.id}
                        required={question.isRequired}
                        aria-invalid={missing}
                        onChange={() => setAnswers((current) => ({ ...current, [question.id]: option.id }))}
                        className="h-4 w-4 accent-indigo-600"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              ) : (
                <div className="mt-3">
                  <label htmlFor={`${question.id}-input`} className="mb-1 block text-sm font-medium text-slate-700">
                    Your answer
                  </label>
                  <textarea
                    id={`${question.id}-input`}
                    value={answers[question.id] || ''}
                    maxLength={2000}
                    required={question.isRequired}
                    aria-invalid={missing}
                    aria-describedby={missing ? `${question.id}-error ${question.id}-counter` : `${question.id}-counter`}
                    onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))}
                    className="min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                  <p id={`${question.id}-counter`} className="mt-1 text-right text-xs text-slate-500">{(answers[question.id] || '').length}/2,000</p>
                </div>
              )}
              {missing && <p id={`${question.id}-error`} className="mt-2 text-sm text-red-700">This question is required.</p>}
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
      <dl className="mt-4 space-y-2 text-sm text-emerald-900">
        <div><dt className="inline font-semibold">Response ID: </dt><dd className="inline break-all">{receipt.responseId}</dd></div>
        <div><dt className="inline font-semibold">Submitted: </dt><dd className="inline"><time dateTime={receipt.submittedAt}>{new Date(receipt.submittedAt).toLocaleString()}</time></dd></div>
      </dl>
      {error && <p role="alert" aria-live="polite" className="mt-4 text-sm text-red-700">{error}</p>}
      <button type="button" onClick={loadReceipt} disabled={loading} className="mt-5 rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60">
        {loading ? 'Loading receipt…' : 'View receipt'}
      </button>
      <div className="mt-5 border-t border-emerald-200 pt-4">
        <h3 className="font-semibold text-emerald-900">Your answers</h3>
        <ul className="mt-3 space-y-3">
          {receipt.answers.map((answer) => (
            <li key={answer.questionId} className="text-sm text-emerald-900">
              <p className="font-medium">{answer.prompt}</p>
              <p>{answer.textValue || answer.selectedOptions.join(', ')}</p>
            </li>
          ))}
        </ul>
      </div>
      <Link to="/surveys" className="mt-5 inline-block text-sm font-semibold text-emerald-800 hover:text-emerald-950">Return to surveys</Link>
    </section>
  );
}
