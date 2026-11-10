import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { getApiErrorMessage, getApiErrorStatus } from '../api';

export type QuestionType =
  | 'SINGLE_CHOICE'
  | 'MULTI_CHOICE'
  | 'SHORT_TEXT'
  | 'LONG_TEXT'
  | 'YES_NO'
  | 'LIKERT'
  | 'RATING'
  | 'INTEGER'
  | 'DATE';

export interface OptionSummary {
  optionId: string;
  label: string;
  count: number;
  percentage: number;
}

export interface QuestionSummary {
  questionId: string;
  prompt: string;
  questionType: QuestionType;
  answeredCount: number;
  options?: OptionSummary[];
  textAnswers?: string[];
}

export interface SurveySummary {
  surveyId: string;
  title: string;
  description: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
  mode: 'IDENTIFIED' | 'ANONYMOUS';
  totalResponses: number;
  createdAt: string;
  questions: QuestionSummary[];
}

// Consistent with OwnerSurveysPage status badge palette (SDS §3.3)
function statusBadgeClass(status: SurveySummary['status']): string {
  switch (status) {
    case 'PUBLISHED':
      return 'border-emerald-200 bg-emerald-100 text-emerald-800';
    case 'DRAFT':
      return 'border-amber-200 bg-amber-100 text-amber-800';
    case 'CLOSED':
    default:
      return 'border-slate-200 bg-slate-100 text-slate-700';
  }
}

