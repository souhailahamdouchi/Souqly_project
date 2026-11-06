/**
 * HTTP client for the SOUQLY REST API (Laravel 12 + Sanctum Bearer tokens).
 *
 * - Base URL: VITE_API_URL, defaults to the Laravel dev server.
 * - Every JSON response is typed via generics.
 * - Validation errors (422) raise ApiError with the per-field errors map.
 */

export const API_BASE_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://127.0.0.1:8000/api';

const TOKEN_KEY = 'souqly-token';
const SESSION_KEY = 'souqly-session';

export class ApiError extends Error {
  status: number;
  errors: Record<string, string[]>;

  constructor(status: number, message: string, errors?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors ?? {};
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable: ignore */
  }
}

/** Stable guest identity sent as X-Session-Id so guest carts survive reloads. */
export function getSessionId(): string {
  try {
    let sessionId = localStorage.getItem(SESSION_KEY);
    if (!sessionId) {
      sessionId = `guest-${crypto.randomUUID()}`;
      localStorage.setItem(SESSION_KEY, sessionId);
    }
    return sessionId;
  } catch {
    return 'guest-ephemeral';
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
  method?: Method;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(`${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query } = options;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Session-Id': getSessionId(),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new ApiError(0, 'Le serveur SOUQLY est injoignable. Vérifiez que le backend est démarré.');
  }

  const raw = await response.text();
  let payload: unknown = null;
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      /* empty/non-json body */
    }
  }

  if (!response.ok) {
    const data = payload as { message?: string; errors?: Record<string, string[]> } | null;
    const message =
      data?.message ??
      (response.status === 419 ? 'Session expirée, veuillez recharger la page.' : `Erreur ${response.status}`);
    throw new ApiError(response.status, message, data?.errors);
  }

  return payload as T;
}

const http = {
  get: <T>(path: string, query?: RequestOptions['query']) => request<T>(path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export default http;
