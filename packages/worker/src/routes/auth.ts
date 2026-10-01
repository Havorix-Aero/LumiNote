import {
  CHALLENGE_TTL_SECONDS,
  LOGIN_ATTEMPT_WINDOW_SECONDS,
  LOGIN_MAX_ATTEMPTS_PER_WINDOW,
  changePasswordRequestSchema,
  loginRequestSchema,
  recoveryStartRequestSchema,
  recoveryVerifyRequestSchema,
  registerRequestSchema,
  twoFaVerifyRequestSchema,
} from '@luminote/core';
import { Hono } from 'hono';
import type { Context } from 'hono';
import type { AppEnv } from '../http/context';
import {
  auth as authContext,
  checkRateLimit,
  clientKey,
  cookieOptions,
  csrfProtection,
  rateLimit,
  requireSession,
} from '../http/guards';
import {
  clearSessionCookie,
  readDeviceCookie,
  setCsrfCookie,
  setDeviceCookie,
  setSessionCookie,
} from '../http/cookies';
import { ok } from '../http/respond';
import { parseJson } from '../http/validate';
import type { LoginOutcome, RequestMeta } from '../services/auth-service';
import {
  buildSessionDto,
  changePassword,
  login,
  logout,
  logoutAll,
  register,
  startRecovery,
  verifyRecovery,
  verifyTwoFactor,
} from '../services/auth-service';

export const authRoutes = new Hono<AppEnv>();

function meta(c: Context<AppEnv>): RequestMeta {
  return { ipHash: c.get('ipHash'), uaHash: c.get('uaHash') };
}

function userAgent(c: Context<AppEnv>): string | null {
  return c.req.header('user-agent') ?? null;
}

/** Attaches the session cookies and shapes the response for either login outcome. */
function applyOutcome(c: Context<AppEnv>, outcome: LoginOutcome) {
  if (outcome.kind === 'two_fa_required') {
    return ok(c, {
      status: 'two_fa_required' as const,
      challengeToken: outcome.challengeToken,
      expiresAt: outcome.expiresAt,
      recoveryAvailable: outcome.recoveryAvailable,
    });
  }

  const options = cookieOptions(c);
  setSessionCookie(c, outcome.credentials.token, options);
  setCsrfCookie(c, outcome.credentials.csrfToken, options);
  if (outcome.credentials.deviceCookie) {
    setDeviceCookie(c, outcome.credentials.deviceCookie, options);
  }
  return ok(c, { status: 'authenticated' as const, session: outcome.session });
}

authRoutes.post(
  '/register',
  rateLimit({ name: 'register', limit: 10, windowSeconds: 3600, keyOf: clientKey }),
  async (c) => {
    const body = await parseJson(c, registerRequestSchema);
    const outcome = await register(c.env, body, meta(c), readDeviceCookie(c), userAgent(c));
    return applyOutcome(c, outcome);
  },
);

authRoutes.post(
  '/login',
  rateLimit({
    name: 'login_ip',
    limit: 40,
    windowSeconds: LOGIN_ATTEMPT_WINDOW_SECONDS,
    keyOf: clientKey,
  }),
  async (c) => {
    const body = await parseJson(c, loginRequestSchema);
    // Per-account throttling happens after the body is parsed; it is the control that actually
    // stops a targeted password-guessing run against one account.
    await checkRateLimit(
      c,
      `login_user:${body.username.toLowerCase()}`,
      LOGIN_MAX_ATTEMPTS_PER_WINDOW,
      LOGIN_ATTEMPT_WINDOW_SECONDS,
    );
    const outcome = await login(c.env, body, meta(c), readDeviceCookie(c), userAgent(c));
    return applyOutcome(c, outcome);
  },
);

authRoutes.post(
  '/2fa/verify',
  rateLimit({ name: '2fa', limit: 20, windowSeconds: CHALLENGE_TTL_SECONDS, keyOf: clientKey }),
  async (c) => {
    const body = await parseJson(c, twoFaVerifyRequestSchema);
    return applyOutcome(c, await verifyTwoFactor(c.env, body, meta(c)));
  },
);

authRoutes.post(
  '/recovery/start',
  rateLimit({ name: 'recovery_start', limit: 10, windowSeconds: 900, keyOf: clientKey }),
  async (c) => {
    const body = await parseJson(c, recoveryStartRequestSchema);
    const result = await startRecovery(c.env, body, meta(c));
    return ok(c, {
      recoveryToken: result.recoveryToken,
      expiresAt: result.expiresAt,
      question: result.question,
    });
  },
);

authRoutes.post(
  '/recovery/verify',
  rateLimit({ name: 'recovery_verify', limit: 10, windowSeconds: 900, keyOf: clientKey }),
  async (c) => {
    const body = await parseJson(c, recoveryVerifyRequestSchema);
    return applyOutcome(c, await verifyRecovery(c.env, body, meta(c)));
  },
);

authRoutes.use('/session', requireSession, csrfProtection);
authRoutes.get('/session', async (c) => {
  const current = authContext(c);
  return ok(c, { session: await buildSessionDto(c.env, current) });
});

authRoutes.use('/logout', requireSession, csrfProtection);
authRoutes.post('/logout', async (c) => {
  await logout(c.env, authContext(c));
  clearSessionCookie(c, cookieOptions(c));
  return ok(c, { ok: true });
});

authRoutes.use('/logout-all', requireSession, csrfProtection);
authRoutes.post('/logout-all', async (c) => {
  await logoutAll(c.env, authContext(c));
  return ok(c, { ok: true });
});

authRoutes.use('/password', requireSession, csrfProtection);
authRoutes.post('/password', async (c) => {
  const body = await parseJson(c, changePasswordRequestSchema);
  await changePassword(c.env, authContext(c), body);
  return ok(c, { ok: true });
});
