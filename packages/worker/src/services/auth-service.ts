import {
  ApiError,
  CHALLENGE_TTL_SECONDS,
  ERROR_CODES,
  RECOVERY_TOKEN_TTL_SECONDS,
  SECURITY_QUESTION_COUNT,
  SESSION_ABSOLUTE_TTL_SECONDS,
  SESSION_TTL_SECONDS,
  TOTP_BACKUP_CODE_COUNT,
  epochSecondsFromIso,
  epochSecondsNow,
  isoFromEpochSeconds,
  newId,
  nowIso,
  questionPrompt,
  type DevicePlatform,
  type SecurityQuestionEntry,
  type SecurityQuestionPrompt,
  type SessionDto,
} from '@luminote/core';
import type {
  LoginRequest,
  RecoveryStartRequest,
  RecoveryVerifyRequest,
  RegisterRequest,
  TwoFaVerifyRequest,
  ChangePasswordRequest,
  TwoFaEnableRequest,
  TwoFaDisableRequest,
  SecurityQuestionsSetRequest,
} from '@luminote/core';
import { hashAnswer, verifyAnswer } from '../crypto/answers';
import { hashPassword, needsRehash, verifyPassword } from '../crypto/password';
import { open as openSealed, seal } from '../crypto/secretbox';
import { digestMatches, generateNumericCode, generateToken, hashToken } from '../crypto/tokens';
import { generateTotpSecret, totpUri, verifyTotp } from '../crypto/totp';
import { recordAudit } from '../db/audit-repo';
import {
  clearMustResetQuestions,
  consumeChallenge,
  consumeSecurityQuestion,
  countAvailableSecurityQuestions,
  deleteTotp,
  findChallengeByTokenHash,
  findCredential,
  findDevice,
  findRecoveryState,
  findSecurityQuestionById,
  findTotp,
  findUserById,
  findUserByUsername,
  insertChallenge,
  insertDevice,
  insertSession,
  insertUser,
  listSecurityQuestions,
  markRecoveryUsed,
  pickAvailableSecurityQuestion,
  replaceSecurityQuestions,
  revokeAllSessions,
  revokeDevice,
  revokeSession,
  revokeSessionsForDevice,
  setSessionScope,
  setTwoFactorEnabled,
  listDevices as listDevicesRepo,
  updateUserProfile,
  updateDevice,
  upsertCredential,
  upsertTotp,
} from '../db/auth-repo';
import type { AuthChallengeRow, DeviceRow, SessionRow, UserRow } from '../db/types';
import type { Env } from '../env';
import { keyring } from '../env';
import type { AuthContext } from '../http/context';
import { toDeviceDto, toUserDto } from './mappers';

export interface RequestMeta {
  ipHash: string | null;
  uaHash: string | null;
}

export interface SessionCredentials {
  token: string;
  csrfToken: string;
  /** Present when a device cookie must be (re)issued. */
  deviceCookie?: string;
}

export type LoginOutcome =
  | { kind: 'authenticated'; credentials: SessionCredentials; session: SessionDto }
  | {
      kind: 'two_fa_required';
      challengeToken: string;
      expiresAt: string;
      recoveryAvailable: boolean;
    };

const DEFAULT_PLATFORM_LABELS: Record<DevicePlatform, string> = {
  'web-desktop': '桌面浏览器',
  'web-mobile': '手机浏览器',
  android: 'Android 设备',
  ios: 'iOS 设备',
  unknown: '未知设备',
};

function platformLabel(platform: DevicePlatform, userAgent: string | null): string {
  if (platform !== 'unknown') return DEFAULT_PLATFORM_LABELS[platform];
  if (userAgent) {
    if (/iphone|ipad|ipod/i.test(userAgent)) return 'iOS 设备';
    if (/android/i.test(userAgent)) return 'Android 设备';
    if (/windows/i.test(userAgent)) return 'Windows 浏览器';
    if (/mac os/i.test(userAgent)) return 'macOS 浏览器';
    if (/linux/i.test(userAgent)) return 'Linux 浏览器';
  }
  return DEFAULT_PLATFORM_LABELS.unknown;
}

