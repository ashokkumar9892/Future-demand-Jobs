import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Route as RouteIcon, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/app/providers';
import { DEMO_MODE } from '@/lib/api';
import { Button, ErrorPanel, Field, Input } from '@/components/ui';

const HIGHLIGHTS = [
  'Thirteen ranked career paths with USA salary bands, demand outlook and AI-replacement risk',
  'A ten-phase AI Solutions Architect curriculum built for a 20-year enterprise engineer',
  'Study-time calculator that turns your weekly hours into a dated completion plan',
  'Scored practice, architecture challenges, coding labs and mock interviews',
];

export default function Login({ mode = 'login' }: { mode?: 'login' | 'register' }) {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Prefilled only for the browser-only demo, where the accounts are local to
  // this browser and there is no server to reach. A real deployment starts
  // blank: credentials never ship in the UI.
  const demoLogin = DEMO_MODE && mode === 'login';
  const [email, setEmail] = useState(demoLogin ? 'demo@futuretech.local' : '');
  const [password, setPassword] = useState(demoLogin ? 'Demo#2026' : '');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={(location.state as { from?: string })?.from ?? '/'} replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const profile =
        mode === 'register'
          ? await register(email, password, displayName)
          : await login(email, password);
      navigate(profile.onboardingCompleted ? '/' : '/onboarding', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-surface-raised p-12 lg:flex">
        <div className="absolute inset-0 bg-[radial-gradient(60rem_40rem_at_15%_-10%,rgb(79_70_229/0.18),transparent)]" />

        <div className="relative flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-500">
            <RouteIcon size={19} className="text-white" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-ink">FutureTech Career Academy</span>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-ink">
            Turn twenty years of enterprise engineering into the next twenty.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-ink-muted">
            A structured transition from .NET, Angular and SQL Server into AI solutions
            architecture — with the hours, the projects and the evidence mapped out.
          </p>

          <ul className="mt-8 space-y-3">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex gap-2.5 text-[13px] leading-relaxed text-ink-muted">
                <ShieldCheck size={15} className="mt-0.5 shrink-0 text-brand-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[11px] leading-relaxed text-ink-faint">
          Hour and week figures on this platform are learning estimates based on your stated study
          time. They are not guarantees of employment, salary or hiring outcomes.
        </p>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-500">
                <RouteIcon size={19} className="text-white" />
              </div>
              <span className="text-sm font-semibold tracking-tight text-ink">FutureTech Academy</span>
            </div>
          </div>

          <h2 className="text-xl font-semibold tracking-tight text-ink">
            {mode === 'register' ? 'Create your account' : 'Sign in'}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            {mode === 'register'
              ? 'Your study plan is built around the hours you actually have.'
              : 'Pick up where you left off.'}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === 'register' && (
              <Field label="Name">
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  required
                />
              </Field>
            )}

            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </Field>

            <Field label="Password" hint={mode === 'register' ? 'At least 8 characters.' : undefined}>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                required
              />
            </Field>

            {error && <ErrorPanel message={error} />}

            <Button type="submit" variant="primary" size="lg" loading={busy} className="w-full">
              {mode === 'register' ? 'Create account' : 'Sign in'}
            </Button>
          </form>

          {DEMO_MODE && (
            <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-200">
              This is a browser-only demo: the full platform runs locally with no API behind it.
              A demo learner is already filled in — select Sign in. Progress is saved to this
              browser only.
            </p>
          )}

          <p className="mt-6 text-center text-xs text-ink-faint">
            {DEMO_MODE ? (
              'Account creation needs the API, which this demo does not run.'
            ) : mode === 'register' ? (
              <>
                Already have an account?{' '}
                <Link to="/login" className="link">
                  Sign in
                </Link>
              </>
            ) : (
              <>
                New here?{' '}
                <Link to="/register" className="link">
                  Create an account
                </Link>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
