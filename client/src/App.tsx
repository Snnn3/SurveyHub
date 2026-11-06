import { useState, useEffect } from 'react';
import axios from 'axios';
import { Database, Server, CheckCircle2, AlertCircle, Shield, Layers } from 'lucide-react';

interface HealthData {
  status: string;
  database: string;
}

export default function App() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkHealth() {
      try {
        const response = await axios.get('/api/health');
        if (response.data && response.data.success) {
          setHealth(response.data.data);
        } else {
          setError('Unexpected health response format');
        }
      } catch (err: any) {
        setError(err.response?.data?.error?.message || err.message || 'Failed to connect to API');
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
              <Layers className="h-5 w-5" />
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
                <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0 text-red-600" />
                <div>
                  <h4 className="text-sm font-semibold">Service Probe Warning</h4>
                  <p className="text-xs mt-1 text-red-600">{error}</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-white rounded-lg border border-emerald-200 shadow-sm flex items-center space-x-3">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                    <Server className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">API Server</div>
                    <div className="text-sm font-semibold text-slate-800 flex items-center space-x-1">
                      <span>Online</span>
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 inline ml-1" />
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-white rounded-lg border border-emerald-200 shadow-sm flex items-center space-x-3">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                    <Database className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">PostgreSQL Database</div>
                    <div className="text-sm font-semibold text-slate-800 flex items-center space-x-1">
                      <span>{health?.database === 'up' ? 'Connected & Healthy' : health?.database}</span>
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 inline ml-1" />
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
            <Shield className="h-5 w-5 text-indigo-600" />
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
