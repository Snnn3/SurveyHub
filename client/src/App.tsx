import { useState, useEffect } from 'react';
import axios from 'axios';

function LayersIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m22 12.5-8.58 3.91a2 2 0 0 1-1.66 0L2 12.5" />
      <path d="m22 17.5-8.58 3.91a2 2 0 0 1-1.66 0L2 17.5" />
    </svg>
  );
}

function ServerIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
      <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
      <line x1="6" x2="6.01" y1="6" y2="6" />
      <line x1="6" x2="6.01" y1="18" y2="18" />
    </svg>
  );
}

function DatabaseIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
    </svg>
  );
}

function CheckIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function AlertIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </svg>
  );
}

function ShieldIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </svg>
  );
}

interface HealthData {
  status: string;
  database: string;
}

function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.error?.message || err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return 'Failed to connect to API';
}

export default function App() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkHealth() {
      try {
        const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
        const response = await axios.get(`${apiBaseUrl}/health`);
        if (response.data && response.data.success) {
          setHealth(response.data.data);
        } else {
          setError('Unexpected health response format');
        }
      } catch (err: unknown) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }

    checkHealth();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Top Navigation */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 text-white p-2 rounded-lg shadow-sm">
              <LayersIcon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">SurveyHub</h1>
              <p className="text-xs text-slate-500 font-medium">CPE 334 Software Engineering — Theme 10</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-xs font-medium">
            <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">
              Sprint 1 Scaffold
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-12 flex-1 w-full">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
          <div className="p-6 sm:p-8 border-b border-slate-100">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              System Scaffolding & Database Baseline
            </h2>
            <p className="text-slate-600 text-sm">
              This deployment verifies that the React frontend, Express/TypeScript API layer,
              and PostgreSQL database are initialized, connected, and operating on the same origin.
            </p>
          </div>

          {/* Health Status Widget */}
          <div className="p-6 sm:p-8 bg-slate-50/50">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">
              Realtime Service Health Probe (<code className="text-xs text-indigo-600">GET /api/health</code>)
            </h3>

            {loading ? (
              <div className="flex items-center space-x-3 text-slate-600 p-4 bg-white rounded-lg border border-slate-200">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                <span className="text-sm font-medium">Connecting to backend service...</span>
              </div>
            ) : error ? (
              <div className="flex items-start space-x-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                <AlertIcon className="h-5 w-5 mt-0.5 flex-shrink-0 text-red-600" />
                <div>
                  <h4 className="text-sm font-semibold">Service Probe Warning</h4>
                  <p className="text-xs mt-1 text-red-600">{error}</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-white rounded-lg border border-emerald-200 shadow-sm flex items-center space-x-3">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                    <ServerIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">API Server</div>
                    <div className="text-sm font-semibold text-slate-800 flex items-center space-x-1">
                      <span>Online</span>
                      <CheckIcon className="h-4 w-4 text-emerald-500 inline ml-1" />
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-white rounded-lg border border-emerald-200 shadow-sm flex items-center space-x-3">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                    <DatabaseIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">PostgreSQL Database</div>
                    <div className="text-sm font-semibold text-slate-800 flex items-center space-x-1">
                      <span>{health?.database === 'up' ? 'Connected & Healthy' : health?.database}</span>
                      <CheckIcon className="h-4 w-4 text-emerald-500 inline ml-1" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Demo Accounts Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-8">
          <div className="flex items-center space-x-2 mb-4">
            <ShieldIcon className="h-5 w-5 text-indigo-600" />
            <h3 className="text-base font-semibold text-slate-900">Seeded Synthetic Accounts (Sprint 1)</h3>
          </div>
          <p className="text-xs text-slate-600 mb-4">
            The database seed script initializes four reproducible test accounts with password{' '}
            <code className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded font-mono text-xs">Password123!</code>:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Role</th>
                  <th className="py-2.5 px-3 font-semibold">Email</th>
                  <th className="py-2.5 px-3 font-semibold">Testing Purpose</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                <tr>
                  <td className="py-2 px-3 font-medium text-indigo-700">SURVEY_OWNER</td>
                  <td className="py-2 px-3 font-mono">owner1@survey.local</td>
                  <td className="py-2 px-3 text-slate-500">Primary survey author & analytics</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-medium text-indigo-700">SURVEY_OWNER</td>
                  <td className="py-2 px-3 font-mono">owner2@survey.local</td>
                  <td className="py-2 px-3 text-slate-500">Ownership isolation testing</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-medium text-teal-700">RESPONDENT</td>
                  <td className="py-2 px-3 font-mono">resp1@survey.local</td>
                  <td className="py-2 px-3 text-slate-500">Normal survey submission & duplicate guard</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-medium text-teal-700">RESPONDENT</td>
                  <td className="py-2 px-3 font-mono">resp2@survey.local</td>
                  <td className="py-2 px-3 text-slate-500">Cross-response privacy validation</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="max-w-6xl mx-auto px-4 text-center text-xs text-slate-500">
          SurveyHub — CPE 334 Software Engineering in the Age of AI Agents (1/2026) | Monorepo Scaffolding
        </div>
      </footer>
    </div>
  );
}
