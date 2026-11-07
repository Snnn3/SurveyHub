import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import api, { SESSION_EXPIRED_EVENT } from './api';
import { LayersIcon } from './components/Icons';
import { OwnerSurveysPage } from './pages/OwnerSurveysPage';
import { SurveyEditorPage } from './pages/SurveyEditorPage';

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

type LoginFieldErrors = Partial<Record<'email' | 'password', string>>;

async function fetchCurrentUser(): Promise<AuthUser> {
  const { data } = await api.get<ApiEnvelope<AuthUser>>('/auth/me');
  return data.data;
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
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const emailInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    if (!event.currentTarget.checkValidity()) {
      const errors: LoginFieldErrors = {};
      if (emailInput.current?.validity.valueMissing) errors.email = 'Email is required.';
      else if (emailInput.current?.validity.typeMismatch) {
        errors.email = 'Enter a valid email address.';
      }
      if (passwordInput.current?.validity.valueMissing) errors.password = 'Password is required.';
      setFieldErrors(errors);
      (errors.email ? emailInput : passwordInput).current?.focus();
      return;
    }

    setPending(true);
    try {
      await onLogin(email, password);
    } catch (err: unknown) {
      if (
        axios.isAxiosError<{
          error?: { details?: Partial<Record<'email' | 'password', string[]>> };
        }>(err) && err.response?.status === 400
      ) {
        const details = err.response.data?.error?.details;
        const validationErrors: LoginFieldErrors = {};
        if (details?.email?.[0]) validationErrors.email = details.email[0];
        if (details?.password?.[0]) validationErrors.password = details.password[0];
        if (validationErrors.email || validationErrors.password) {
          setFieldErrors(validationErrors);
          (validationErrors.email ? emailInput : passwordInput).current?.focus();
          return;
        }
      }
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
      <form noValidate onSubmit={submit} className="space-y-5">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            ref={emailInput}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? 'email-error' : undefined}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setFieldErrors((current) => ({ ...current, email: undefined }));
              setError(null);
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
          {fieldErrors.email && (
            <p id="email-error" className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>
          )}
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            ref={passwordInput}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? 'password-error' : undefined}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setFieldErrors((current) => ({ ...current, password: undefined }));
              setError(null);
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
          {fieldErrors.password && (
            <p id="password-error" className="mt-1 text-sm text-red-600">{fieldErrors.password}</p>
          )}
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

function SurveySummaryPlaceholder() {
  return (
    <PlaceholderCard
      title="Survey Summary"
      description="Sprint 1 Feature F-04: Owner survey summary and real-time response aggregation."
    />
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
    fetchCurrentUser()
      .then((currentUser) => {
        if (active) setUser(currentUser);
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
    const currentUser = await fetchCurrentUser();
    setUser(currentUser);
    navigate(homeForRole(currentUser.role), { replace: true });
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
          <Route
            path="/"
            element={
              authLoading ? (
                <div role="status" className="text-center text-slate-600">Loading your account...</div>
              ) : (
                <Navigate to={user ? homeForRole(user.role) : '/login'} replace />
              )
            }
          />
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
          <Route
            path="/owner/surveys/new"
            element={
              <ProtectedRoute user={user} loading={authLoading} allowedRole="SURVEY_OWNER">
                <SurveyEditorPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner/surveys/:id/edit"
            element={
              <ProtectedRoute user={user} loading={authLoading} allowedRole="SURVEY_OWNER">
                <SurveyEditorPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner/surveys/:id/summary"
            element={
              <ProtectedRoute user={user} loading={authLoading} allowedRole="SURVEY_OWNER">
                <SurveySummaryPlaceholder />
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
