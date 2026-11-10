import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getApiErrorMessage } from '../api';

interface ActiveSurvey {
  id: string;
  title: string;
  description: string | null;
  status: 'PUBLISHED';
  questionCount: number;
  hasSubmitted: boolean;
  responseId?: string;
}

export function RespondentSurveysPage() {
  const [surveys, setSurveys] = useState<ActiveSurvey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ data: ActiveSurvey[] }>('/surveys/active')
      .then((response) => setSurveys(response.data.data))
      .catch((err: unknown) => setError(getApiErrorMessage(err, 'Failed to load surveys.')))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div role="status" aria-label="Loading surveys" className="space-y-4">
        {[0, 1].map((item) => (
          <div key={item} aria-hidden="true" className="animate-pulse rounded-xl border border-slate-200 bg-white p-6">
            <div className="mb-3 h-5 w-1/2 rounded bg-slate-200" />
            <div className="h-4 w-3/4 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    );
  }

  if (error) return <p role="alert" aria-live="polite" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>;

  return (
    <section className="space-y-6" aria-labelledby="surveys-heading">
      <div>
        <h2 id="surveys-heading" className="text-2xl font-bold text-slate-900">Available surveys</h2>
        <p className="mt-1 text-sm text-slate-600">Choose a published survey to share your feedback.</p>
      </div>
      {surveys.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          There are no published surveys right now.
        </p>
      ) : (
        <ul className="space-y-4">
          {surveys.map((survey) => (
            <li key={survey.id} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${survey.hasSubmitted ? 'border-emerald-200 bg-emerald-100 text-emerald-800' : 'border-indigo-200 bg-indigo-50 text-indigo-700'}`}>
                    {survey.hasSubmitted ? 'Completed' : 'Not submitted'}
                  </span>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">{survey.title}</h3>
                  {survey.description && <p className="mt-1 text-sm text-slate-600">{survey.description}</p>}
                  <p className="mt-2 text-xs text-slate-500">{survey.questionCount} questions</p>
                </div>
                {survey.hasSubmitted ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled
                      className="inline-flex cursor-not-allowed justify-center rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-500"
                    >
                      Start survey
                    </button>
                    {survey.responseId && (
                      <Link
                        to={`/surveys/${survey.id}/confirmation/${survey.responseId}`}
                        className="inline-flex justify-center rounded-lg border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
                      >
                        View receipt
                      </Link>
                    )}
                  </div>
                ) : (
                  <Link
                    to={`/surveys/${survey.id}/take`}
                    className="inline-flex justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                  >
                    Start survey
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
