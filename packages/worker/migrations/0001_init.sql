-- LumiNote initial schema.

CREATE TABLE users (
  id                 TEXT PRIMARY KEY,
  username           TEXT NOT NULL COLLATE NOCASE UNIQUE,
  display_name       TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'active',
  two_factor_enabled INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);

CREATE TABLE credentials (
  user_id       TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  algo          TEXT NOT NULL,
  params_json   TEXT NOT NULL,
  changed_at    TEXT NOT NULL
);

CREATE TABLE totp (
  user_id           TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  secret_enc        TEXT,
  enabled           INTEGER NOT NULL DEFAULT 0,
  confirmed_at      TEXT,
  backup_codes_hash TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE TABLE security_questions (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  question_key TEXT NOT NULL,
  answer_hash  TEXT NOT NULL,
  answer_salt  TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  consumed_at  TEXT,
  UNIQUE (user_id, question_key)
);

CREATE INDEX idx_security_questions_available
  ON security_questions (user_id, consumed_at);

CREATE TABLE recovery_state (
  user_id              TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  must_reset_questions INTEGER NOT NULL DEFAULT 0,
  last_recovery_at     TEXT,
  recovery_count       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE devices (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  label         TEXT NOT NULL,
  platform      TEXT NOT NULL,
  ua_hash       TEXT,
  token_hash    TEXT NOT NULL,
  trusted       INTEGER NOT NULL DEFAULT 0,
  first_seen_at TEXT NOT NULL,
  last_seen_at  TEXT NOT NULL,
  revoked_at    TEXT
);

CREATE INDEX idx_devices_user ON devices (user_id);

CREATE TABLE sessions (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  device_id           TEXT NOT NULL REFERENCES devices (id) ON DELETE CASCADE,
  token_hash          TEXT NOT NULL UNIQUE,
  scope               TEXT NOT NULL DEFAULT 'full',
  created_at          TEXT NOT NULL,
  expires_at          TEXT NOT NULL,
  absolute_expires_at TEXT NOT NULL,
  last_used_at        TEXT NOT NULL,
  revoked_at          TEXT
);

CREATE INDEX idx_sessions_user ON sessions (user_id);
CREATE INDEX idx_sessions_device ON sessions (device_id);

-- Short-lived tokens exchanged mid-login (TOTP challenge, security-question recovery).
CREATE TABLE auth_challenges (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  device_id    TEXT NOT NULL REFERENCES devices (id) ON DELETE CASCADE,
  kind         TEXT NOT NULL,
  token_hash   TEXT NOT NULL UNIQUE,
  question_id  TEXT,
  payload_json TEXT,
  expires_at   TEXT NOT NULL,
  consumed_at  TEXT,
  created_at   TEXT NOT NULL
);

CREATE INDEX idx_auth_challenges_user ON auth_challenges (user_id, kind);

CREATE TABLE notes (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title             TEXT,
  body              TEXT NOT NULL,
  pinned            INTEGER NOT NULL DEFAULT 0,
  rev               INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  deleted_at        TEXT,
  client_created_at TEXT
);

CREATE INDEX idx_notes_user_updated ON notes (user_id, updated_at DESC);
CREATE INDEX idx_notes_user_deleted ON notes (user_id, deleted_at);

CREATE TABLE note_versions (
  id               TEXT PRIMARY KEY,
  note_id          TEXT NOT NULL REFERENCES notes (id) ON DELETE CASCADE,
  user_id          TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title            TEXT,
  body             TEXT NOT NULL,
  source           TEXT NOT NULL,
  label            TEXT,
  device_id        TEXT,
  bytes            INTEGER NOT NULL,
  pinned           INTEGER NOT NULL DEFAULT 0,
  restored_from_id TEXT,
  created_at       TEXT NOT NULL
);

CREATE INDEX idx_note_versions_note ON note_versions (note_id, created_at DESC);
CREATE INDEX idx_note_versions_user ON note_versions (user_id, created_at DESC);
CREATE INDEX idx_note_versions_prune ON note_versions (user_id, source, pinned, created_at);

CREATE TABLE change_log (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  entity     TEXT NOT NULL,
  entity_id  TEXT NOT NULL,
  op         TEXT NOT NULL,
  rev        INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_change_log_user_seq ON change_log (user_id, seq);

CREATE TABLE sync_cursors (
  user_id    TEXT NOT NULL,
  device_id  TEXT NOT NULL,
  last_seq   INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, device_id)
);

CREATE TABLE audit_log (
  id         TEXT PRIMARY KEY,
  user_id    TEXT,
  event      TEXT NOT NULL,
  ip_hash    TEXT,
  ua_hash    TEXT,
  meta_json  TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_audit_log_user ON audit_log (user_id, created_at DESC);

-- Durable rate-limit counters (login, 2FA, recovery).
CREATE TABLE rate_limits (
  bucket_key   TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL
);
