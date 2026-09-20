import { api, DEMO_MODE } from '@/lib/api';

/**
 * Reports how long the application is actually open and in front of someone.
 *
 * The access meter in access-provider already counts visible-tab seconds for
 * its own purposes; this sends the same seconds to the server so an
 * administrator can see total time in the application, including for visitors
 * who never create an account.
 */

const VISITOR_KEY = 'futuretech.visitor';

/**
 * A random first-party id for a browser with no account. Not derived from
 * anything about the person or the device, so it identifies a browser that
 * keeps its storage and nothing more.
 */
export function visitorId(): string | null {
  try {
    const existing = localStorage.getItem(VISITOR_KEY);
    if (existing) return existing;

    const created =
      typeof crypto?.randomUUID === 'function'
        ? crypto.randomUUID()
        : `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

    localStorage.setItem(VISITOR_KEY, created);
    return created;
  } catch {
    // Private browsing or blocked storage. Without an id an anonymous beat
    // cannot be attributed, so it is simply not sent.
    return null;
  }
}

export async function sendHeartbeat(seconds: number, signedIn: boolean) {
  if (DEMO_MODE || seconds <= 0) return;

  const id = signedIn ? null : visitorId();
  if (!signedIn && !id) return;

  try {
    await api.post('/usage/heartbeat', { visitorId: id, seconds });
  } catch {
    // Telemetry must never interrupt the person using the product. A dropped
    // beat costs a minute of reporting accuracy and nothing else.
  }
}

/**
 * Last flush when the page is closing. A normal fetch is cancelled on unload,
 * so this goes through the keepalive path, which the browser completes
 * afterwards and which still carries the auth header.
 */
export function flushOnExit(seconds: number, signedIn: boolean) {
  if (DEMO_MODE || seconds <= 0) return;

  const id = signedIn ? null : visitorId();
  if (!signedIn && !id) return;

  api.postKeepalive('/usage/heartbeat', { visitorId: id, seconds });
}
