import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/app/providers';
import { api, DEMO_MODE } from '@/lib/api';
import { flushOnExit, sendHeartbeat } from '@/lib/usage';
import type { Enrollment } from '@/types/api';
import {
  DEFAULT_POLICY,
  addSeconds,
  evaluate,
  noteCourseOpened,
  readUsage,
  resetUsage,
  useAccessPolicy,
  type GateState,
} from '@/lib/access';

/**
 * Counts active time and exposes the gate the policy says is due.
 *
 * "Active" means the tab is visible. A page left open overnight must not spend
 * someone's free hours, which is the difference between a meter people accept
 * and one they think is broken.
 */

const TICK_SECONDS = 15;

/** How much active time accumulates before it is reported. */
const REPORT_SECONDS = 60;

interface AccessContextValue {
  gate: GateState;
  /** Call when a course is opened, so the course-count trigger can see it. */
  courseOpened: (slug: string) => void;
  /** Hides a dismissible prompt for the rest of this session. */
  dismiss: () => void;
  dismissed: boolean;
}

const AccessContext = createContext<AccessContextValue | null>(null);

export function AccessProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const policy = useAccessPolicy();

  const userId = user?.id ?? null;
  const [usage, setUsage] = useState(() => readUsage(userId));
  const [dismissed, setDismissed] = useState(false);

  // Re-read when the identity changes: signing in switches to that account's
  // meter, signing out switches back to the anonymous one.
  useEffect(() => {
    setUsage(readUsage(userId));
    setDismissed(false);
  }, [userId]);

  // Held in a ref so the ticker below can stay a single long-lived interval
  // instead of being torn down and recreated whenever the identity changes.
  const userIdRef = useRef(userId);
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  // Accumulate active time. If the tab is hidden the tick is skipped rather
  // than the timer being torn down, which keeps this to one effect instead of
  // a visibility state machine.
  // Seconds counted but not yet reported to the server. Batched so a reader
  // costs one small request a minute rather than one every tick.
  const unreportedRef = useRef(0);
  const signedInRef = useRef(Boolean(user));
  useEffect(() => {
    signedInRef.current = Boolean(user);
  }, [user]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      setUsage(addSeconds(userIdRef.current, TICK_SECONDS));

      unreportedRef.current += TICK_SECONDS;
      if (unreportedRef.current >= REPORT_SECONDS) {
        const pending = unreportedRef.current;
        unreportedRef.current = 0;
        void sendHeartbeat(pending, signedInRef.current);
      }
    }, TICK_SECONDS * 1000);

    return () => window.clearInterval(id);
  }, []);

  // Whatever has not been reported yet would otherwise be lost when the tab
  // closes or is hidden. pagehide covers closing and the back/forward cache,
  // which is where a plain unload listener misses on mobile Safari.
  useEffect(() => {
    const flush = () => {
      const pending = unreportedRef.current;
      if (pending <= 0) return;
      unreportedRef.current = 0;
      flushOnExit(pending, signedInRef.current);
    };

    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };

    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, []);

  const courseOpened = useCallback((slug: string) => {
    const next = noteCourseOpened(userIdRef.current, slug);
    if (next) setUsage(next);
  }, []);

  // Enrolling is what "has paid" means here, and the enrollment list is the
  // server's own record of it. Only asked for when signed in: anonymous
  // visitors are behind the signup gate, and the endpoint requires a token.
  const enrollments = useQuery({
    queryKey: ['enrollments'],
    queryFn: () => api.get<Enrollment[]>('/enrollments'),
    enabled: !DEMO_MODE && Boolean(user),
    staleTime: 60_000,
  });

  // Administrators are here to run the platform, not to study it. Without this
  // an admin — who has no enrolment — would meet the payment prompt partway
  // through a session in the admin console.
  const hasPaidAccess =
    user?.role === 'Admin' || (enrollments.data ?? []).some((e) => e.status !== 'Withdrawn');

  const gate = useMemo(
    () => evaluate(policy ?? DEFAULT_POLICY, usage, Boolean(user), hasPaidAccess),
    [policy, usage, user, hasPaidAccess],
  );

  // A prompt that was dismissed should come back when the situation changes —
  // a nudge escalating to a wall must not stay hidden.
  const kindRef = useRef(gate.kind);
  useEffect(() => {
    if (kindRef.current !== gate.kind) {
      kindRef.current = gate.kind;
      setDismissed(false);
    }
  }, [gate.kind]);

  const value = useMemo<AccessContextValue>(
    () => ({ gate, courseOpened, dismiss: () => setDismissed(true), dismissed }),
    [gate, courseOpened, dismissed],
  );

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess() {
  const context = useContext(AccessContext);
  if (!context) throw new Error('useAccess must be used inside AccessProvider');
  return context;
}

/** Clears the anonymous meter once its reader has an account of their own. */
export function clearAnonymousUsage() {
  resetUsage(null);
}
