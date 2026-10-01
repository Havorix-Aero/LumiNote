import type { DevicePlatform, SessionScope, VersionSource } from '@luminote/core';

export type { DevicePlatform, SessionScope, VersionSource };

/** Raw D1 rows. SQLite has no boolean type, so flags are 0/1 integers. */

export interface UserRow {
  id: string;
  username: string;
  display_name: string;
  status: string;
  two_factor_enabled: number;
  created_at: string;
  updated_at: string;
}

export interface CredentialRow {
  user_id: string;
  password_hash: string;
  algo: string;
  params_json: string;
  changed_at: string;
}

export interface TotpRow {
  user_id: string;
  secret_enc: string | null;
  enabled: number;
  confirmed_at: string | null;
  backup_codes_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface SecurityQuestionRow {
  id: string;
  user_id: string;
  question_key: string;
  answer_hash: string;
  answer_salt: string;
  created_at: string;
  consumed_at: string | null;
}

export interface RecoveryStateRow {
  user_id: string;
  must_reset_questions: number;
  last_recovery_at: string | null;
  recovery_count: number;
}

export interface DeviceRow {
  id: string;
  user_id: string;
  label: string;
  platform: DevicePlatform;
  ua_hash: string | null;
  token_hash: string;
  trusted: number;
  first_seen_at: string;
  last_seen_at: string;
  revoked_at: string | null;
}

export interface SessionRow {
  id: string;
  user_id: string;
  device_id: string;
  token_hash: string;
  scope: SessionScope;
  created_at: string;
  expires_at: string;
  absolute_expires_at: string;
  last_used_at: string;
  revoked_at: string | null;
}

export type AuthChallengeKind = 'totp' | 'recovery';

export interface AuthChallengeRow {
  id: string;
  user_id: string;
  device_id: string;
  kind: AuthChallengeKind;
  token_hash: string;
  question_id: string | null;
  payload_json: string | null;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
}

export interface NoteRow {
  id: string;
  user_id: string;
  title: string | null;
  body: string;
  pinned: number;
  rev: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  client_created_at: string | null;
}

export interface NoteVersionRow {
  id: string;
  note_id: string;
  user_id: string;
  title: string | null;
  body: string;
  source: VersionSource;
  label: string | null;
  device_id: string | null;
  bytes: number;
  pinned: number;
  restored_from_id: string | null;
  created_at: string;
}

export interface ChangeLogRow {
  seq: number;
  user_id: string;
  entity: 'note' | 'version';
  entity_id: string;
  op: 'upsert' | 'delete';
  rev: number;
  created_at: string;
}

export interface AuditLogRow {
  id: string;
  user_id: string | null;
  event: string;
  ip_hash: string | null;
  ua_hash: string | null;
  meta_json: string | null;
  created_at: string;
}

export interface RateLimitRow {
  bucket_key: string;
  window_start: number;
  count: number;
}
