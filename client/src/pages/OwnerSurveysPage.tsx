import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import api from '../api';

export type SurveyStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED';
export type SurveyMode = 'IDENTIFIED' | 'ANONYMOUS';

export interface SurveyListItem {
  id: string;
  title: string;
  status: SurveyStatus;
  mode: SurveyMode;
  questionCount: number;
  responseCount: number;
  createdAt: string;
  updatedAt: string;
}

function getApiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.error?.message || err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return fallback;
}

export function OwnerSurveysPage() {
  const [surveys, setSurveys] = useState<SurveyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmCloseSurvey, setConfirmCloseSurvey] = useState<SurveyListItem | null>(null);
  const [confirmDeleteSurvey, setConfirmDeleteSurvey] = useState<SurveyListItem | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  async function fetchSurveys() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ success: boolean; data: SurveyListItem[] }>('/surveys');
      setSurveys(res.data.data);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to load surveys'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSurveys();
  }, []);

  async function handlePublish(surveyId: string) {
    setActionError(null);
    setProcessingId(surveyId);
    try {
      await api.patch(`/surveys/${surveyId}/publish`);
      await fetchSurveys();
    } catch (err: unknown) {
      setActionError(getApiErrorMessage(err, 'Failed to publish survey'));
    } finally {
      setProcessingId(null);
    }
  }

  async function handleConfirmClose() {
    if (!confirmCloseSurvey) return;
    const surveyId = confirmCloseSurvey.id;
    setActionError(null);
    setProcessingId(surveyId);
    try {
      await api.patch(`/surveys/${surveyId}/close`);
      setConfirmCloseSurvey(null);
      await fetchSurveys();
    } catch (err: unknown) {
      setActionError(getApiErrorMessage(err, 'Failed to close survey'));
    } finally {
      setProcessingId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!confirmDeleteSurvey) return;
    const surveyId = confirmDeleteSurvey.id;
    setActionError(null);
    setProcessingId(surveyId);
    try {
      await api.delete(`/surveys/${surveyId}`);
      setConfirmDeleteSurvey(null);
      setSurveys((prev) => prev.filter((survey) => survey.id !== surveyId));
    } catch (err: unknown) {
      setActionError(getApiErrorMessage(err, 'Failed to delete survey'));
    } finally {
      setProcessingId(null);
    }
  }

  function getStatusBadge(status: SurveyStatus) {
    switch (status) {
      case 'DRAFT':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
            DRAFT
          </span>
        );
      case 'PUBLISHED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
            PUBLISHED
          </span>
        );
      case 'CLOSED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            CLOSED
          </span>
        );
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Owner Dashboard</h2>
          <p className="text-sm text-slate-600">Create, publish, and manage your surveys.</p>
        </div>
        <Link
          to="/owner/surveys/new"
          className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
        >
          + New Survey
        </Link>
      </div>

      {actionError && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex justify-between items-center"
        >
          <span>{actionError}</span>
          <button
            type="button"
            aria-label="Dismiss action error"
            onClick={() => setActionError(null)}
            className="text-red-500 hover:text-red-800 font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <div className="space-y-4" role="status" aria-label="Loading surveys">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm animate-pulse flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-2 flex-1">
                <div className="h-5 bg-slate-200 rounded w-1/3"></div>
                <div className="h-4 bg-slate-100 rounded w-1/4"></div>
              </div>
              <div className="h-8 bg-slate-200 rounded w-28"></div>
            </div>
          ))}
        </div>
      ) : surveys.length === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 mb-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">No surveys yet</h3>
          <p className="text-sm text-slate-600 mb-6">Create your first survey.</p>
          <Link
            to="/owner/surveys/new"
            className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
          >
            Create your first survey
          </Link>
        </div>
      ) : (
        /* Surveys List */
        <div className="space-y-4">
          {surveys.map((survey) => (
            <div
              key={survey.id}
              className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:border-slate-300 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="text-base font-bold text-slate-900">{survey.title}</h3>
                  {getStatusBadge(survey.status)}
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span>{survey.questionCount} {survey.questionCount === 1 ? 'question' : 'questions'}</span>
                  <span>•</span>
                  <span>{survey.responseCount} {survey.responseCount === 1 ? 'response' : 'responses'}</span>
                  <span>•</span>
                  <span>Updated {new Date(survey.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                {survey.status === 'DRAFT' && (
                  <>
                    <Link
                      to={`/owner/surveys/${survey.id}/edit`}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      disabled={processingId === survey.id}
                      onClick={() => handlePublish(survey.id)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition"
                    >
                      {processingId === survey.id ? 'Publishing...' : 'Publish'}
                    </button>
                    <button
                      type="button"
                      disabled={processingId === survey.id}
                      onClick={() => setConfirmDeleteSurvey(survey)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition"
                    >
                      Delete
                    </button>
                  </>
                )}

                {survey.status === 'PUBLISHED' && (
                  <button
                    type="button"
                    disabled={processingId === survey.id}
                    onClick={() => setConfirmCloseSurvey(survey)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition"
                  >
                    Close
                  </button>
                )}

                <Link
                  to={`/owner/surveys/${survey.id}/summary`}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition"
                >
                  View summary
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Modal for Closing a Survey */}
      {confirmCloseSurvey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Close Survey</h3>
            <p className="text-sm text-slate-600 mb-6">
              Are you sure you want to close &quot;{confirmCloseSurvey.title}&quot;? Once closed, respondents can no
              longer submit responses and this survey cannot be reopened.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmCloseSurvey(null)}
                className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={processingId === confirmCloseSurvey.id}
                onClick={handleConfirmClose}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {processingId === confirmCloseSurvey.id ? 'Closing...' : 'Close Survey'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Deleting a Survey */}
      {confirmDeleteSurvey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Draft Survey</h3>
            <p className="text-sm text-slate-600 mb-6">
              Are you sure you want to delete &quot;{confirmDeleteSurvey.title}&quot;? All associated questions and
              options will be permanently deleted.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteSurvey(null)}
                className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={processingId === confirmDeleteSurvey.id}
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {processingId === confirmDeleteSurvey.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
