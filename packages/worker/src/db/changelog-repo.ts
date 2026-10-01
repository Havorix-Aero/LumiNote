import { SYNC_PAGE_SIZE } from '@luminote/core';
import type { ChangeLogRow } from './types';

export interface ChangeLogEntryInput {
  userId: string;
  entity: 'note' | 'version';
  entityId: string;
  op: 'upsert' | 'delete';
  rev: number;
  createdAt: string;
}

/**
 * Appends to the per-user change log and returns the new cursor.
 *
 * The log is how devices discover what changed without polling every note; `seq` is a global
 * autoincrement, so cursors are opaque and stable.
 */
export async function appendChange(db: D1Database, entry: ChangeLogEntryInput): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO change_log (user_id, entity, entity_id, op, rev, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    )
    .bind(entry.userId, entry.entity, entry.entityId, entry.op, entry.rev, entry.createdAt)
    .run();
  return Number(result.meta.last_row_id ?? 0);
}

export function listChanges(
  db: D1Database,
  userId: string,
  cursor: number,
  limit: number = SYNC_PAGE_SIZE,
): Promise<ChangeLogRow[]> {
  return db
    .prepare(
      `SELECT seq, user_id, entity, entity_id, op, rev, created_at
       FROM change_log
       WHERE user_id = ?1 AND seq > ?2
       ORDER BY seq ASC LIMIT ?3`,
    )
    .bind(userId, cursor, limit)
    .all<ChangeLogRow>()
    .then((result) => result.results ?? []);
}

export function latestSeq(db: D1Database, userId: string): Promise<number> {
  return db
    .prepare('SELECT COALESCE(MAX(seq), 0) AS seq FROM change_log WHERE user_id = ?1')
    .bind(userId)
    .first<{ seq: number }>()
    .then((row) => row?.seq ?? 0);
}

export function findSyncCursor(
  db: D1Database,
  userId: string,
  deviceId: string,
): Promise<{ last_seq: number } | null> {
  return db
    .prepare('SELECT last_seq FROM sync_cursors WHERE user_id = ?1 AND device_id = ?2')
    .bind(userId, deviceId)
    .first<{ last_seq: number }>();
}

export async function setSyncCursor(
  db: D1Database,
  userId: string,
  deviceId: string,
  lastSeq: number,
  updatedAt: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO sync_cursors (user_id, device_id, last_seq, updated_at)
       VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT (user_id, device_id) DO UPDATE SET
         last_seq = excluded.last_seq,
         updated_at = excluded.updated_at`,
    )
    .bind(userId, deviceId, lastSeq, updatedAt)
    .run();
}

/**
 * Drops change-log rows that every remaining device has already consumed.
 *
 * The threshold is the *slowest* cursor per user: deleting anything a device has not pulled yet
 * would silently skip changes. Users with no cursors are left alone. Cursors belonging to revoked
 * devices are removed first — otherwise one retired phone would pin the log forever.
 */
export async function trimConsumedChangeLog(db: D1Database): Promise<number> {
  const result = await db
    .prepare(
      `DELETE FROM change_log
       WHERE seq <= (
         SELECT MIN(c.last_seq) FROM sync_cursors c WHERE c.user_id = change_log.user_id
       )`,
    )
    .run();
  return Number(result.meta.changes ?? 0);
}

/** Forgets cursors for devices that have been revoked or deleted. */
export async function pruneOrphanedSyncCursors(db: D1Database): Promise<void> {
  await db
    .prepare(
      `DELETE FROM sync_cursors
       WHERE NOT EXISTS (
         SELECT 1 FROM devices d
         WHERE d.id = sync_cursors.device_id AND d.revoked_at IS NULL
       )`,
    )
    .run();
}
