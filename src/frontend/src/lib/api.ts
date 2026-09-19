const TOKEN_KEY = 'futuretech.token';

/**
 * Where the API lives.
 *
 * Default `/api` is same-origin: the Vite dev proxy handles it locally, nginx
 * handles it in Docker, and a Netlify `_redirects` proxy handles it in a static
 * deployment. Set VITE_API_BASE_URL to an absolute URL to call a deployed API
 * directly instead — that origin then has to allow this one in Cors:Origins.
 */
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/+$/, '');

/**
 * Demo mode answers every request in the browser from bundled seed content.
 * It exists so a static host with no .NET API behind it is still a working
 * product rather than a shell. Set at build time by VITE_DEMO_MODE.
 */
export const DEMO_MODE: boolean = typeof __DEMO_MODE__ !== 'undefined' && __DEMO_MODE__;

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

/** Loaded on first use so the seed content is a separate chunk. */
let demoModule: typeof import('@/demo') | null = null;

async function demoRequest<T>(
  method: string,
  path: string,
  body: Record<string, unknown> | undefined,
): Promise<T> {
  demoModule ??= await import('@/demo');
  const token = tokenStore.get();
  const { status, payload } = demoModule.demoRequest(method, path, body, token);

  if (status === 204) return undefined as T;

  if (status >= 400) {
    if (status === 401 && token) {
      tokenStore.clear();
      if (!location.pathname.startsWith('/login')) location.assign('/login');
    }
    throw new ApiError(
      status,
      (payload as { message?: string } | null)?.message ?? `Request failed (${status})`,
    );
  }

  return payload as T;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (DEMO_MODE) return demoRequest<T>(method, path, body as Record<string, unknown> | undefined);

  const token = tokenStore.get();

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    // fetch only rejects on a network-level failure. On a static host with no
    // API behind it that is the first thing every user hits, so say what is
    // actually wrong rather than surfacing "Failed to fetch".
    throw new ApiError(
      0,
      `Could not reach the API at ${API_BASE}. If this is a static deployment, the ` +
        `.NET API has to be deployed separately and API_PROXY_TARGET (or ` +
        `VITE_API_BASE_URL) pointed at it.`,
    );
  }

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();

  // A static host with no API proxy answers /api/* with the SPA shell — HTML,
  // and a 200. Without this check the caller would parse markup as data and
  // fail somewhere far from the cause.
  if (text && !contentType.includes('json')) {
    throw new ApiError(
      response.status,
      `The API did not respond at ${API_BASE}${path} — the request was answered by the ` +
        `static host instead. Deploy the .NET API and set API_PROXY_TARGET (or ` +
        `VITE_API_BASE_URL) to point at it.`,
    );
  }

  const payload = text ? safeParse(text) : null;

  if (!response.ok) {
    // An expired or invalid token should bounce the user to sign-in rather than
    // leaving every panel showing a generic failure.
    if (response.status === 401 && token) {
      tokenStore.clear();
      if (!location.pathname.startsWith('/login')) location.assign('/login');
    }

    const message =
      (payload as { message?: string } | null)?.message ?? `Request failed (${response.status})`;
    throw new ApiError(response.status, message);
  }

  return payload as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}),
  del: <T>(path: string) => request<T>('DELETE', path),
};
