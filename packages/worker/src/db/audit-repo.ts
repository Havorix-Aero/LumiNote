import { newId } from '@luminote/core';
import type { AuditLogRow } from './types';

export interface AuditEntry {
  userId: string | null;
  event: string;
  ipHash?: string | null;
  uaHash?: string | null;
  meta?: Record<string, unknown>;
  createdAt: string;
}

/**
 * Security-relevant events are recorded here: logins, failures, 2FA changes, recovery usage and
 * device revocations. Audit writes must never break the request they describe.
 */
export async function recordAudit(db: D1Database, entry: AuditEntry): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO audit_log (id, user_id, event, ip_hash, ua_hash, meta_json, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
      )
      .bind(
        newId('aud'),
        entry.userId,
        entry.event,
        entry.ipHash ?? null,
        entry.uaHash ?? null,
        entry.meta ? JSON.stringify(entry.meta) : null,
        entry.createdAt,
      )
      .run();
  } catch (error) {
    console.error('audit write failed', entry.event, error);
  }
}

export function listRecentAudit(
  db: D1Database,
  userId: string,
  limit = 50,
): Promise<AuditLogRow[]> {
  return db
    .prepare(
      `SELECT id, user_id, event, ip_hash, ua_hash, meta_json, created_at
       FROM audit_log WHERE user_id = ?1 ORDER BY created_at DESC LIMIT ?2`,
    )
    .bind(userId, limit)
    .all<AuditLogRow>()
    .then((result) => result.results ?? []);
}
