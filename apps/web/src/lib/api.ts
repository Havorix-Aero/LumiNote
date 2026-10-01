import { CSRF_COOKIE, CSRF_HEADER } from '@luminote/core';

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;

  constructor(code: string, message: string, status: number, details: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  for (const part of document.cookie.split('; ')) {
    if (part.startsWith(prefix)) return decodeURIComponent(part.slice(prefix.length));
  }
  return null;
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  json?: unknown;
  body?: BodyInit;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/**
 * Thin fetch wrapper.
 *
 * The API is same-origin and cookie-authenticated, so the only thing worth centralizing is the
 * double-submit CSRF header and the structured error shape.
 */
export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = { accept: 'application/json', ...options.headers };

  if (options.json !== undefined) {
    headers['content-type'] = 'application/json';
  }
  if (method !== 'GET') {
    const csrf = readCookie(CSRF_COOKIE);
    if (csrf) headers[CSRF_HEADER] = csrf;
  }

  const response = await fetch(path, {
    method,
    headers,
    credentials: 'same-origin',
    body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
    signal: options.signal,
  });

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload = text.length > 0 ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const shape = payload as {
      error?: { code?: string; message?: string; details?: unknown };
    } | null;
    throw new ApiClientError(
      shape?.error?.code ?? 'unknown',
      shape?.error?.message ?? `请求失败 (${response.status})`,
      response.status,
      shape?.error?.details,
    );
  }

  return payload as T;
}
