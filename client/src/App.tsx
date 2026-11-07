import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import api, { SESSION_EXPIRED_EVENT } from './api';
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

type UserRole = 'SURVEY_OWNER' | 'RESPONDENT';

interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

function homeForRole(role: UserRole): string {
  return role === 'SURVEY_OWNER' ? '/owner/surveys' : '/surveys';
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

function ProtectedRoute({
  children,
  user,
  loading,
  allowedRole,
}: {
  children: React.ReactNode;
  user: AuthUser | null;
  loading: boolean;
  allowedRole: UserRole;
}) {
  if (loading) {
    return <div role="status" className="text-center text-slate-600">Loading your account...</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.role !== allowedRole) {
    return <Navigate to={homeForRole(user.role)} replace />;
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

function LoginPage({ onLogin }: { onLogin: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await onLogin(email, password);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="max-w-md mx-auto bg-white rounded-xl shadow-sm border border-slate-200 p-8">
      <h2 className="text-2xl font-bold text-slate-900 mb-2">Sign in to SurveyHub</h2>
      <p className="text-sm text-slate-600 mb-6">Use your assigned account to continue.</p>
      {error && <div role="alert" aria-live="polite" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-70"
        >
          {pending && <span aria-hidden="true" className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-b-white align-[-3px]" />}
          {pending ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </section>
  );
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
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(() => Boolean(localStorage.getItem('token')));

  useEffect(() => {
    function clearSession() {
      setUser(null);
      setAuthLoading(false);
      navigate('/login', { replace: true });
    }

    window.addEventListener(SESSION_EXPIRED_EVENT, clearSession);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, clearSession);
  }, [navigate]);

  useEffect(() => {
    if (!localStorage.getItem('token')) return;

    let active = true;
    api.get<ApiEnvelope<AuthUser>>('/auth/me')
      .then(({ data }) => {
        if (active) setUser(data.data);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setAuthLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleLogin(email: string, password: string): Promise<void> {
    const { data: loginResponse } = await api.post<ApiEnvelope<{ token: string }>>('/auth/login', {
      email,
      password,
    });
    localStorage.setItem('token', loginResponse.data.token);
    const { data: currentUserResponse } = await api.get<ApiEnvelope<AuthUser>>('/auth/me');
    setUser(currentUserResponse.data);
    navigate(homeForRole(currentUserResponse.data.role), { replace: true });
  }

  async function handleLogout(): Promise<void> {
    await api.post('/auth/logout').catch(() => undefined);
    localStorage.removeItem('token');
    setUser(null);
    navigate('/login', { replace: true });
  }

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
              {user ? (
                <Link to={homeForRole(user.role)} className="hover:text-indigo-600">
                  {user.role === 'SURVEY_OWNER' ? 'Owner' : 'Surveys'}
                </Link>
              ) : (
                <Link to="/login" className="hover:text-indigo-600">Login</Link>
              )}
            </nav>
            {user && (
              <>
                <span className="text-slate-600">{user.fullName} · {user.role}</span>
                <button type="button" onClick={handleLogout} className="font-semibold text-indigo-600 hover:text-indigo-800">
                  Log out
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content with Route Hierarchy */}
      <main className="max-w-4xl mx-auto px-4 py-12 flex-1 w-full">
        <Routes>
          <Route path="/" element={<ScaffoldHome />} />
          <Route
            path="/login"
            element={authLoading ? <div role="status" className="text-center text-slate-600">Loading your account...</div> : user ? <Navigate to={homeForRole(user.role)} replace /> : <LoginPage onLogin={handleLogin} />}
          />
          <Route
            path="/surveys"
            element={
              <ProtectedRoute user={user} loading={authLoading} allowedRole="RESPONDENT">
                <SurveysPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner/surveys"
            element={
              <ProtectedRoute user={user} loading={authLoading} allowedRole="SURVEY_OWNER">
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
