import { env } from 'cloudflare:test';
import { createApiApp } from '../src/app';
import { totpAt } from '../src/crypto/totp';
import type { Env } from '../src/env';

export const testEnv = env as unknown as Env;

const app = createApiApp();

export const SESSION_COOKIE = 'luminote_session';
export const CSRF_COOKIE = 'luminote_csrf';
export const STRONG_PASSWORD = 'correct horse battery staple';

export interface ApiResult<T> {
  status: number;
  body: T;
  response: Response;
}

/**
 * Cookie-aware test client.
 *
 * Drives the real Hono app with the real D1 binding, including the CSRF double-submit header a
 * browser would have to send, so the security middleware is exercised rather than bypassed.
 */
export class Client {
  private cookies = new Map<string, string>();

  cookie(name: string): string | undefined {
    return this.cookies.get(name);
  }

  async request<T = unknown>(
    path: string,
    init: RequestInit & { json?: unknown } = {},
    options: { skipCsrf?: boolean; raw?: boolean } = {},
  ): Promise<ApiResult<T>> {
    const headers = new Headers(init.headers);
    if (this.cookies.size > 0) {
      headers.set(
        'cookie',
        [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join('; '),
      );
    }
    const method = (init.method ?? 'GET').toUpperCase();
    if (method !== 'GET' && !options.skipCsrf) {
      const csrf = this.cookies.get(CSRF_COOKIE);
      if (csrf) headers.set('x-luminote-csrf', csrf);
    }
    if (init.json !== undefined) headers.set('content-type', 'application/json');

    const response = await app.request(
      `https://luminote.test${path}`,
      {
        ...init,
        method,
        headers,
        body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
      },
      testEnv,
    );

    absorbCookies(this.cookies, response);

    if (options.raw) {
      return { status: response.status, body: null as T, response };
    }

    const text = await response.text();
    const body = (text.length > 0 ? JSON.parse(text) : null) as T;
    return { status: response.status, body, response };
  }
}

function absorbCookies(store: Map<string, string>, response: Response): void {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const lines =
    typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : (headers.get('set-cookie') ?? '').split(/,(?=[^;=]+=)/);

  for (const line of lines) {
    if (!line) continue;
    const pair = line.split(';')[0];
    if (!pair) continue;
    const separator = pair.indexOf('=');
    if (separator < 0) continue;
    const name = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    if (value.length === 0) store.delete(name);
    else store.set(name, value);
  }
}

export async function registerUser(client: Client, username: string): Promise<void> {
  const result = await client.request('/api/v1/auth/register', {
    method: 'POST',
    json: {
      username,
      password: STRONG_PASSWORD,
      device: { label: '测试设备', platform: 'web-desktop' },
    },
  });
  if (result.status !== 200) {
    throw new Error(`register failed: ${result.status} ${JSON.stringify(result.body)}`);
  }
}

export async function loginUser(client: Client, username: string): Promise<void> {
  const result = await client.request('/api/v1/auth/login', {
    method: 'POST',
    json: {
      username,
      password: STRONG_PASSWORD,
      device: { label: '测试设备', platform: 'web-mobile' },
    },
  });
  if (result.status !== 200) {
    throw new Error(`login failed: ${result.status} ${JSON.stringify(result.body)}`);
  }
}

/** Enables 2FA and returns the plaintext secret so tests can mint valid codes. */
export async function enableTwoFactor(client: Client): Promise<string> {
  const setup = await client.request<{ secret: string }>('/api/v1/me/2fa/setup', {
    method: 'POST',
  });
  const secret = setup.body.secret;
  const enabled = await client.request('/api/v1/me/2fa/enable', {
    method: 'POST',
    json: { code: await totpAt(secret) },
  });
  if (enabled.status !== 200) {
    throw new Error(`enable 2fa failed: ${enabled.status} ${JSON.stringify(enabled.body)}`);
  }
  return secret;
}

export async function setSecurityQuestions(client: Client, keys: string[]): Promise<void> {
  const result = await client.request('/api/v1/me/security-questions', {
    method: 'PUT',
    json: { answers: keys.map((key) => ({ key, answer: `answer-${key}` })) },
  });
  if (result.status !== 200) {
    throw new Error(`set questions failed: ${result.status} ${JSON.stringify(result.body)}`);
  }
}
