import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Lock, Sparkles, X } from 'lucide-react';
import { useAccess } from '@/app/access-provider';
import { Button } from '@/components/ui';

/**
 * Renders whichever free-access prompt the policy says is due.
 *
 * Two shapes. A nudge is a dismissible strip that leaves the page usable. A
 * wall covers the content and cannot be dismissed — the reader either signs up,
 * signs in, or leaves. Which one appears, and when, is configured in Admin.
 */
export function AccessGate() {
  const { gate, dismiss, dismissed } = useAccess();
  const location = useLocation();

  // The sign-in and registration screens are how someone answers the prompt.
  // Covering them with the prompt itself would trap the reader.
  const onAuthRoute = ['/login', '/register'].some((p) => location.pathname.startsWith(p));

  // A wall implies the page behind it must not scroll away under it.
  useEffect(() => {
    if (gate.blocking && !onAuthRoute) {
      const previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = previous;
      };
    }
    return undefined;
  }, [gate.blocking, onAuthRoute]);

  if (gate.kind === 'none' || onAuthRoute) return null;
  if (!gate.blocking && dismissed) return null;

  const isPayment = gate.kind === 'payment-nudge' || gate.kind === 'payment-wall';

  if (!gate.blocking) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4">
        <div className="pointer-events-auto flex w-full max-w-2xl items-start gap-3 rounded-xl border border-brand-500/40 bg-surface-overlay/95 p-4 shadow-lg backdrop-blur">
          <Sparkles size={18} className="mt-0.5 shrink-0 text-brand-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">{gate.title}</p>
            <p className="mt-0.5 text-xs text-ink-muted">{gate.body}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link to={isPayment ? '/my-learning' : '/register'}>
              <Button size="sm" variant="primary">
                {isPayment ? 'See options' : 'Create free account'}
              </Button>
            </Link>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss"
              className="rounded-md p-1 text-ink-faint transition hover:bg-surface-sunken hover:text-ink"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="access-gate-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-surface-base/80 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface-raised p-6 shadow-2xl">
        <div className="flex size-10 items-center justify-center rounded-xl border border-brand-500/40 bg-brand-500/10">
          <Lock size={18} className="text-brand-400" />
        </div>

        <h2 id="access-gate-title" className="mt-4 text-lg font-semibold text-ink">
          {gate.title}
        </h2>
        <p className="mt-2 text-sm text-ink-muted">{gate.body}</p>

        {gate.minutesAllowed > 0 && (
          <p className="mt-3 text-xs text-ink-faint">
            You read for {formatMinutes(gate.minutesUsed)} of the {formatMinutes(gate.minutesAllowed)} available
            {gate.coursesAllowed > 0 && `, across ${gate.coursesOpened} course${gate.coursesOpened === 1 ? '' : 's'}`}.
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <Link to={isPayment ? '/my-learning' : '/register'}>
            <Button variant="primary">{isPayment ? 'See options' : 'Create free account'}</Button>
          </Link>
          {!isPayment && (
            <Link to="/login">
              <Button variant="secondary">Sign in</Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function formatMinutes(total: number) {
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}
