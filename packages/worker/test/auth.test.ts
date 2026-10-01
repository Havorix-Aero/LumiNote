import { ApiError, PBKDF2_ITERATIONS, isApiError } from '@luminote/core';
import { describe, expect, it } from 'vitest';
import { hashAnswer, normalizeAnswer, verifyAnswer } from '../src/crypto/answers';
import { hashPassword, verifyPassword } from '../src/crypto/password';
import { totpAt, totpForCounter, verifyTotp } from '../src/crypto/totp';
import {
  Client,
  CSRF_COOKIE,
  SESSION_COOKIE,
  STRONG_PASSWORD,
  enableTwoFactor,
  registerUser,
  setSecurityQuestions,
} from './support';

describe('password hashing', () => {
  it('verifies a correct password', async () => {
    const stored = await hashPassword(STRONG_PASSWORD, { iterations: 1000 });
    expect(await verifyPassword(STRONG_PASSWORD, stored)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const stored = await hashPassword(STRONG_PASSWORD, { iterations: 1000 });
    expect(await verifyPassword('nope', stored)).toBe(false);
  });

  it('uses a different salt each time', async () => {
    const a = await hashPassword('same', { iterations: 1000 });
    const b = await hashPassword('same', { iterations: 1000 });
    expect(a.passwordHash).not.toBe(b.passwordHash);
  });

  it('records the parameters so they can be raised later', async () => {
    const stored = await hashPassword('x', { iterations: 1234 });
    expect(JSON.parse(stored.paramsJson).iterations).toBe(1234);
  });

  it('stays within the iteration ceiling the Workers runtime enforces', () => {
    // `workerd` locally accepts larger counts, so raising this only fails once deployed.
    expect(PBKDF2_ITERATIONS).toBeLessThanOrEqual(100_000);
  });
});

describe('security answers', () => {
  it('normalizes case, width and whitespace', () => {
    expect(normalizeAnswer('  Ｂｌｕｅ   Sky ')).toBe('blue sky');
  });

  it('verifies equivalent answers', async () => {
    const { hash, salt } = await hashAnswer('Blue Sky');
    expect(await verifyAnswer('  blue   sky ', hash, salt)).toBe(true);
    expect(await verifyAnswer('green sky', hash, salt)).toBe(false);
  });
});

describe('TOTP', () => {
  it('accepts the current code and rejects a random one', async () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    expect(await verifyTotp(secret, await totpAt(secret))).toBe(true);
    expect(await verifyTotp(secret, '000000')).toBe(false);
  });

  it('matches the RFC 6238 SHA-1 test vector', async () => {
    // Secret is the ASCII string "12345678901234567890"; at T=59s the counter is 1.
    const rfcSecret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
    expect(await totpForCounter(rfcSecret, 1)).toBe('287082');
  });
});

describe('registration and sessions', () => {
  it('registers, issues cookies and returns the session', async () => {
    const client = new Client();
    await registerUser(client, 'alice');

    expect(client.cookie(SESSION_COOKIE)).toBeTruthy();
    expect(client.cookie(CSRF_COOKIE)).toBeTruthy();

    const session = await client.request<{ session: { user: { username: string } } }>(
      '/api/v1/auth/session',
    );
    expect(session.status).toBe(200);
    expect(session.body.session.user.username).toBe('alice');
  });

  it('rejects a duplicate username', async () => {
    const first = new Client();
    await registerUser(first, 'bob');

    const second = new Client();
    const result = await second.request('/api/v1/auth/register', {
      method: 'POST',
      json: { username: 'bob', password: STRONG_PASSWORD },
    });
    expect(result.status).toBe(409);
  });

  it('rejects a short password', async () => {
    const client = new Client();
    const result = await client.request('/api/v1/auth/register', {
      method: 'POST',
      json: { username: 'shorty', password: 'abc' },
    });
    expect(result.status).toBe(422);
  });

  it('requires authentication for the session endpoint', async () => {
    const client = new Client();
    expect((await client.request('/api/v1/auth/session')).status).toBe(401);
  });

  it('rejects a login with the wrong password', async () => {
    const client = new Client();
    await registerUser(client, 'carol');

    const fresh = new Client();
    const result = await fresh.request('/api/v1/auth/login', {
      method: 'POST',
      json: { username: 'carol', password: 'definitely-wrong' },
    });
    expect(result.status).toBe(401);
  });

  it('blocks state-changing requests that omit the CSRF header', async () => {
    const client = new Client();
    await registerUser(client, 'dave');

    const created = await client.request('/api/v1/notes', {
      method: 'POST',
      json: { body: '第一条灵感' },
    });
    expect(created.status).toBe(201);

    const blocked = await client.request(
      '/api/v1/notes',
      { method: 'POST', json: { body: '被拦截' } },
      { skipCsrf: true },
    );
    expect(blocked.status).toBe(403);
  });

  it('invalidates the session on logout', async () => {
    const client = new Client();
    await registerUser(client, 'erin');
    await client.request('/api/v1/auth/logout', { method: 'POST' });
    expect((await client.request('/api/v1/auth/session')).status).toBe(401);
  });
});