// ------------------------------------------------------------------ session plumbing

async function issueSession(
  env: Env,
  args: { userId: string; deviceId: string; scope: 'full' | 'recovery' },
): Promise<{ token: string; row: SessionRow }> {
  const { sessionPepper } = keyring(env);
  const token = generateToken();
  const now = epochSecondsNow();
  const row: SessionRow = {
    id: newId('ses'),
    user_id: args.userId,
    device_id: args.deviceId,
    token_hash: await hashToken(token, sessionPepper),
    scope: args.scope,
    created_at: nowIso(),
    expires_at: isoFromEpochSeconds(now + SESSION_TTL_SECONDS),
    absolute_expires_at: isoFromEpochSeconds(now + SESSION_ABSOLUTE_TTL_SECONDS),
    last_used_at: nowIso(),
    revoked_at: null,
  };
  await insertSession(env.DB, row);
  return { token, row };
}

export async function buildSessionDto(env: Env, auth: AuthContext): Promise<SessionDto> {
  const unused = await countAvailableSecurityQuestions(env.DB, auth.user.id);
  return {
    user: toUserDto(auth.user, {
      unusedSecurityQuestions: unused,
      mustResetQuestions: auth.mustResetQuestions,
    }),
    device: toDeviceDto(auth.device, auth.device.id),
    scope: auth.session.scope,
    expiresAt: auth.session.expires_at,
  };
}

// ------------------------------------------------------------------ devices

interface DeviceResolution {
  device: DeviceRow;
  /** Set when the caller must (re)issue the device cookie. */
  deviceCookieValue?: string;
  isTrusted: boolean;
}

interface DeviceInfo {
  label?: string;
  platform?: DevicePlatform;
}

async function resolveDevice(
  env: Env,
  userId: string,
  deviceCookie: { deviceId: string; secret: string } | null,
  info: DeviceInfo | undefined,
  meta: RequestMeta,
  userAgent: string | null,
): Promise<DeviceResolution> {
  const { sessionPepper } = keyring(env);

  if (deviceCookie) {
    const existing = await findDevice(env.DB, deviceCookie.deviceId);
    if (existing && existing.user_id === userId && !existing.revoked_at) {
      if (digestMatches(await hashToken(deviceCookie.secret, sessionPepper), existing.token_hash)) {
        const label = info?.label ?? existing.label;
        const platform = info?.platform ?? existing.platform;
        await updateDevice(env.DB, existing.id, { label, lastSeenAt: nowIso() });
        return {
          device: { ...existing, label, platform, last_seen_at: nowIso() },
          isTrusted: existing.trusted === 1,
          deviceCookieValue: `${existing.id}.${deviceCookie.secret}`,
        };
      }
    }
  }

  const platform: DevicePlatform = info?.platform ?? 'unknown';
  const id = newId('dev');
  const secret = generateToken();
  const now = nowIso();
  const row: DeviceRow = {
    id,
    user_id: userId,
    label: info?.label ?? platformLabel(platform, userAgent),
    platform,
    ua_hash: meta.uaHash,
    token_hash: await hashToken(secret, sessionPepper),
    trusted: 0,
    first_seen_at: now,
    last_seen_at: now,
    revoked_at: null,
  };
  await insertDevice(env.DB, row);
  return { device: row, isTrusted: false, deviceCookieValue: `${id}.${secret}` };
}

// ------------------------------------------------------------------ registration & login

