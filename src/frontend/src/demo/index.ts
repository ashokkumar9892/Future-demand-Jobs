/**
 * Demo mode entry point.
 *
 * Answers the same routes the .NET API exposes, from seed content bundled at
 * build time plus per-browser state. Enabled by VITE_DEMO_MODE=true, which the
 * Netlify build sets; every other deployment talks to the real API.
 */
import { DemoHttpError, sessionFor } from './shared';
import { handleLearning, login } from './handlers';

export interface DemoResponse {
  status: number;
  payload: unknown;
}

export function demoRequest(
  method: string,
  path: string,
  body: Record<string, unknown> | undefined,
  token: string | null,
): DemoResponse {
  const [rawPath, queryString] = path.split('?');
  const query = new URLSearchParams(queryString ?? '');
  const segments = rawPath.split('/').filter(Boolean);
  const route = `${method} /${segments.join('/')}`;

  try {
    // Sign-in runs before a session exists.
    if (route === 'POST /auth/login') {
      return {
        status: 200,
        payload: login(String(body?.email ?? ''), String(body?.password ?? '')),
      };
    }

    if (route === 'POST /auth/register') {
      throw new DemoHttpError(
        400,
        'This demo runs entirely in your browser, so new accounts need the API. ' +
          'Sign in with demo@futuretech.local / Demo#2026.',
      );
    }

    const { state } = sessionFor(token);
    const payload = handleLearning(method, segments, route, query, body, state);

    // Mirrors the API: no content rather than a null body.
    return payload === undefined ? { status: 204, payload: null } : { status: 200, payload };
  } catch (error) {
    if (error instanceof DemoHttpError) {
      return { status: error.status, payload: { status: error.status, message: error.message } };
    }
    // An unexpected failure in demo mode is a bug here, not a server error;
    // surface it rather than swallowing it into a generic 500.
    const message = error instanceof Error ? error.message : 'Demo request failed.';
    // eslint-disable-next-line no-console
    console.error('[demo] unhandled error for', route, error);
    return { status: 500, payload: { status: 500, message: `Demo error: ${message}` } };
  }
}
