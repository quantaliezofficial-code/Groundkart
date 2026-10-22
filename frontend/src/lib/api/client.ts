/**
 * Thin fetch wrapper for the GroundKart API. A few things worth
 * reading the comments on, not just the code:
 *
 * - The access token lives in a module-level variable, not localStorage/
 *   sessionStorage — 08_Frontend_Design.md §6 flags browser storage as an
 *   XSS-readable place to keep a bearer token; a variable that resets on
 *   page reload is deliberately less convenient but meaningfully safer.
 *   The refresh token is an httpOnly cookie the backend sets directly
 *   (see _set_refresh_cookie in the backend's app/main.py) — JS can't
 *   read it even if it wanted to, so `credentials: 'include'` is what
 *   lets it travel automatically, not any code here.
 * - restoreSession() (called once, on app mount) is what makes a page
 *   refresh not force a re-login: it silently tries /auth/refresh using
 *   whatever refresh cookie the browser already has, before the app
 *   renders anything that depends on knowing who's logged in.
 * - A single in-flight refresh is coalesced (refreshPromise) so N
 *   simultaneous 401s from N simultaneous requests don't each try to
 *   refresh independently.
 */

const API_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:8000';

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export class ApiError extends Error {
  status: number;
  detail: string;
  data?: any;
  retryAfterSeconds?: number;
  constructor(status: number, detail: string, data?: any, retryAfterSeconds?: number) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
    this.data = data;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Don't attach the Authorization header even if we have a token — used for signup/login themselves. */
  skipAuth?: boolean;
  /** Don't attempt a refresh-and-retry on 401 — used for the refresh call itself, to avoid recursing forever. */
  skipRefreshRetry?: boolean;
  query?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  retryCount?: number;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(`${API_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!res.ok) {
          setAccessToken(null);
          return false;
        }
        const data = (await res.json()) as { access_token: string };
        setAccessToken(data.access_token);
        return true;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

/** Called once on app mount — see module docstring above. */
export async function restoreSession(): Promise<boolean> {
  return tryRefresh();
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (!options.skipAuth && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const hasIdemKey = Boolean(headers['Idempotency-Key']);
  const maxRetries = hasIdemKey ? 3 : 0;
  const attempt = options.retryCount || 0;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method || 'GET',
      headers,
      credentials: 'include',
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch (err) {
    if (hasIdemKey && attempt < maxRetries) {
      const delayMs = Math.pow(2, attempt) * 300;
      await new Promise((r) => setTimeout(r, delayMs));
      return request<T>(path, { ...options, retryCount: attempt + 1 });
    }
    throw err;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await response.json() : null;

  if (!response.ok) {
    if (response.status === 401 && !options.skipRefreshRetry && !options.skipAuth) {
      const refreshed = await tryRefresh();
      if (refreshed) {
        return request<T>(path, { ...options, skipRefreshRetry: true });
      }
    }

    if (response.status === 409 && hasIdemKey && attempt < maxRetries) {
      const retryAfterHeader = response.headers.get('Retry-After');
      const waitMs = retryAfterHeader ? Math.max(1, parseInt(retryAfterHeader, 10)) * 1000 : 1000;
      await new Promise((r) => setTimeout(r, waitMs));
      return request<T>(path, { ...options, retryCount: attempt + 1 });
    }

    if (response.status >= 500 && hasIdemKey && attempt < maxRetries) {
      const delayMs = Math.pow(2, attempt) * 300;
      await new Promise((r) => setTimeout(r, delayMs));
      return request<T>(path, { ...options, retryCount: attempt + 1 });
    }

    const retryAfterHeader = response.headers.get('Retry-After');
    const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
    const detail =
      typeof data?.detail === 'string' ? data.detail : data?.detail ? JSON.stringify(data.detail) : response.statusText;
    throw new ApiError(response.status, detail, data, retryAfterSeconds);
  }

  return data as T;
}

async function requestForm<T>(
  path: string,
  formData: FormData,
  options: Pick<RequestOptions, 'skipRefreshRetry'> = {}
): Promise<T> {
  // Deliberately NOT setting Content-Type here — the browser sets its own
  // `multipart/form-data; boundary=...` header from the FormData object,
  // and overriding it manually (as request()'s JSON path does) breaks the
  // multipart encoding entirely. This is the one place in this client that
  // isn't a plain JSON body, which is why it's a separate function rather
  // than another branch inside request().
  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const response = await fetch(buildUrl(path), {
    method: 'POST',
    headers,
    credentials: 'include',
    body: formData,
  });

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await response.json() : null;

  if (!response.ok) {
    if (response.status === 401 && !options.skipRefreshRetry) {
      const refreshed = await tryRefresh();
      if (refreshed) {
        return requestForm<T>(path, formData, { skipRefreshRetry: true });
      }
    }
    const retryAfterHeader = response.headers.get('Retry-After');
    const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
    const detail =
      typeof data?.detail === 'string' ? data.detail : data?.detail ? JSON.stringify(data.detail) : response.statusText;
    throw new ApiError(response.status, detail, data, retryAfterSeconds);
  }

  return data as T;
}

export const api = {
  get: <T,>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'GET' }),
  post: <T,>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body }),
  put: <T,>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  patch: <T,>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T,>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'DELETE' }),
  postForm: <T,>(path: string, formData: FormData) => requestForm<T>(path, formData),
};