export async function register(
  env: Env,
  input: RegisterRequest,
  meta: RequestMeta,
  deviceCookie: { deviceId: string; secret: string } | null,
  userAgent: string | null,
): Promise<LoginOutcome> {
  const existing = await findUserByUsername(env.DB, input.username);
  if (existing) {
    throw new ApiError(ERROR_CODES.CONFLICT, '该用户名已被使用');
  }

  const timestamp = nowIso();
  const user: UserRow = {
    id: newId('usr'),
    username: input.username,
    display_name: input.displayName ?? input.username,
    status: 'active',
    two_factor_enabled: 0,
    created_at: timestamp,
    updated_at: timestamp,
  };
  const stored = await hashPassword(input.password);

  await insertUser(env.DB, user);
  await upsertCredential(env.DB, {
    user_id: user.id,
    password_hash: stored.passwordHash,
    algo: stored.algo,
    params_json: stored.paramsJson,
    changed_at: timestamp,
  });
  await clearMustResetQuestions(env.DB, user.id);

  // The device that created the account is the owner's device, so it starts trusted.
  const device = await resolveDevice(env, user.id, deviceCookie, input.device, meta, userAgent);
  await updateDevice(env.DB, device.device.id, { trusted: true, lastSeenAt: timestamp });
  const trustedDevice: DeviceRow = { ...device.device, trusted: 1 };

  const session = await issueSession(env, {
    userId: user.id,
    deviceId: trustedDevice.id,
    scope: 'full',
  });

  await recordAudit(env.DB, {
    userId: user.id,
    event: 'auth.register',
    ipHash: meta.ipHash,
    uaHash: meta.uaHash,
    createdAt: timestamp,
  });

  return finishLogin(env, {
    user,
    device: trustedDevice,
    session,
    deviceCookieValue: device.deviceCookieValue,
    meta,
    event: 'auth.register',
    trusted: true,
  });
}

export async function login(
  env: Env,
  input: LoginRequest,
  meta: RequestMeta,
  deviceCookie: { deviceId: string; secret: string } | null,
  userAgent: string | null,
): Promise<LoginOutcome> {
  const user = await findUserByUsername(env.DB, input.username);

  // Always pay one PBKDF2 derivation so a missing user and a wrong password take the same time.
  const cred = user ? await findCredential(env.DB, user.id) : null;
  const passwordOk = cred
    ? await verifyPassword(input.password, {
        passwordHash: cred.password_hash,
        algo: cred.algo,
        paramsJson: cred.params_json,
      })
    : (await hashPassword(input.password), false);

  if (!user || !cred || !passwordOk) {
    await recordAudit(env.DB, {
      userId: user?.id ?? null,
      event: 'auth.login_failed',
      ipHash: meta.ipHash,
      uaHash: meta.uaHash,
      meta: { username: input.username },
      createdAt: nowIso(),
    });
    throw new ApiError(ERROR_CODES.UNAUTHORIZED, '用户名或密码不正确');
  }

  if (user.status !== 'active') {
    throw new ApiError(ERROR_CODES.FORBIDDEN, '账号已被停用');
  }

  // Transparently upgrade hashes when the cost parameters have been raised.
  if (needsRehash({ algo: cred.algo, paramsJson: cred.params_json })) {
    const rehashed = await hashPassword(input.password);
    await upsertCredential(env.DB, {
      user_id: user.id,
      password_hash: rehashed.passwordHash,
      algo: rehashed.algo,
      params_json: rehashed.paramsJson,
      changed_at: nowIso(),
    });
  }

  const device = await resolveDevice(env, user.id, deviceCookie, input.device, meta, userAgent);
  const twoFactorEnabled = user.two_factor_enabled === 1;

  if (twoFactorEnabled && !device.isTrusted) {
    const challenge = await createChallenge(env, {
      userId: user.id,
      deviceId: device.device.id,
      kind: 'totp',
      ttlSeconds: CHALLENGE_TTL_SECONDS,
      questionId: null,
    });
    const recoveryAvailable = (await countAvailableSecurityQuestions(env.DB, user.id)) > 0;
    await recordAudit(env.DB, {
      userId: user.id,
      event: 'auth.2fa_challenged',
      ipHash: meta.ipHash,
      uaHash: meta.uaHash,
      createdAt: nowIso(),
    });
    return {
      kind: 'two_fa_required',
      challengeToken: challenge.token,
      expiresAt: challenge.expires_at,
      recoveryAvailable,
    };
  }

  const session = await issueSession(env, {
    userId: user.id,
    deviceId: device.device.id,
    scope: 'full',
  });

  if (!device.isTrusted) {
    // 2FA is off for this account, so there is no second factor left to gate the device on.
    await updateDevice(env.DB, device.device.id, { trusted: true, lastSeenAt: nowIso() });
  }

  return finishLogin(env, {
    user,
    device: { ...device.device, trusted: 1 },
    session,
    deviceCookieValue: device.deviceCookieValue,
    meta,
    event: 'auth.login',
    trusted: true,
  });
}

