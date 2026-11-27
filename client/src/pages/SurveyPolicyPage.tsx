import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { getApiErrorStatus, parseApiError } from '../api';
import { toLocalDateTime } from '../utils/survey-schedule';

type SurveyStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED';

interface SurveyEligibility {
  surveyId: string;
  eligibleRespondents: Array<{ userId: string; email: string; fullName: string }>;
}

interface SurveySchedule {
  surveyId: string;
  status: SurveyStatus;
  closesAt: string | null;
  acceptingResponses: boolean;
}

interface PolicyData {
  eligibility: SurveyEligibility;
  schedule: SurveySchedule;
}

function getPolicyError(error: unknown, fallback: string): { message: string; denied: boolean } {
  if (getApiErrorStatus(error) === 403) return { message: 'Access denied.', denied: true };
  const details = parseApiError(error, fallback);
  const prefix = ['VALIDATION_ERROR', 'INVALID_ELIGIBILITY'].includes(details.code ?? '')
    ? 'Validation error: '
    : 'Server error: ';
  return { message: `${prefix}${details.message}`, denied: false };
}

export function SurveyPolicyPage() {
  const { id = '' } = useParams<{ id: string }>();
  const [policy, setPolicy] = useState<PolicyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [respondentEmails, setRespondentEmails] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const closed = policy?.schedule.status === 'CLOSED';
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  async function loadPolicy(surveyId: string) {
    setLoading(true);
    setError(null);
    setDenied(false);
    setPolicy(null);
    try {
      const [eligibilityResponse, scheduleResponse] = await Promise.all([
        api.get<{ data: SurveyEligibility }>(`/surveys/${surveyId}/eligibility`),
        api.get<{ data: SurveySchedule }>(`/surveys/${surveyId}/schedule`),
      ]);
      const nextPolicy = {
        eligibility: eligibilityResponse.data.data,
        schedule: scheduleResponse.data.data,
      };
      setPolicy(nextPolicy);
      setRespondentEmails(nextPolicy.eligibility.eligibleRespondents.map(({ email }) => email).join('\n'));
      setClosesAt(toLocalDateTime(nextPolicy.schedule.closesAt));
    } catch (loadError: unknown) {
      const result = getPolicyError(loadError, 'Failed to load survey policies.');
      setDenied(result.denied);
      if (!result.denied) setError(result.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPolicy(id);
  }, [id]);

  async function saveEligibility(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const emails = respondentEmails.split(/\r?\n/).map((email) => email.trim()).filter(Boolean);
      const response = await api.put<{ data: SurveyEligibility }>(`/surveys/${id}/eligibility`, { respondentEmails: emails });
      const next = response.data.data;
      setPolicy((current) => current ? { ...current, eligibility: next } : current);
      setRespondentEmails(next.eligibleRespondents.map(({ email }) => email).join('\n'));
      setSuccess('Eligibility list saved.');
    } catch (saveError: unknown) {
      const result = getPolicyError(saveError, 'Failed to save eligibility list.');
      setDenied(result.denied);
      if (!result.denied) setError(result.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveSchedule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await api.patch<{ data: SurveySchedule }>(`/surveys/${id}/schedule`, {
        closesAt: closesAt ? new Date(closesAt).toISOString() : null,
      });
      const next = response.data.data;
      setPolicy((current) => current ? { ...current, schedule: next } : current);
      setClosesAt(toLocalDateTime(next.closesAt));
      setSuccess('Schedule saved.');
    } catch (saveError: unknown) {
      const result = getPolicyError(saveError, 'Failed to save schedule.');
      setDenied(result.denied);
      if (!result.denied) setError(result.message);
    } finally {
      setSaving(false);
    }
  }

  async function clearSchedule() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await api.patch<{ data: SurveySchedule }>(`/surveys/${id}/schedule`, { closesAt: null });
      const next = response.data.data;
      setPolicy((current) => current ? { ...current, schedule: next } : current);
      setClosesAt('');
      setSuccess('Schedule cleared.');
    } catch (clearError: unknown) {
      const result = getPolicyError(clearError, 'Failed to clear schedule.');
      setDenied(result.denied);
      if (!result.denied) setError(result.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-6" aria-labelledby="policy-heading">
      <Link to="/owner/surveys" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">← Owner surveys</Link>
      <div>
        <h2 id="policy-heading" className="text-2xl font-bold text-slate-900">Eligibility and schedule</h2>
        <p className="mt-1 text-sm text-slate-600">Choose who can respond and when the survey stops accepting responses.</p>
      </div>

      {loading && <p role="status" aria-live="polite">Loading survey policies…</p>}
      {denied && <p role="alert" aria-live="assertive" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">Access denied.</p>}
      {error && <p role="alert" aria-live="assertive" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {success && <p role="status" aria-live="polite" className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">{success}</p>}

      {!loading && !denied && policy && (
        <>
          <form onSubmit={saveEligibility} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Eligible respondents</h3>
              <p className="mt-1 text-sm text-slate-600">Leave the list empty to allow any respondent. Enter one respondent email per line.</p>
            </div>
            {closed && <p role="status" className="text-sm text-slate-600">This survey is manually closed. Its policy settings cannot be changed.</p>}
            <label htmlFor="eligible-emails" className="block text-sm font-medium text-slate-700">Respondent emails</label>
            <textarea
              id="eligible-emails"
              value={respondentEmails}
              onChange={(event) => setRespondentEmails(event.target.value)}
              disabled={closed || saving}
              rows={5}
              aria-describedby="eligibility-help"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
            />
            <p id="eligibility-help" className="text-xs text-slate-500">Only existing respondent accounts can be added.</p>
            <button type="submit" disabled={closed || saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {saving ? 'Saving…' : 'Save eligibility list'}
            </button>
          </form>

          <form onSubmit={saveSchedule} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Scheduled close</h3>
              <p className="mt-1 text-sm text-slate-600">Time zone: {timeZone}</p>
              <p className="mt-1 text-xs text-slate-500">The survey stores this deadline as a UTC instant.</p>
            </div>
            {closed && <p role="status" className="text-sm text-slate-600">This survey is manually closed and cannot be reopened.</p>}
            <label htmlFor="closes-at" className="block text-sm font-medium text-slate-700">Stop accepting responses at</label>
            <input
              id="closes-at"
              type="datetime-local"
              step="0.001"
              value={closesAt}
              onChange={(event) => setClosesAt(event.target.value)}
              disabled={closed || saving}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
            />
            <div className="flex gap-2">
              <button type="submit" disabled={closed || saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {saving ? 'Saving…' : 'Save schedule'}
              </button>
              <button type="button" onClick={clearSchedule} disabled={closed || saving || !policy.schedule.closesAt} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">
                Clear schedule
              </button>
            </div>
            <p className="text-sm text-slate-600">Response status: {policy.schedule.acceptingResponses ? 'Accepting responses' : 'Not accepting responses'}.</p>
          </form>
        </>
      )}
    </section>
  );
}
