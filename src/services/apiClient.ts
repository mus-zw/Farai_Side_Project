import axios from 'axios';

/**
 * Shared backend addressing and error handling for every API call.
 *
 * The backend location is a *base* URL (e.g. http://localhost:8000). Each
 * service appends its own /api/... path, so one override in the API Config
 * panel redirects image, video and comparison calls together.
 */

// In development the Vite dev server (port 3000) and the backend (8000) are
// separate, so default to the backend's port. A production build is normally
// served *by* the backend (FRONTEND_DIST), so default to the page's own
// origin; that keeps working behind a tunnel or on a non-default port.
// Each variable is read by name (never as the whole import.meta.env object), so the build inlines
// only these two and nothing else, such as the fitness preview key, leaks into the bundle.
const ENV_BACKEND_URL: string =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV || typeof window === 'undefined' ? 'http://localhost:8000' : window.location.origin);

const BASE_URL_STORAGE_KEY = 'farai_cv_backend_base_url';
// Older builds stored the full /api/detect endpoint under this key.
const LEGACY_ENDPOINT_STORAGE_KEY = 'farai_cv_backend_url';

function normaliseBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '').replace(/\/api\/detect$/, '');
}

export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return normaliseBaseUrl(ENV_BACKEND_URL);

  try {
    const stored = localStorage.getItem(BASE_URL_STORAGE_KEY);
    if (stored) return normaliseBaseUrl(stored);

    // One-time migration from the legacy full-endpoint value.
    const legacy = localStorage.getItem(LEGACY_ENDPOINT_STORAGE_KEY);
    if (legacy) {
      const migrated = normaliseBaseUrl(legacy);
      localStorage.setItem(BASE_URL_STORAGE_KEY, migrated);
      localStorage.removeItem(LEGACY_ENDPOINT_STORAGE_KEY);
      return migrated;
    }
  } catch {
    // Storage can be unavailable (private mode); fall through to the env default.
  }
  return normaliseBaseUrl(ENV_BACKEND_URL);
}

export function setApiBaseUrl(url: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(BASE_URL_STORAGE_KEY, normaliseBaseUrl(url));
  } catch {
    // Not persisting is acceptable; the env default still applies.
  }
}

export function apiUrl(path: string): string {
  return `${getApiBaseUrl()}${path}`;
}

export class ApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Pulls the human-readable message out of a FastAPI error body. */
function serverDetail(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return typeof data === 'string' && data ? data : undefined;
  const detail = (data as { detail?: unknown }).detail;
  if (typeof detail === 'string') return detail;
  // Validation errors (422) arrive as a list of {loc, msg}.
  if (Array.isArray(detail)) {
    return detail
      .map((d: any) => (d?.loc ? `${d.loc.join('.')}: ${d.msg}` : d?.msg))
      .filter(Boolean)
      .join('; ');
  }
  return undefined;
}

/**
 * Turns any axios failure into an ApiError whose message says plainly what
 * went wrong, so the UI can show it as-is.
 */
export function toApiError(err: any, url: string, timeoutMs: number): Error {
  if (axios.isCancel(err) || err?.name === 'CanceledError') {
    return new ApiError('Request was canceled.');
  }
  if (err?.code === 'ECONNABORTED' || err?.code === 'ETIMEDOUT') {
    return new ApiError(`Timed out: ${url} did not respond within ${Math.round(timeoutMs / 1000)}s.`);
  }
  if (err?.response) {
    const status: number = err.response.status;
    const detail = serverDetail(err.response.data) || err.response.statusText || 'Request failed';
    return new ApiError(`Backend returned HTTP ${status}: ${detail}`, status);
  }
  // No response at all: the browser cannot tell connection refused from a
  // CORS rejection, so name both rather than guess.
  return new ApiError(
    `Cannot reach the backend at ${url} (connection refused, server not running, or blocked by CORS).`
  );
}