async function finishLogin(
  env: Env,
  args: {
    user: UserRow;
    device: DeviceRow;
    session: { token: string; row: SessionRow };
    deviceCookieValue?: string;
    meta: RequestMeta;
    event: string;
    trusted: boolean;
  },
): Promise<Extract<LoginOutcome, { kind: 'authenticated' }>> {
  await recordAudit(env.DB, {
    userId: args.user.id,
    event: args.event,
    ipHash: args.meta.ipHash,
    uaHash: args.meta.uaHash,
    meta: { deviceId: args.device.id, trusted: args.trusted },
    createdAt: nowIso(),
  });

  const recovery = await findRecoveryState(env.DB, args.user.id);
  const auth: AuthContext = {
    session: args.session.row,
    user: args.user,
    device: args.device,
    mustResetQuestions: (recovery?.must_reset_questions ?? 0) === 1,
  };

  const credentials: SessionCredentials = {
    token: args.session.token,
    csrfToken: generateToken(16),
  };
  if (args.deviceCookieValue) credentials.deviceCookie = args.deviceCookieValue;

  return {
    kind: 'authenticated',
    credentials,
    session: await buildSessionDto(env, auth),
  };
}

// ------------------------------------------------------------------ challenges

async function createChallenge(
  env: Env,
  args: {
    userId: string;
    deviceId: string;
    kind: 'totp' | 'recovery';
    ttlSeconds: number;
    questionId: string | null;
    payload?: Record<string, unknown>;
  },
): Promise<{ token: string; expires_at: string; row: AuthChallengeRow }> {
  const { sessionPepper } = keyring(env);
  const token = generateToken();
  const now = epochSecondsNow();
  const row: AuthChallengeRow = {
    id: newId('chl'),
    user_id: args.userId,
    device_id: args.deviceId,
    kind: args.kind,
    token_hash: await hashToken(token, sessionPepper),
    question_id: args.questionId,
    payload_json: args.payload ? JSON.stringify(args.payload) : null,
    expires_at: isoFromEpochSeconds(now + args.ttlSeconds),
    consumed_at: null,
    created_at: nowIso(),
  };
  await insertChallenge(env.DB, row);
  return { token, expires_at: row.expires_at, row };
}

async function consumeChallengeToken(
  env: Env,
  token: string,
  kind: 'totp' | 'recovery',
): Promise<AuthChallengeRow> {
  const { sessionPepper } = keyring(env);
  const row = await findChallengeByTokenHash(env.DB, await hashToken(token, sessionPepper), kind);
  if (!row || row.consumed_at) {
    throw new ApiError(ERROR_CODES.UNAUTHORIZED, '验证已失效，请重新登录');
  }
  if (epochSecondsFromIso(row.expires_at) <= epochSecondsNow()) {
    throw new ApiError(ERROR_CODES.UNAUTHORIZED, '验证已过期，请重新登录');
  }
  return row;
}

// ------------------------------------------------------------------ two-factor

