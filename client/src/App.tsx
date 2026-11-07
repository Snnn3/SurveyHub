import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
  LayersIcon,
  ServerIcon,
  DatabaseIcon,
  CheckIcon,
  AlertIcon,
} from './components/Icons';

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

// Parse JWT payload safely to extract role per SDS §5.2 without external libraries
function getAuthUser(): { token: string; role?: string } | null {
  const token = localStorage.getItem('token');
  if (!token) return null;
  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return { token };
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const decoded = JSON.parse(jsonPayload);
    return { token, role: decoded.role };
  } catch {
    return { token };
  }
}

// Protected route guard per SDS §3.1 (checks authentication and role on the client for navigation)
function ProtectedRoute({
  children,
  allowedRole,
}: {
  children: React.ReactNode;
  allowedRole?: 'SURVEY_OWNER' | 'RESPONDENT';
}) {
  const location = useLocation();
  const auth = getAuthUser();

  if (!auth) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRole && auth.role && auth.role !== allowedRole) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

interface PlaceholderCardProps {
  title: string;
  description: string;
}

function PlaceholderCard({ title, description }: PlaceholderCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
      <h2 className="text-xl font-bold text-slate-900 mb-2">{title}</h2>
      <p className="text-sm text-slate-600 mb-4">{description}</p>
      <Link to="/" className="text-sm font-semibold text-indigo-600 hover:text-indigo-800">
        Return to Home
      </Link>
    </div>
  );
}

function LoginPage() {
  return <PlaceholderCard title="Login" description="Sprint 1 Feature F-01: Authentication, session and RBAC." />;
}

function SurveysPage() {
  return (
    <PlaceholderCard
      title="Survey Catalogue"
      description="Sprint 1 Feature F-03: Respondent survey taking and response rules."
    />
  );
}

function OwnerSurveysPage() {
  return (
    <PlaceholderCard
      title="Owner Dashboard"
      description="Sprint 1 Feature F-02: Survey lifecycle and authoring."
    />
  );
}

function ScaffoldHome() {
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

  const probeItems = [
    {
      name: 'API Server',
      status: 'Online',
      Icon: ServerIcon,
    },
    {
      name: 'PostgreSQL Database',
      status: health?.database === 'up' ? 'Connected & Healthy' : health?.database,
      Icon: DatabaseIcon,
    },
  ];

  return (
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
            {probeItems.map(({ name, status, Icon }) => (
              <div
                key={name}
                className="p-4 bg-white rounded-lg border border-emerald-200 shadow-sm flex items-center space-x-3"
              >
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-medium">{name}</div>
                  <div className="text-sm font-semibold text-slate-800 flex items-center space-x-1">
                    <span>{status}</span>
                    <CheckIcon className="h-4 w-4 text-emerald-500 inline ml-1" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NotFound() {
  return <PlaceholderCard title="Page Not Found" description="The requested page does not exist." />;
}

export default function App() {
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

          <div className="flex items-center space-x-4 text-xs font-medium">
            <nav className="hidden sm:flex items-center space-x-3 text-slate-600">
              <Link to="/" className="hover:text-indigo-600">Home</Link>
              <Link to="/login" className="hover:text-indigo-600">Login</Link>
              <Link to="/surveys" className="hover:text-indigo-600">Surveys</Link>
              <Link to="/owner/surveys" className="hover:text-indigo-600">Owner</Link>
            </nav>
            <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">
              Sprint 1 Scaffold
            </span>
          </div>
        </div>
      </header>

      {/* Main Content with Route Hierarchy */}
      <main className="max-w-4xl mx-auto px-4 py-12 flex-1 w-full">
        <Routes>
          <Route path="/" element={<ScaffoldHome />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/surveys"
            element={
              <ProtectedRoute allowedRole="RESPONDENT">
                <SurveysPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner/surveys"
            element={
              <ProtectedRoute allowedRole="SURVEY_OWNER">
                <OwnerSurveysPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
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
