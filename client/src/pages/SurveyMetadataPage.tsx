import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { getApiErrorMessage, parseApiError } from '../api';

interface SurveyMetadata {
  id: string;
  title: string;
  description: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export function SurveyMetadataPage() {
  const { id = '' } = useParams();
  const [survey, setSurvey] = useState<SurveyMetadata | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setSuccess(null);
    setSurvey(null);
    setTitle('');
    setDescription('');
    setFieldErrors({});

    api.get<ApiResponse<SurveyMetadata>>(`/surveys/${id}`)
      .then((response) => {
        if (!active) return;
        const currentSurvey = response.data.data;
        if (currentSurvey.status !== 'PUBLISHED') {
          setError('Only published surveys can have their details edited.');
          return;
        }
        setSurvey(currentSurvey);
        setTitle(currentSurvey.title);
        setDescription(currentSurvey.description ?? '');
      })
      .catch((err: unknown) => {
        if (active) setError(getApiErrorMessage(err, 'Failed to load survey details.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  async function saveDetails(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!survey) return;

    setSaving(true);
    setError(null);
    setSuccess(null);
    setFieldErrors({});
    try {
      const response = await api.patch<ApiResponse<SurveyMetadata>>(
        `/surveys/${survey.id}/metadata`,
        { title, description }
      );
      setSurvey(response.data.data);
      setTitle(response.data.data.title);
      setDescription(response.data.data.description ?? '');
      setSuccess('Survey details saved.');
    } catch (err: unknown) {
      const apiError = parseApiError(err, 'Failed to save survey details.');
      setError(apiError.message);
      setFieldErrors(Object.fromEntries(
        apiError.details
          .filter((detail) => detail.field === 'title' || detail.field === 'description')
          .map((detail) => [detail.field!, detail.message])
      ));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        to="/owner/surveys"
        className="inline-flex text-sm font-medium text-indigo-700 hover:text-indigo-900"
      >
        ← Back to surveys
      </Link>

      <header>
        <h1 className="text-2xl font-bold text-slate-900">Edit published survey details</h1>
        <p className="mt-1 text-sm text-slate-600">
          Change the title or respondent instructions. Questions and existing responses stay the same.
        </p>
      </header>

      {loading && (
        <div role="status" aria-label="Loading survey details" className="rounded-lg bg-white p-6 text-sm text-slate-600 shadow-sm">
          Loading survey details…
        </div>
      )}

      {error && (
        <div role="alert" aria-live="polite" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div role="status" aria-live="polite" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {success}
        </div>
      )}

      {!loading && survey && (
        <form noValidate onSubmit={saveDetails} className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <label htmlFor="metadata-title" className="mb-1 block text-sm font-medium text-slate-700">
              Survey Title <span className="text-red-500">*</span>
            </label>
            <input
              id="metadata-title"
              name="title"
              type="text"
              required
              maxLength={120}
              disabled={saving}
              value={title}
              aria-invalid={Boolean(fieldErrors.title)}
              aria-describedby={fieldErrors.title ? 'metadata-title-error metadata-title-count' : 'metadata-title-count'}
              onChange={(event) => {
                setTitle(event.target.value);
                setFieldErrors((current) => ({ ...current, title: '' }));
                setError(null);
                setSuccess(null);
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            {fieldErrors.title && <p id="metadata-title-error" className="mt-1 text-sm text-red-600">{fieldErrors.title}</p>}
            <p id="metadata-title-count" className="mt-1 text-right text-xs text-slate-500">{title.length} / 120 characters</p>
          </div>

          <div>
            <label htmlFor="metadata-description" className="mb-1 block text-sm font-medium text-slate-700">
              Description <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <textarea
              id="metadata-description"
              name="description"
              rows={6}
              maxLength={2000}
              disabled={saving}
              value={description}
              aria-invalid={Boolean(fieldErrors.description)}
              aria-describedby={fieldErrors.description ? 'metadata-description-error metadata-description-count metadata-description-help' : 'metadata-description-count metadata-description-help'}
              onChange={(event) => {
                setDescription(event.target.value);
                setFieldErrors((current) => ({ ...current, description: '' }));
                setError(null);
                setSuccess(null);
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            {fieldErrors.description && <p id="metadata-description-error" className="mt-1 text-sm text-red-600">{fieldErrors.description}</p>}
            <p id="metadata-description-count" className="mt-1 text-right text-xs text-slate-500">{description.length} / 2,000 characters</p>
            <p id="metadata-description-help" className="mt-1 text-xs text-slate-500">Leave this blank to clear the description.</p>
          </div>

          <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-4">
            <Link
              to="/owner/surveys"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save details'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