export function SurveySummaryPage() {
  const { id = '' } = useParams<{ id: string }>();
  const [summary, setSummary] = useState<SurveySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [isForbidden, setIsForbidden] = useState(false);
  const [isNotFound, setIsNotFound] = useState(false);
  const activeIdRef = useRef(id);

  useEffect(() => {
    activeIdRef.current = id;
    let isCurrent = true;

    // Reset state and clear previous summary to avoid stale data during route changes
    setSummary(null);
    setLoading(true);
    setRefreshing(false);
    setError(null);
    setRefreshError(null);
    setIsForbidden(false);
    setIsNotFound(false);

    api.get<{ success: boolean; data: SurveySummary }>(`/surveys/${id}/summary`)
      .then((res) => {
        // Discard response if route id changed while request was in flight
        if (isCurrent && activeIdRef.current === id) {
          setSummary(res.data.data);
        }
      })
      .catch((err: unknown) => {
        if (!isCurrent || activeIdRef.current !== id) return;
        const status = getApiErrorStatus(err);
        if (status === 403) {
          setIsForbidden(true);
        } else if (status === 404) {
          setIsNotFound(true);
        } else {
          setError(getApiErrorMessage(err, 'Failed to load survey summary.'));
        }
      })
      .finally(() => {
        if (isCurrent && activeIdRef.current === id) {
          setLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [id]);

  const handleRefresh = async () => {
    const targetId = id;
    setRefreshing(true);
    setRefreshError(null);

    try {
      const res = await api.get<{ success: boolean; data: SurveySummary }>(`/surveys/${targetId}/summary`);
      if (activeIdRef.current === targetId) {
        setSummary(res.data.data);
      }
    } catch (err: unknown) {
      if (activeIdRef.current === targetId) {
        setRefreshError(getApiErrorMessage(err, 'Failed to refresh survey summary.'));
      }
    } finally {
      if (activeIdRef.current === targetId) {
        setRefreshing(false);
      }
    }
  };

  if (loading && !summary) {
    return (
      <div role="status" aria-label="Loading survey summary" className="space-y-6">
        <div aria-hidden="true" className="animate-pulse space-y-4">
          <div className="h-6 w-1/4 rounded bg-slate-200" />
          <div className="h-10 w-2/3 rounded bg-slate-200" />
          <div className="h-24 w-full rounded-xl bg-slate-100" />
          <div className="h-48 w-full rounded-xl bg-slate-100" />
        </div>
      </div>
    );
  }

  // Access denied view for 403 without rendering any survey data per F-04 §5.3
  if (isForbidden) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 shadow-sm">
        <h2 className="text-xl font-bold text-red-900">Access Denied</h2>
        <p className="mt-2 text-sm text-red-700">You do not have permission to view this survey summary.</p>
        <Link
          to="/owner/surveys"
          className="mt-4 inline-block text-sm font-semibold text-red-800 hover:text-red-950 underline"
        >
          Back to surveys
        </Link>
      </div>
    );
  }

  // Not found page per SDS §3.2
  if (isNotFound) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm space-y-3">
        <h2 className="text-xl font-bold text-slate-900">Survey Not Found</h2>
        <p className="text-sm text-slate-600">The requested survey summary could not be found.</p>
        <Link
          to="/owner/surveys"
          className="inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-800"
        >
          Back to surveys
        </Link>
      </div>
    );
  }

  // Initial load error when no summary is available
  if (error || !summary) {
    return (
      <div className="space-y-4">
        <p role="alert" aria-live="polite" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error || 'Survey summary not found.'}
        </p>
        <Link to="/owner/surveys" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
          Back to surveys
        </Link>
      </div>
    );
  }

  return (
    <section className="space-y-6" aria-labelledby="summary-heading">
      <div>
        <Link to="/owner/surveys" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
          &larr; Back to surveys
        </Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="summary-heading" className="text-2xl font-bold text-slate-900">
              {summary.title}
            </h2>
            <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(summary.status)}`}>
              {summary.status}
            </span>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition"
          >
            {refreshing ? 'Refreshing…' : 'Refresh results'}
          </button>
        </div>
        {summary.description && (
          <p className="mt-2 text-sm text-slate-600">{summary.description}</p>
        )}
        <p className="mt-1 text-xs text-slate-500">
          Created on {new Date(summary.createdAt).toLocaleDateString()}
        </p>
      </div>

      {/* Non-blocking refresh error banner when existing summary is preserved */}
      {refreshError && (
        <div
          role="alert"
          aria-live="polite"
          className="flex items-center justify-between rounded-lg bg-red-50 p-4 text-sm text-red-700 shadow-sm border border-red-100"
        >
          <span>{refreshError}</span>
          <button
            type="button"
            onClick={() => setRefreshError(null)}
            className="ml-4 text-xs font-semibold text-red-800 underline hover:text-red-950"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total responses</p>
        <p className="mt-2 text-3xl font-extrabold text-slate-900">{summary.totalResponses}</p>
      </div>

      {/* Empty State Banner when totalResponses = 0 (F-04 §5.3 line 50) */}
      {summary.totalResponses === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <p className="text-sm font-medium text-slate-700">No responses submitted yet.</p>
          <p className="mt-1 text-xs text-slate-500">
            Below is your question outline. Refresh this page or click "Refresh results" to check for new submissions as respondents complete your survey.
          </p>
        </div>
      )}

      {/* Question Breakdown (rendered both when responses exist and when zero per F-04 §5.3 lines 44-46) */}
      <ol className="space-y-6">
        {summary.questions.map((question, index) => (
          <li
            key={question.questionId}
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
              <h3 className="text-base font-semibold text-slate-900">
                <span className="text-slate-500 mr-2">{index + 1}.</span>
                {question.prompt}
              </h3>
              <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
                {question.answeredCount} answered
              </span>
            </div>

            {/* Options breakdown for choice-based questions */}
            {question.options && question.options.length > 0 && (
              <ul className="space-y-3 pt-2">
                {question.options.map((option) => (
                  <li key={option.optionId} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-700">{option.label}</span>
                      <span className="font-medium text-slate-900">
                        {option.count} ({option.percentage}%)
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-valuenow={option.percentage}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${option.label} percentage`}
                      className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
                    >
                      <div
                        className="h-2.5 rounded-full bg-indigo-600 transition-all duration-300"
                        style={{ width: `${Math.min(option.percentage, 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* Text answers list for text-based questions */}
            {question.textAnswers && (
              <div className="pt-2">
                {question.textAnswers.length === 0 ? (
                  <p className="text-sm italic text-slate-500">No text answers yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {question.textAnswers.map((answer, answerIndex) => (
                      <li
                        key={answerIndex}
                        className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm text-slate-800"
                      >
                        {answer}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
