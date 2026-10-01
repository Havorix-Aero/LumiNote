import {
  ApiError,
  CSRF_COOKIE,
  CSRF_HEADER,
  ERROR_CODES,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  epochSecondsFromIso,
  epochSecondsNow,
  isoFromEpochSeconds,
  nowIso,
} from '@luminote/core';
import type { Context, MiddlewareHandler } from 'hono';
import { hashToken, sha256Hex } from '../crypto/tokens';
import {
  findDevice,
  findRecoveryState,
  findSessionByTokenHash,
  findUserById,
  touchSession,
  updateDevice,
} from '../db/auth-repo';
import { incrementRateLimit } from '../db/rate-limit-repo';
import type { Keyring } from '../env';
import { keyring } from '../env';
import type { AppEnv, AuthContext } from './context';
import { readCookie } from './cookies';

/** Sliding sessions are extended lazily; updating on every request would burn D1 writes. */
const SLIDING_REFRESH_SECONDS = 60 * 60;

export function isSecureRequest(c: Context<AppEnv>): boolean {
  return new URL(c.req.url).protocol === 'https:';
}

export function cookieOptions(c: Context<AppEnv>): { secure: boolean } {
  return { secure: isSecureRequest(c) };
}

export function secrets(c: Context<AppEnv>): Keyring {
  return keyring(c.env);
}

/**
 * Rejects cross-site state-changing requests.
 *
 * `SameSite=Lax` already blocks most CSRF, but it does not cover every browser/embedded-WebView
 * combination, so the Origin header is checked explicitly as a second line of defence.
 */
export const originCheck: MiddlewareHandler<AppEnv> = async (c, next) => {
  const method = c.req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next();

  const origin = c.req.header('origin');
  if (origin) {
    const expected = new URL(c.req.url).origin;
    if (origin !== expected) {
      throw new ApiError(ERROR_CODES.FORBIDDEN, '跨站请求已被拒绝');
    }
  }
  return next();
};

export const attachRequestMeta: MiddlewareHandler<AppEnv> = async (c, next) => {
  const requestId = crypto.randomUUID();
  c.set('requestId', requestId);
  c.set('auth', null);

  const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? null;
  const userAgent = c.req.header('user-agent') ?? null;
  const pepper = c.env.SESSION_PEPPER ?? 'unconfigured';
  c.set('ipHash', ip ? await sha256Hex(`${pepper}|ip|${ip}`) : null);
  c.set('uaHash', userAgent ? await sha256Hex(`${pepper}|ua|${userAgent}`) : null);

  await next();
  c.header('x-request-id', requestId);
};

/**
 * Resolves the session cookie into a full auth context.
 *
 * Every failure mode returns the same generic 401 so the response cannot be used to probe which
 * part of the credential was wrong.
 */
export const requireSession: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = readCookie(c, SESSION_COOKIE);
  if (!token) throw new ApiError(ERROR_CODES.UNAUTHORIZED, '未登录');

  const pepper = secrets(c).sessionPepper;
  const session = await findSessionByTokenHash(c.env.DB, await hashToken(token, pepper));
  if (!session || session.revoked_at) throw new ApiError(ERROR_CODES.UNAUTHORIZED, '会话无效');

  const now = epochSecondsNow();
  if (
    epochSecondsFromIso(session.expires_at) <= now ||
    epochSecondsFromIso(session.absolute_expires_at) <= now
  ) {
    throw new ApiError(ERROR_CODES.UNAUTHORIZED, '会话已过期');
  }

  const [user, device] = await Promise.all([
    findUserById(c.env.DB, session.user_id),
    findDevice(c.env.DB, session.device_id),
  ]);
  if (!user || user.status !== 'active') throw new ApiError(ERROR_CODES.UNAUTHORIZED, '会话无效');
  if (!device || device.revoked_at) throw new ApiError(ERROR_CODES.UNAUTHORIZED, '设备已被撤销');

  const stamp = nowIso();
  if (now - epochSecondsFromIso(session.last_used_at) > SLIDING_REFRESH_SECONDS) {
    const absolute = epochSecondsFromIso(session.absolute_expires_at);
    const nextExpiry = Math.min(now + SESSION_TTL_SECONDS, absolute);
    session.last_used_at = stamp;
    session.expires_at = isoFromEpochSeconds(nextExpiry);
    device.last_seen_at = stamp;
    await Promise.all([
      touchSession(c.env.DB, session.id, stamp, session.expires_at),
      updateDevice(c.env.DB, device.id, { lastSeenAt: stamp }),
    ]);
  }

  const recovery = await findRecoveryState(c.env.DB, user.id);
  const auth: AuthContext = {
    session,
    user,
    device,
    mustResetQuestions: (recovery?.must_reset_questions ?? 0) === 1,
  };
  c.set('auth', auth);
  return next();
};

/** Narrow accessor for routes mounted behind `requireSession`. */
export function auth(c: Context<AppEnv>): AuthContext {
  const value = c.get('auth');
  if (!value) throw new ApiError(ERROR_CODES.UNAUTHORIZED, '未登录');
  return value;
}

/**
 * Blocks the workspace until the account has re-provisioned its security questions.
 *
 * This is the whole enforcement of "consume one security question, then replace all of them":
 * a recovery session can reach settings (to fix the account) but not notes, sync or models.
 * There is deliberately no separate permanent scope gate — once the questions are replaced the
 * account is whole again, and every session is allowed back in.
 */
export const requireQuestionsReset: MiddlewareHandler<AppEnv> = async (c, next) => {
  const current = auth(c);
  if (current.mustResetQuestions) {
    throw new ApiError(
      ERROR_CODES.QUESTIONS_RESET_REQUIRED,
      '使用密保问题登录后，必须先重设全部密保问题。',
    );
  }
  return next();
};

export const csrfProtection: MiddlewareHandler<AppEnv> = async (c, next) => {
  const method = c.req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next();

  const cookie = readCookie(c, CSRF_COOKIE);
  const header = c.req.header(CSRF_HEADER);
  if (!cookie || !header || cookie !== header) {
    throw new ApiError(ERROR_CODES.FORBIDDEN, 'CSRF 校验失败，请刷新页面后重试');
  }
  return next();
};

/** Fixed-window counter, callable from inside a handler when the key needs the parsed body. */
export async function checkRateLimit(
  c: Context<AppEnv>,
  bucketKey: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  const state = await incrementRateLimit(c.env.DB, bucketKey, windowSeconds, epochSecondsNow());
  if (state.count > limit) {
    c.header('retry-after', String(state.retryAfter));
    throw new ApiError(ERROR_CODES.RATE_LIMITED, '操作过于频繁，请稍后再试。', {
      retryAfter: state.retryAfter,
    });
  }
}

export interface RateLimitSpec {
  name: string;
  limit: number;
  windowSeconds: number;
  keyOf: (c: Context<AppEnv>) => string | Promise<string>;
}

/** Throttles on a key that is available before the body is read (typically the client IP). */
export function rateLimit(spec: RateLimitSpec): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    await checkRateLimit(c, `${spec.name}:${await spec.keyOf(c)}`, spec.limit, spec.windowSeconds);
    return next();
  };
}

export function clientKey(c: Context<AppEnv>): string {
  return c.get('ipHash') ?? 'anonymous';
}
