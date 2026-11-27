import { Link } from 'react-router-dom';

interface SurveyStartInfo {
  id: string;
  acceptingResponses: boolean;
  hasSubmitted: boolean;
  responseId?: string;
}

export function SurveyStartAction({ survey }: { survey: SurveyStartInfo }) {
  if (survey.hasSubmitted) {
    return (
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled className="inline-flex cursor-not-allowed justify-center rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-500">
          Start survey
        </button>
        {survey.responseId && (
          <Link to={`/surveys/${survey.id}/confirmation/${survey.responseId}`} className="inline-flex justify-center rounded-lg border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50">
            View receipt
          </Link>
        )}
      </div>
    );
  }

  if (!survey.acceptingResponses) {
    return (
      <div className="space-y-2">
        <button type="button" disabled className="inline-flex cursor-not-allowed justify-center rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-500">
          Start survey
        </button>
        <p role="status" className="text-sm font-medium text-amber-800">This survey is no longer accepting responses.</p>
      </div>
    );
  }

  return (
    <Link to={`/surveys/${survey.id}/take`} className="inline-flex justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
      Start survey
    </Link>
  );
}