export async function verifyTwoFactor(
  env: Env,
  input: TwoFaVerifyRequest,
  meta: RequestMeta,
): Promise<LoginOutcome> {
  const challenge = await consumeChallengeToken(env, input.challengeToken, 'totp');
  const user = await findUserById(env.DB, challenge.user_id);
  const device = await findDevice(env.DB, challenge.device_id);
  if (!user || !device || device.revoked_at || user.two_factor_enabled !== 1) {
    throw new ApiError(ERROR_CODES.UNAUTHORIZED, '验证已失效，请重新登录');
  }

  const totp = await findTotp(env.DB, user.id);
  if (!totp?.secret_enc) {
    throw new ApiError(ERROR_CODES.TWO_FA_INVALID, '未配置两步验证');
  }

  const secret = await openSealed(totp.secret_enc, keyring(env).totpMasterKey);
  const codeAccepted = await verifyTotp(secret, input.code);
  const backupAccepted = codeAccepted
    ? false
    : await consumeBackupCode(totp.backup_codes_hash, input.code);

  if (!codeAccepted && !backupAccepted) {
    await recordAudit(env.DB, {
      userId: user.id,
      event: 'auth.2fa_failed',
      ipHash: meta.ipHash,
      uaHash: meta.uaHash,
      createdAt: nowIso(),
    });
    throw new ApiError(ERROR_CODES.TWO_FA_INVALID, '验证码不正确');
  }

  await consumeChallenge(env.DB, challenge.id, nowIso());
  const shouldTrust = input.trustDevice === true;
  if (shouldTrust) {
    await updateDevice(env.DB, device.id, { trusted: true, lastSeenAt: nowIso() });
  } else {
    await updateDevice(env.DB, device.id, { lastSeenAt: nowIso() });
  }

  const session = await issueSession(env, {
    userId: user.id,
    deviceId: device.id,
    scope: 'full',
  });

  return finishLogin(env, {
    user,
    device: { ...device, trusted: shouldTrust ? 1 : device.trusted },
    session,
    meta,
    event: backupAccepted ? 'auth.login_backup_code' : 'auth.login',
    trusted: shouldTrust || device.trusted === 1,
  });
}

async function consumeBackupCode(storedJson: string | null, submitted: string): Promise<boolean> {
  if (!storedJson) return false;
  let hashes: string[];
  try {
    const parsed = JSON.parse(storedJson) as unknown;
    if (!Array.isArray(parsed)) return false;
    hashes = parsed.filter((v): v is string => typeof v === 'string');
  } catch {
    return false;
  }
  return hashes.some((hash) => digestMatches(submitted.trim(), hash));
}

export async function beginTwoFactorSetup(
  env: Env,
  auth: AuthContext,
): Promise<{ secret: string; uri: string }> {
  const secret = generateTotpSecret();
  const now = nowIso();
  const sealed = await seal(secret, keyring(env).totpMasterKey);
  await upsertTotp(env.DB, {
    user_id: auth.user.id,
    secret_enc: sealed,
    enabled: 0,
    confirmed_at: null,
    backup_codes_hash: null,
    created_at: now,
    updated_at: now,
  });
  return { secret, uri: totpUri(secret, auth.user.username) };
}

export async function enableTwoFactor(
  env: Env,
  auth: AuthContext,
  input: TwoFaEnableRequest,
): Promise<{ backupCodes: string[] }> {
  const totp = await findTotp(env.DB, auth.user.id);
  if (!totp?.secret_enc) {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, '请先开始两步验证设置');
  }
  if (totp.enabled === 1) {
    throw new ApiError(ERROR_CODES.CONFLICT, '两步验证已启用');
  }

  const secret = await openSealed(totp.secret_enc, keyring(env).totpMasterKey);
  if (!(await verifyTotp(secret, input.code))) {
    throw new ApiError(ERROR_CODES.TWO_FA_INVALID, '验证码不正确');
  }

  const backupCodes = Array.from({ length: TOTP_BACKUP_CODE_COUNT }, () => generateNumericCode(10));
  const now = nowIso();
  await upsertTotp(env.DB, {
    ...totp,
    enabled: 1,
    confirmed_at: now,
    backup_codes_hash: JSON.stringify(backupCodes),
    updated_at: now,
  });
  await setTwoFactorEnabled(env.DB, auth.user.id, true, now);
  await recordAudit(env.DB, {
    userId: auth.user.id,
    event: 'auth.2fa_enabled',
    createdAt: now,
  });

  return { backupCodes };
}

