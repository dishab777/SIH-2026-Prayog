import i18n from '@/i18n';
import type { ApiError, ApiResponse } from '@/types/models';

export class PrayogApiError extends Error {
  readonly code: string;
  readonly details: string[];
  readonly reference?: string;
  readonly status: number;

  constructor(status: number, error: ApiError['error']) {
    super(error.message);
    this.name = 'PrayogApiError';
    this.status = status;
    this.code = error.code;
    this.details = error.details ?? [];
    this.reference = error.reference;
  }
}

export interface Fetched<T> {
  data: T;
  servedAt: string;
  message?: string;
}

async function call<T>(path: string, init?: RequestInit): Promise<Fetched<T>> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      /*
       * The language the reader is reading, so the API can answer in it. The
       * interface chrome translates through `t()`; the *content* — a challenge
       * title, a department, a problem statement, a unit — cannot, because it
       * is data. This is where a real deployment would negotiate it too.
       */
      'Accept-Language': i18n.language || 'en',
      ...(init?.headers ?? {}),
    },
  });
  /*
   * A body that is not JSON means the request never reached the mock API — the
   * dev server answered it with index.html, which happens while the service
   * worker is still taking control of the page. Saying that beats letting a
   * SyntaxError surface as "the service did not respond", which sends people
   * looking for an outage that is not happening.
   */
  const raw = await response.text();
  let body: ApiResponse<T>;
  try {
    body = JSON.parse(raw) as ApiResponse<T>;
  } catch {
    throw new PrayogApiError(response.status, {
      code: 'MOCK_API_UNAVAILABLE',
      message: 'The mock API has not started yet.',
      details: [
        'This request reached the dev server instead of the mock service worker, which usually means the worker was still starting.',
        'Reloading the page starts it again.',
      ],
    });
  }

  if (!body.success) throw new PrayogApiError(response.status, body.error);
  return { data: body.data, servedAt: body.servedAt, message: body.message };
}

export const api = {
  get: <T>(path: string): Promise<Fetched<T>> => call<T>(path),
  post: <T>(path: string, body?: unknown): Promise<Fetched<T>> =>
    call<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown): Promise<Fetched<T>> =>
    call<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  del: <T>(path: string): Promise<Fetched<T>> => call<T>(path, { method: 'DELETE' }),
};

export function query(params: Record<string, string | number | boolean | string[] | undefined | null>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) value.forEach((v) => search.append(key, v));
    else search.set(key, String(value));
  });
  const s = search.toString();
  return s ? `?${s}` : '';
}
