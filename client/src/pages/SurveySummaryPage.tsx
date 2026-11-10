import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { getApiErrorMessage, getApiErrorStatus } from '../api';

export interface OptionSummary {
  optionId: string;
  label: string;
  count: number;
  percentage: number;
}

export interface QuestionSummary {
  questionId: string;
  prompt: string;
  questionType: string;
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

function statusBadgeClass(status: SurveySummary['status']): string {
  switch (status) {
    case 'PUBLISHED':
      return 'border-emerald-200 bg-emerald-100 text-emerald-800';
    case 'CLOSED':
      return 'border-amber-200 bg-amber-100 text-amber-800';
    case 'DRAFT':
    default:
      return 'border-slate-200 bg-slate-100 text-slate-700';
  }
}

export function SurveySummaryPage() {
  const { id = '' } = useParams<{ id: string }>();
  const [summary, setSummary] = useState<SurveySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isForbidden, setIsForbidden] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    setIsForbidden(false);

    api.get<{ data: SurveySummary }>(`/surveys/${id}/summary`)
      .then((res) => {
        if (isMounted) {
          setSummary(res.data.data);
        }
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        const status = getApiErrorStatus(err);
        if (status === 403) {
          setIsForbidden(true);
        } else {
          setError(getApiErrorMessage(err, 'Failed to load survey summary.'));
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading) {
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
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h2 id="summary-heading" className="text-2xl font-bold text-slate-900">
            {summary.title}
          </h2>
          <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(summary.status)}`}>
            {summary.status}
          </span>
        </div>
        {summary.description && (
          <p className="mt-2 text-sm text-slate-600">{summary.description}</p>
        )}
        <p className="mt-1 text-xs text-slate-500">
          Created on {new Date(summary.createdAt).toLocaleDateString()}
        </p>
      </div>

      {/* KPI Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total responses</p>
        <p className="mt-2 text-3xl font-extrabold text-slate-900">{summary.totalResponses}</p>
      </div>

      {/* Empty State */}
      {summary.totalResponses === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-slate-600">No responses submitted yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {summary.questions.map((question, index) => (
            <div
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
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
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
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
