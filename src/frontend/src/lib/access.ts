import { useQuery } from '@tanstack/react-query';
import { api, DEMO_MODE } from '@/lib/api';
import type { AccessPolicy } from '@/types/api';

/**
 * Free-access metering.
 *
 * How much someone may read before being asked to create an account, and how
 * much a signed-in learner may study before being asked to pay, are operator
 * decisions held in the database and edited in Admin. This module fetches them
 * and measures usage against them.
 *
 * Usage is measured in the browser, because an anonymous visitor has no
 * server-side identity to attribute minutes to. That makes it defeatable by
 * clearing site data, which is accepted: the gate exists to ask a willing
 * reader at a sensible moment, not to protect paid content. Anything that must
 * not be read without paying is enforced by enrollment on the server.
 */

/**
 * Used before the policy arrives, and for the whole of demo mode where there is
 * no API to ask. Matches the entity's defaults, so a slow network shows the
 * same thresholds the server would have sent rather than briefly gating on
 * different numbers.
 */
export const DEFAULT_POLICY: AccessPolicy = {
  allowAnonymousBrowsing: true,
  freeMinutesBeforeSignup: 180,
  signupNudgeAtPercent: 80,
  freeMinutesBeforePayment: 600,
  freeCoursesBeforePayment: 2,
  paymentPromptBlocks: false,
  signupPromptTitle: 'Your free preview has ended',
  signupPromptBody:
    'Create a free account to keep reading, save your progress and pick up where you left off.',
  paymentPromptTitle: 'Continue with full access',
  paymentPromptBody: 'You have used the free allowance. Enrol to keep going and earn a certificate.',
};

export function useAccessPolicy() {
  const query = useQuery({
    queryKey: ['access-policy'],
    queryFn: () => api.get<AccessPolicy>('/access-policy'),
    enabled: !DEMO_MODE,
    staleTime: 10 * 60 * 1000,
    // A gate that fails closed because the network blipped would lock a reader
    // out of content the operator meant to be open.
    retry: 1,
  });

  return query.data ?? DEFAULT_POLICY;
}

// ---------- the usage meter ----------

interface Usage {
  /** Active seconds, counted only while the tab is visible. */
  seconds: number;
  /** Slugs of courses opened, so re-opening one does not count twice. */
  courses: string[];
}

const EMPTY: Usage = { seconds: 0, courses: [] };

/**
 * Separate keys for anonymous and signed-in use. Signing up should hand someone
 * a fresh allowance against the payment threshold rather than immediately
 * spending it on the hours they read before creating the account.
 */
function storageKey(userId: string | null) {
  return userId ? `futuretech.usage.${userId}` : 'futuretech.usage.anon';
}

export function readUsage(userId: string | null): Usage {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Usage>;
    return {
      seconds: typeof parsed.seconds === 'number' && parsed.seconds >= 0 ? parsed.seconds : 0,
      courses: Array.isArray(parsed.courses) ? parsed.courses.filter((c) => typeof c === 'string') : [],
    };
  } catch {
    // Private browsing, blocked site data, or a value another tab corrupted.
    // An unreadable meter reads as unused, which keeps content open.
    return EMPTY;
  }
}

function writeUsage(userId: string | null, usage: Usage) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(usage));
  } catch {
    // Storage full or blocked. The in-memory count still drives this session.
  }
}

export function addSeconds(userId: string | null, seconds: number): Usage {
  const usage = readUsage(userId);
  const next = { ...usage, seconds: usage.seconds + seconds };
  writeUsage(userId, next);
  return next;
}

/** Returns the updated usage, or null when this course was already counted. */
export function noteCourseOpened(userId: string | null, slug: string): Usage | null {
  const usage = readUsage(userId);
  if (usage.courses.includes(slug)) return null;

  const next = { ...usage, courses: [...usage.courses, slug] };
  writeUsage(userId, next);
  return next;
}

export function resetUsage(userId: string | null) {
  try {
    localStorage.removeItem(storageKey(userId));
  } catch {
    /* nothing to do */
  }
}

// ---------- evaluating the policy ----------

export type GateKind = 'none' | 'signup-nudge' | 'signup-wall' | 'payment-nudge' | 'payment-wall';

export interface GateState {
  kind: GateKind;
  /** Whether the reader is blocked, as opposed to merely prompted. */
  blocking: boolean;
  minutesUsed: number;
  minutesAllowed: number;
  coursesOpened: number;
  coursesAllowed: number;
  title: string;
  body: string;
}

/**
 * Decides which prompt, if any, is due. Pure, so the rules are readable in one
 * place and testable without a browser.
 */
export function evaluate(
  policy: AccessPolicy,
  usage: Usage,
  signedIn: boolean,
  hasPaidAccess: boolean,
): GateState {
  const minutesUsed = Math.floor(usage.seconds / 60);
  const base = {
    minutesUsed,
    coursesOpened: usage.courses.length,
    minutesAllowed: signedIn ? policy.freeMinutesBeforePayment : policy.freeMinutesBeforeSignup,
    coursesAllowed: signedIn ? policy.freeCoursesBeforePayment : 0,
  };
  const none: GateState = { ...base, kind: 'none', blocking: false, title: '', body: '' };

  if (!signedIn) {
    if (!policy.allowAnonymousBrowsing) {
      return { ...base, kind: 'signup-wall', blocking: true, title: policy.signupPromptTitle, body: policy.signupPromptBody };
    }

    const allowed = policy.freeMinutesBeforeSignup;
    if (minutesUsed >= allowed) {
      return { ...base, kind: 'signup-wall', blocking: true, title: policy.signupPromptTitle, body: policy.signupPromptBody };
    }

    // 100% disables the nudge: the wall is the first thing the reader meets.
    const nudgeAt = (allowed * policy.signupNudgeAtPercent) / 100;
    if (policy.signupNudgeAtPercent < 100 && minutesUsed >= nudgeAt) {
      return {
        ...base,
        kind: 'signup-nudge',
        blocking: false,
        title: 'Save your progress',
        body: `You have used ${minutesUsed} of ${allowed} free minutes. A free account keeps your progress and picks up where you left off.`,
      };
    }

    return none;
  }

  // Paid learners are past every gate this policy describes.
  if (hasPaidAccess) return none;

  // Zero means "this trigger is off", not "no allowance at all".
  const overTime = policy.freeMinutesBeforePayment > 0 && minutesUsed >= policy.freeMinutesBeforePayment;
  const overCourses =
    policy.freeCoursesBeforePayment > 0 && usage.courses.length >= policy.freeCoursesBeforePayment;

  if (!overTime && !overCourses) return none;

  return {
    ...base,
    kind: policy.paymentPromptBlocks ? 'payment-wall' : 'payment-nudge',
    blocking: policy.paymentPromptBlocks,
    title: policy.paymentPromptTitle,
    body: policy.paymentPromptBody,
  };
}