export async function disableTwoFactor(
  env: Env,
  auth: AuthContext,
  input: TwoFaDisableRequest,
): Promise<void> {
  const cred = await findCredential(env.DB, auth.user.id);
  if (!cred) throw new ApiError(ERROR_CODES.BAD_REQUEST, '账号状态异常');
  const ok = await verifyPassword(input.password, {
    passwordHash: cred.password_hash,
    algo: cred.algo,
    paramsJson: cred.params_json,
  });
  if (!ok) throw new ApiError(ERROR_CODES.UNAUTHORIZED, '密码不正确');

  const now = nowIso();
  await deleteTotp(env.DB, auth.user.id);
  await setTwoFactorEnabled(env.DB, auth.user.id, false, now);
  auth.user = { ...auth.user, two_factor_enabled: 0 };
  await recordAudit(env.DB, {
    userId: auth.user.id,
    event: 'auth.2fa_disabled',
    createdAt: now,
  });
}

// ------------------------------------------------------------------ security-question recovery

export async function startRecovery(
  env: Env,
  input: RecoveryStartRequest,
  meta: RequestMeta,
): Promise<{ recoveryToken: string; expiresAt: string; question: SecurityQuestionPrompt }> {
  const challenge = await consumeChallengeToken(env, input.challengeToken, 'totp');
  const available = await countAvailableSecurityQuestions(env.DB, challenge.user_id);
  if (available === 0) {
    throw new ApiError(
      ERROR_CODES.RECOVERY_UNAVAILABLE,
      '没有可用的密保问题，请使用两步验证码登录。',
    );
  }

  // Rotate which question is asked so one leaked answer is not enough on every attempt.
  const offset = Math.floor(Math.random() * available);
  const question = await pickAvailableSecurityQuestion(env.DB, challenge.user_id, offset);
  if (!question) {
    throw new ApiError(ERROR_CODES.RECOVERY_UNAVAILABLE, '没有可用的密保问题');
  }

  await consumeChallenge(env.DB, challenge.id, nowIso());
  const created = await createChallenge(env, {
    userId: challenge.user_id,
    deviceId: challenge.device_id,
    kind: 'recovery',
    ttlSeconds: RECOVERY_TOKEN_TTL_SECONDS,
    questionId: question.id,
    payload: { attempts: 0 },
  });

  await recordAudit(env.DB, {
    userId: challenge.user_id,
    event: 'auth.recovery_started',
    ipHash: meta.ipHash,
    uaHash: meta.uaHash,
    createdAt: nowIso(),
  });

  return {
    recoveryToken: created.token,
    expiresAt: created.expires_at,
    question: { key: question.question_key, prompt: questionPrompt(question.question_key) },
  };
}

const MAX_RECOVERY_ATTEMPTS = 5;

