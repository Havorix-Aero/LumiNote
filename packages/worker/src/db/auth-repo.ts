import type {
  AuthChallengeKind,
  AuthChallengeRow,
  CredentialRow,
  DeviceRow,
  RecoveryStateRow,
  SecurityQuestionRow,
  SessionRow,
  SessionScope,
  TotpRow,
  UserRow,
} from './types';

// ---------------------------------------------------------------- users

export function findUserByUsername(db: D1Database, username: string): Promise<UserRow | null> {
  return db.prepare('SELECT * FROM users WHERE username = ?1').bind(username).first<UserRow>();
}

export function findUserById(db: D1Database, id: string): Promise<UserRow | null> {
  return db.prepare('SELECT * FROM users WHERE id = ?1').bind(id).first<UserRow>();
}

export async function insertUser(db: D1Database, row: UserRow): Promise<void> {
  await db
    .prepare(
      `INSERT INTO users (id, username, display_name, status, two_factor_enabled, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    )
    .bind(
      row.id,
      row.username,
      row.display_name,
      row.status,
      row.two_factor_enabled,
      row.created_at,
      row.updated_at,
    )
    .run();
}

export async function updateUserProfile(
  db: D1Database,
  userId: string,
  displayName: string,
  updatedAt: string,
): Promise<void> {
  await db
    .prepare('UPDATE users SET display_name = ?2, updated_at = ?3 WHERE id = ?1')
    .bind(userId, displayName, updatedAt)
    .run();
}

export async function setTwoFactorEnabled(
  db: D1Database,
  userId: string,
  enabled: boolean,
  updatedAt: string,
): Promise<void> {
  await db
    .prepare('UPDATE users SET two_factor_enabled = ?2, updated_at = ?3 WHERE id = ?1')
    .bind(userId, enabled ? 1 : 0, updatedAt)
    .run();
}

// ---------------------------------------------------------------- credentials

export function findCredential(db: D1Database, userId: string): Promise<CredentialRow | null> {
  return db
    .prepare('SELECT * FROM credentials WHERE user_id = ?1')
    .bind(userId)
    .first<CredentialRow>();
}

export async function upsertCredential(db: D1Database, row: CredentialRow): Promise<void> {
  await db
    .prepare(
      `INSERT INTO credentials (user_id, password_hash, algo, params_json, changed_at)
       VALUES (?1, ?2, ?3, ?4, ?5)
       ON CONFLICT (user_id) DO UPDATE SET
         password_hash = excluded.password_hash,
         algo = excluded.algo,
         params_json = excluded.params_json,
         changed_at = excluded.changed_at`,
    )
    .bind(row.user_id, row.password_hash, row.algo, row.params_json, row.changed_at)
    .run();
}

// ---------------------------------------------------------------- totp

export function findTotp(db: D1Database, userId: string): Promise<TotpRow | null> {
  return db.prepare('SELECT * FROM totp WHERE user_id = ?1').bind(userId).first<TotpRow>();
}

export async function upsertTotp(db: D1Database, row: TotpRow): Promise<void> {
  await db
    .prepare(
      `INSERT INTO totp (user_id, secret_enc, enabled, confirmed_at, backup_codes_hash, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
       ON CONFLICT (user_id) DO UPDATE SET
         secret_enc = excluded.secret_enc,
         enabled = excluded.enabled,
         confirmed_at = excluded.confirmed_at,
         backup_codes_hash = excluded.backup_codes_hash,
         updated_at = excluded.updated_at`,
    )
    .bind(
      row.user_id,
      row.secret_enc,
      row.enabled,
      row.confirmed_at,
      row.backup_codes_hash,
      row.created_at,
      row.updated_at,
    )
    .run();
}

export async function deleteTotp(db: D1Database, userId: string): Promise<void> {
  await db.prepare('DELETE FROM totp WHERE user_id = ?1').bind(userId).run();
}

// ---------------------------------------------------------------- security questions

export function listSecurityQuestions(
  db: D1Database,
  userId: string,
): Promise<SecurityQuestionRow[]> {
  return db
    .prepare('SELECT * FROM security_questions WHERE user_id = ?1 ORDER BY created_at ASC')
    .bind(userId)
    .all<SecurityQuestionRow>()
    .then((result) => result.results ?? []);
}

export async function findSecurityQuestion(
  db: D1Database,
  userId: string,
  questionKey: string,
): Promise<SecurityQuestionRow | null> {
  return db
    .prepare('SELECT * FROM security_questions WHERE user_id = ?1 AND question_key = ?2')
    .bind(userId, questionKey)
    .first<SecurityQuestionRow>();
}

export function findSecurityQuestionById(
  db: D1Database,
  id: string,
): Promise<SecurityQuestionRow | null> {
  return db
    .prepare('SELECT * FROM security_questions WHERE id = ?1')
    .bind(id)
    .first<SecurityQuestionRow>();
}

export async function pickAvailableSecurityQuestion(
  db: D1Database,
  userId: string,
  offset: number,
): Promise<SecurityQuestionRow | null> {
  return db
    .prepare(
      `SELECT * FROM security_questions
       WHERE user_id = ?1 AND consumed_at IS NULL
       ORDER BY created_at ASC
       LIMIT 1 OFFSET ?2`,
    )
    .bind(userId, offset)
    .first<SecurityQuestionRow>();
}

export function countAvailableSecurityQuestions(db: D1Database, userId: string): Promise<number> {
  return db
    .prepare(
      'SELECT COUNT(*) AS n FROM security_questions WHERE user_id = ?1 AND consumed_at IS NULL',
    )
    .bind(userId)
    .first<{ n: number }>()
    .then((row) => row?.n ?? 0);
}

/** Replaces the whole question set in one batch — used for setup and for the forced reset. */
export async function replaceSecurityQuestions(
  db: D1Database,
  userId: string,
  entries: Array<{ id: string; questionKey: string; answerHash: string; answerSalt: string }>,
  createdAt: string,
): Promise<void> {
  const statements = [
    db.prepare('DELETE FROM security_questions WHERE user_id = ?1').bind(userId),
    ...entries.map((entry) =>
      db
        .prepare(
          `INSERT INTO security_questions (id, user_id, question_key, answer_hash, answer_salt, created_at, consumed_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL)`,
        )
        .bind(entry.id, userId, entry.questionKey, entry.answerHash, entry.answerSalt, createdAt),
    ),
  ];
  await db.batch(statements);
}

export async function consumeSecurityQuestion(
  db: D1Database,
  questionId: string,
  consumedAt: string,
): Promise<void> {
  await db
    .prepare('UPDATE security_questions SET consumed_at = ?2 WHERE id = ?1')
    .bind(questionId, consumedAt)
    .run();
}

// ---------------------------------------------------------------- recovery state

export function findRecoveryState(
  db: D1Database,
  userId: string,
): Promise<RecoveryStateRow | null> {
  return db
    .prepare('SELECT * FROM recovery_state WHERE user_id = ?1')
    .bind(userId)
    .first<RecoveryStateRow>();
}

/** Records that a security question was just consumed to log in. */
export async function markRecoveryUsed(db: D1Database, userId: string, at: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO recovery_state (user_id, must_reset_questions, last_recovery_at, recovery_count)
       VALUES (?1, 1, ?2, 1)
       ON CONFLICT (user_id) DO UPDATE SET
         must_reset_questions = 1,
         last_recovery_at = ?2,
         recovery_count = recovery_state.recovery_count + 1`,
    )
    .bind(userId, at)
    .run();
}

export async function clearMustResetQuestions(db: D1Database, userId: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO recovery_state (user_id, must_reset_questions, recovery_count)
       VALUES (?1, 0, 0)
       ON CONFLICT (user_id) DO UPDATE SET must_reset_questions = 0`,
    )
    .bind(userId)
    .run();
}

// ---------------------------------------------------------------- devices

export function findDevice(db: D1Database, deviceId: string): Promise<DeviceRow | null> {
  return db.prepare('SELECT * FROM devices WHERE id = ?1').bind(deviceId).first<DeviceRow>();
}

export function listDevices(db: D1Database, userId: string): Promise<DeviceRow[]> {
  return db
    .prepare('SELECT * FROM devices WHERE user_id = ?1 ORDER BY last_seen_at DESC')
    .bind(userId)
    .all<DeviceRow>()
    .then((result) => result.results ?? []);
}

export function listActiveDevices(db: D1Database, userId: string): Promise<DeviceRow[]> {
  return db
    .prepare(
      'SELECT * FROM devices WHERE user_id = ?1 AND revoked_at IS NULL ORDER BY last_seen_at DESC',
    )
    .bind(userId)
    .all<DeviceRow>()
    .then((result) => result.results ?? []);
}

export async function insertDevice(db: D1Database, row: DeviceRow): Promise<void> {
  await db
    .prepare(
      `INSERT INTO devices (id, user_id, label, platform, ua_hash, token_hash, trusted, first_seen_at, last_seen_at, revoked_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, NULL)`,
    )
    .bind(
      row.id,
      row.user_id,
      row.label,
      row.platform,
      row.ua_hash,
      row.token_hash,
      row.trusted,
      row.first_seen_at,
      row.last_seen_at,
    )
    .run();
}

export async function updateDevice(
  db: D1Database,
  deviceId: string,
  patch: { label?: string; trusted?: boolean; lastSeenAt: string },
): Promise<void> {
  await db
    .prepare(
      `UPDATE devices SET
         label = COALESCE(?2, label),
         trusted = COALESCE(?3, trusted),
         last_seen_at = ?4
       WHERE id = ?1`,
    )
    .bind(
      deviceId,
      patch.label ?? null,
      patch.trusted === undefined ? null : patch.trusted ? 1 : 0,
      patch.lastSeenAt,
    )
    .run();
}

export async function revokeDevice(
  db: D1Database,
  deviceId: string,
  revokedAt: string,
): Promise<void> {
  await db
    .prepare('UPDATE devices SET revoked_at = ?2, trusted = 0 WHERE id = ?1')
    .bind(deviceId, revokedAt)
    .run();
}

// ---------------------------------------------------------------- sessions

export function insertSession(db: D1Database, row: SessionRow): Promise<D1Result> {
  return db
    .prepare(
      `INSERT INTO sessions (id, user_id, device_id, token_hash, scope, created_at, expires_at, absolute_expires_at, last_used_at, revoked_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, NULL)`,
    )
    .bind(
      row.id,
      row.user_id,
      row.device_id,
      row.token_hash,
      row.scope,
      row.created_at,
      row.expires_at,
      row.absolute_expires_at,
      row.last_used_at,
    )
    .run();
}

export function findSessionByTokenHash(
  db: D1Database,
  tokenHash: string,
): Promise<SessionRow | null> {
  return db
    .prepare('SELECT * FROM sessions WHERE token_hash = ?1')
    .bind(tokenHash)
    .first<SessionRow>();
}

export async function touchSession(
  db: D1Database,
  sessionId: string,
  lastUsedAt: string,
  expiresAt: string,
): Promise<void> {
  await db
    .prepare('UPDATE sessions SET last_used_at = ?2, expires_at = ?3 WHERE id = ?1')
    .bind(sessionId, lastUsedAt, expiresAt)
    .run();
}

export async function revokeSession(
  db: D1Database,
  sessionId: string,
  revokedAt: string,
): Promise<void> {
  await db
    .prepare('UPDATE sessions SET revoked_at = ?2 WHERE id = ?1')
    .bind(sessionId, revokedAt)
    .run();
}

/** Lifts a recovery session back to full access once the account has been made whole again. */
export async function setSessionScope(
  db: D1Database,
  sessionId: string,
  scope: SessionScope,
): Promise<void> {
  await db.prepare('UPDATE sessions SET scope = ?2 WHERE id = ?1').bind(sessionId, scope).run();
}

export async function revokeSessionsForDevice(
  db: D1Database,
  deviceId: string,
  revokedAt: string,
): Promise<void> {
  await db
    .prepare('UPDATE sessions SET revoked_at = ?2 WHERE device_id = ?1 AND revoked_at IS NULL')
    .bind(deviceId, revokedAt)
    .run();
}

export async function revokeAllSessions(
  db: D1Database,
  userId: string,
  revokedAt: string,
): Promise<void> {
  await db
    .prepare('UPDATE sessions SET revoked_at = ?2 WHERE user_id = ?1 AND revoked_at IS NULL')
    .bind(userId, revokedAt)
    .run();
}

export function listActiveSessions(db: D1Database, userId: string): Promise<SessionRow[]> {
  return db
    .prepare('SELECT * FROM sessions WHERE user_id = ?1 AND revoked_at IS NULL')
    .bind(userId)
    .all<SessionRow>()
    .then((result) => result.results ?? []);
}

// ---------------------------------------------------------------- auth challenges

export function insertChallenge(db: D1Database, row: AuthChallengeRow): Promise<D1Result> {
  return db
    .prepare(
      `INSERT INTO auth_challenges (id, user_id, device_id, kind, token_hash, question_id, payload_json, expires_at, consumed_at, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, NULL, ?9)`,
    )
    .bind(
      row.id,
      row.user_id,
      row.device_id,
      row.kind,
      row.token_hash,
      row.question_id,
      row.payload_json,
      row.expires_at,
      row.created_at,
    )
    .run();
}

export function findChallengeByTokenHash(
  db: D1Database,
  tokenHash: string,
  kind: AuthChallengeKind,
): Promise<AuthChallengeRow | null> {
  return db
    .prepare('SELECT * FROM auth_challenges WHERE token_hash = ?1 AND kind = ?2')
    .bind(tokenHash, kind)
    .first<AuthChallengeRow>();
}

export async function consumeChallenge(
  db: D1Database,
  challengeId: string,
  consumedAt: string,
): Promise<void> {
  await db
    .prepare('UPDATE auth_challenges SET consumed_at = ?2 WHERE id = ?1')
    .bind(challengeId, consumedAt)
    .run();
}

export async function deleteExpiredChallenges(db: D1Database, beforeIso: string): Promise<void> {
  await db.prepare('DELETE FROM auth_challenges WHERE expires_at < ?1').bind(beforeIso).run();
}