describe('two-factor authentication', () => {
  it('challenges an untrusted device and accepts a valid code', async () => {
    const owner = new Client();
    await registerUser(owner, 'frank');
    const secret = await enableTwoFactor(owner);
    await owner.request('/api/v1/auth/logout', { method: 'POST' });

    const phone = new Client();
    const login = await phone.request<{
      status: string;
      challengeToken: string;
      recoveryAvailable: boolean;
    }>('/api/v1/auth/login', {
      method: 'POST',
      json: { username: 'frank', password: STRONG_PASSWORD },
    });
    expect(login.body.status).toBe('two_fa_required');
    expect(login.body.recoveryAvailable).toBe(false);
    expect(phone.cookie(SESSION_COOKIE)).toBeUndefined();

    const verified = await phone.request('/api/v1/auth/2fa/verify', {
      method: 'POST',
      json: { challengeToken: login.body.challengeToken, code: await totpAt(secret) },
    });
    expect(verified.status).toBe(200);
    expect(phone.cookie(SESSION_COOKIE)).toBeTruthy();
  });

  it('rejects an incorrect code', async () => {
    const owner = new Client();
    await registerUser(owner, 'grace');
    await enableTwoFactor(owner);
    await owner.request('/api/v1/auth/logout', { method: 'POST' });

    const phone = new Client();
    const login = await phone.request<{ challengeToken: string }>('/api/v1/auth/login', {
      method: 'POST',
      json: { username: 'grace', password: STRONG_PASSWORD },
    });
    const bad = await phone.request('/api/v1/auth/2fa/verify', {
      method: 'POST',
      json: { challengeToken: login.body.challengeToken, code: '000000' },
    });
    expect(bad.status).toBe(401);
  });
});

describe('security-question recovery', () => {
  it('consumes one question, then forces a full re-provision', async () => {
    const owner = new Client();
    await registerUser(owner, 'heidi');
    await enableTwoFactor(owner);
    await setSecurityQuestions(owner, ['first_pet', 'childhood_street', 'favorite_book']);
    await owner.request('/api/v1/auth/logout', { method: 'POST' });

    const laptop = new Client();
    const login = await laptop.request<{
      status: string;
      challengeToken: string;
      recoveryAvailable: boolean;
    }>('/api/v1/auth/login', {
      method: 'POST',
      json: { username: 'heidi', password: STRONG_PASSWORD },
    });
    expect(login.body.recoveryAvailable).toBe(true);

    const started = await laptop.request<{
      recoveryToken: string;
      question: { key: string; prompt: string };
    }>('/api/v1/auth/recovery/start', {
      method: 'POST',
      json: { challengeToken: login.body.challengeToken },
    });
    expect(started.status).toBe(200);
    const askedKey = started.body.question.key;

    const wrong = await laptop.request('/api/v1/auth/recovery/verify', {
      method: 'POST',
      json: { recoveryToken: started.body.recoveryToken, answer: 'not-the-answer' },
    });
    expect(wrong.status).toBe(401);

    const verified = await laptop.request<{
      status: string;
      session: {
        scope: string;
        user: { mustResetQuestions: boolean; unusedSecurityQuestions: number };
      };
    }>('/api/v1/auth/recovery/verify', {
      method: 'POST',
      json: {
        recoveryToken: started.body.recoveryToken,
        answer: `answer-${askedKey}`,
      },
    });
    expect(verified.status).toBe(200);
    expect(verified.body.session.scope).toBe('recovery');
    expect(verified.body.session.user.mustResetQuestions).toBe(true);
    expect(verified.body.session.user.unusedSecurityQuestions).toBe(2);

    // The workspace stays closed until every question has been re-provisioned.
    const blocked = await laptop.request('/api/v1/notes');
    expect(blocked.status).toBe(403);

    const reset = await laptop.request('/api/v1/me/security-questions', {
      method: 'PUT',
      json: {
        answers: [
          { key: 'first_pet', answer: 'new answer' },
          { key: 'childhood_street', answer: 'another answer' },
          { key: 'favorite_book', answer: 'a third answer' },
        ],
      },
    });
    expect(reset.status).toBe(200);

    const allowed = await laptop.request('/api/v1/notes');
    expect(allowed.status).toBe(200);
  });

  it('rejects recovery when no question is available', async () => {
    const owner = new Client();
    await registerUser(owner, 'ivan');
    await enableTwoFactor(owner);
    await owner.request('/api/v1/auth/logout', { method: 'POST' });

    const phone = new Client();
    const login = await phone.request<{ challengeToken: string; recoveryAvailable: boolean }>(
      '/api/v1/auth/login',
      { method: 'POST', json: { username: 'ivan', password: STRONG_PASSWORD } },
    );
    expect(login.body.recoveryAvailable).toBe(false);

    const started = await phone.request('/api/v1/auth/recovery/start', {
      method: 'POST',
      json: { challengeToken: login.body.challengeToken },
    });
    expect(started.status).toBe(409);
  });
});

describe('ApiError', () => {
  it('maps codes to statuses', () => {
    const error = new ApiError('not_found', 'missing');
    expect(error.status).toBe(404);
    expect(isApiError(error)).toBe(true);
  });
});