export async function verifyRecovery(
  env: Env,
  input: RecoveryVerifyRequest,
  meta: RequestMeta,
): Promise<LoginOutcome> {
  const challenge = await consumeChallengeToken(env, input.recoveryToken, 'recovery');
  if (!challenge.question_id) {
    throw new ApiError(ERROR_CODES.RECOVERY_INVALID, '密保问题状态异常');
  }

  const attempts = readAttempts(challenge.payload_json);
  if (attempts >= MAX_RECOVERY_ATTEMPTS) {
    await consumeChallenge(env.DB, challenge.id, nowIso());
    throw new ApiError(ERROR_CODES.RECOVERY_INVALID, '尝试次数过多，请重新登录。');
  }

  const question = await findSecurityQuestionById(env.DB, challenge.question_id);
  const user = await findUserById(env.DB, challenge.user_id);
  const device = await findDevice(env.DB, challenge.device_id);
  if (!question || question.consumed_at || !user || !device || device.revoked_at) {
    throw new ApiError(ERROR_CODES.RECOVERY_INVALID, '密保问题已失效');
  }

  if (!(await verifyAnswer(input.answer, question.answer_hash, question.answer_salt))) {
    const nextAttempts = attempts + 1;
    if (nextAttempts >= MAX_RECOVERY_ATTEMPTS) {
      await consumeChallenge(env.DB, challenge.id, nowIso());
    } else {
      await dbUpdateChallengePayload(env, challenge.id, { attempts: nextAttempts });
    }
    await recordAudit(env.DB, {
      userId: user.id,
      event: 'auth.recovery_failed',
      ipHash: meta.ipHash,
      uaHash: meta.uaHash,
      meta: { attempts: nextAttempts },
      createdAt: nowIso(),
    });
    throw new ApiError(ERROR_CODES.RECOVERY_INVALID, '密保答案不正确');
  }

  const now = nowIso();
  await consumeSecurityQuestion(env.DB, question.id, now);
  await consumeChallenge(env.DB, challenge.id, now);
  await markRecoveryUsed(env.DB, user.id, now);
  // The device stays untrusted: recovering with a security question must not grant lasting trust.
  await updateDevice(env.DB, device.id, { trusted: false, lastSeenAt: now });

  const session = await issueSession(env, {
    userId: user.id,
    deviceId: device.id,
    scope: 'recovery',
  });

  return finishLogin(env, {
    user,
    device: { ...device, trusted: 0 },
    session,
    meta,
    event: 'auth.recovery_success',
    trusted: false,
  });
}

function readAttempts(payloadJson: string | null): number {
  if (!payloadJson) return 0;
  try {
    const parsed = JSON.parse(payloadJson) as { attempts?: unknown };
    return typeof parsed.attempts === 'number' ? parsed.attempts : 0;
  } catch {
    return 0;
  }
}

async function dbUpdateChallengePayload(
  env: Env,
  challengeId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await env.DB.prepare('UPDATE auth_challenges SET payload_json = ?2 WHERE id = ?1')
    .bind(challengeId, JSON.stringify(payload))
    .run();
}

// ------------------------------------------------------------------ security questions

export async function listSecurityQuestionEntries(
  env: Env,
  auth: AuthContext,
): Promise<SecurityQuestionEntry[]> {
  const rows = await listSecurityQuestions(env.DB, auth.user.id);
  return rows.map((row) => ({
    key: row.question_key,
    prompt: questionPrompt(row.question_key),
    active: row.consumed_at === null,
    consumedAt: row.consumed_at,
    createdAt: row.created_at,
  }));
}

export async function setSecurityQuestions(
  env: Env,
  auth: AuthContext,
  input: SecurityQuestionsSetRequest,
): Promise<void> {
  const entries = await Promise.all(
    input.answers.map(async (answer) => {
      const hashed = await hashAnswer(answer.answer);
      return {
        id: newId('secq'),
        questionKey: answer.key,
        answerHash: hashed.hash,
        answerSalt: hashed.salt,
      };
    }),
  );
  const now = nowIso();
  await replaceSecurityQuestions(env.DB, auth.user.id, entries, now);
  await clearMustResetQuestions(env.DB, auth.user.id);
  // The account is whole again, so this session no longer needs its restricted scope.
  await setSessionScope(env.DB, auth.session.id, 'full');
  auth.mustResetQuestions = false;
  auth.session = { ...auth.session, scope: 'full' };
  await recordAudit(env.DB, {
    userId: auth.user.id,
    event: 'auth.questions_set',
    meta: { count: entries.length },
    createdAt: now,
  });
}

export function securityQuestionCount(): number {
  return SECURITY_QUESTION_COUNT;
}
// ------------------------------------------------------------------ password, profile, sessions

export async function changePassword(
  env: Env,
  auth: AuthContext,
  input: ChangePasswordRequest,
): Promise<void> {
  if (auth.session.scope === 'full') {
    if (!input.currentPassword) {
      throw new ApiError(ERROR_CODES.BAD_REQUEST, '请输入当前密码');
    }
    const cred = await findCredential(env.DB, auth.user.id);
    if (!cred) throw new ApiError(ERROR_CODES.BAD_REQUEST, '账号状态异常');
    const ok = await verifyPassword(input.currentPassword, {
      passwordHash: cred.password_hash,
      algo: cred.algo,
      paramsJson: cred.params_json,
    });
    if (!ok) throw new ApiError(ERROR_CODES.UNAUTHORIZED, '当前密码不正确');
  }

  const stored = await hashPassword(input.newPassword);
  const now = nowIso();
  await upsertCredential(env.DB, {
    user_id: auth.user.id,
    password_hash: stored.passwordHash,
    algo: stored.algo,
    params_json: stored.paramsJson,
    changed_at: now,
  });

  // Changing a password invalidates every other session.
  const sessions = await listActiveSessionsForUser(env, auth.user.id);
  await Promise.all(
    sessions
      .filter((row) => row.id !== auth.session.id)
      .map((row) => revokeSession(env.DB, row.id, now)),
  );
  await recordAudit(env.DB, {
    userId: auth.user.id,
    event: 'auth.password_changed',
    createdAt: now,
  });
}

async function listActiveSessionsForUser(env: Env, userId: string): Promise<SessionRow[]> {
  const result = await env.DB.prepare(
    'SELECT * FROM sessions WHERE user_id = ?1 AND revoked_at IS NULL',
  )
    .bind(userId)
    .all<SessionRow>();
  return result.results ?? [];
}

export async function updateProfile(
  env: Env,
  auth: AuthContext,
  displayName: string,
): Promise<void> {
  const now = nowIso();
  await updateUserProfile(env.DB, auth.user.id, displayName, now);
  auth.user = { ...auth.user, display_name: displayName, updated_at: now };
  await recordAudit(env.DB, { userId: auth.user.id, event: 'profile.updated', createdAt: now });
}

export async function listDevices(env: Env, auth: AuthContext) {
  const rows = await listDevicesRepo(env.DB, auth.user.id);
  return rows.filter((row) => !row.revoked_at).map((row) => toDeviceDto(row, auth.device.id));
}

export async function revokeDeviceById(
  env: Env,
  auth: AuthContext,
  deviceId: string,
): Promise<void> {
  const device = await findDevice(env.DB, deviceId);
  if (!device || device.user_id !== auth.user.id || device.revoked_at) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, '设备不存在');
  }
  const now = nowIso();
  await revokeDevice(env.DB, device.id, now);
  await revokeSessionsForDevice(env.DB, device.id, now);
  await recordAudit(env.DB, {
    userId: auth.user.id,
    event: 'device.revoked',
    meta: { deviceId: device.id },
    createdAt: now,
  });
}

export async function logout(env: Env, auth: AuthContext): Promise<void> {
  const now = nowIso();
  await revokeSession(env.DB, auth.session.id, now);
  await recordAudit(env.DB, { userId: auth.user.id, event: 'auth.logout', createdAt: now });
}

export async function logoutAll(env: Env, auth: AuthContext): Promise<void> {
  const now = nowIso();
  await revokeAllSessions(env.DB, auth.user.id, now);
  await recordAudit(env.DB, { userId: auth.user.id, event: 'auth.logout_all', createdAt: now });
}
