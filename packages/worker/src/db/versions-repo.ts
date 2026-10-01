import { SYNC_PAGE_SIZE } from '@luminote/core';
import type { NoteVersionRow } from './types';

const COLUMNS =
  'id, note_id, user_id, title, body, source, label, device_id, bytes, pinned, restored_from_id, created_at';

export function insertVersion(db: D1Database, row: NoteVersionRow): Promise<D1Result> {
  return db
    .prepare(
      `INSERT INTO note_versions
         (id, note_id, user_id, title, body, source, label, device_id, bytes, pinned, restored_from_id, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
       ON CONFLICT (id) DO NOTHING`,
    )
    .bind(
      row.id,
      row.note_id,
      row.user_id,
      row.title,
      row.body,
      row.source,
      row.label,
      row.device_id,
      row.bytes,
      row.pinned,
      row.restored_from_id,
      row.created_at,
    )
    .run();
}

export function findVersionForUser(
  db: D1Database,
  userId: string,
  versionId: string,
): Promise<NoteVersionRow | null> {
  return db
    .prepare(`SELECT ${COLUMNS} FROM note_versions WHERE id = ?1 AND user_id = ?2`)
    .bind(versionId, userId)
    .first<NoteVersionRow>();
}

export interface ListVersionsOptions {
  limit?: number;
  /** Cursor is the `created_at` of the last row on the previous page. */
  beforeCreatedAt?: string;
}

export function listVersionsForNote(
  db: D1Database,
  userId: string,
  noteId: string,
  options: ListVersionsOptions = {},
): Promise<NoteVersionRow[]> {
  const limit = options.limit ?? SYNC_PAGE_SIZE;
  if (options.beforeCreatedAt) {
    return db
      .prepare(
        `SELECT ${COLUMNS} FROM note_versions
         WHERE user_id = ?1 AND note_id = ?2 AND created_at < ?3
         ORDER BY created_at DESC LIMIT ?4`,
      )
      .bind(userId, noteId, options.beforeCreatedAt, limit)
      .all<NoteVersionRow>()
      .then((result) => result.results ?? []);
  }
  return db
    .prepare(
      `SELECT ${COLUMNS} FROM note_versions
       WHERE user_id = ?1 AND note_id = ?2
       ORDER BY created_at DESC LIMIT ?3`,
    )
    .bind(userId, noteId, limit)
    .all<NoteVersionRow>()
    .then((result) => result.results ?? []);
}

export function latestVersionForNote(
  db: D1Database,
  noteId: string,
): Promise<NoteVersionRow | null> {
  return db
    .prepare(
      `SELECT ${COLUMNS} FROM note_versions WHERE note_id = ?1 ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(noteId)
    .first<NoteVersionRow>();
}

export function listVersionsByIds(db: D1Database, ids: string[]): Promise<NoteVersionRow[]> {
  if (ids.length === 0) return Promise.resolve([]);
  const placeholders = ids.map((_, index) => `?${index + 1}`).join(', ');
  return db
    .prepare(`SELECT ${COLUMNS} FROM note_versions WHERE id IN (${placeholders})`)
    .bind(...ids)
    .all<NoteVersionRow>()
    .then((result) => result.results ?? []);
}

export async function updateVersion(
  db: D1Database,
  versionId: string,
  patch: { pinned?: boolean; label?: string | null },
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (patch.pinned !== undefined) {
    params.push(patch.pinned ? 1 : 0);
    sets.push(`pinned = ?${params.length + 1}`);
  }
  if (patch.label !== undefined) {
    params.push(patch.label);
    sets.push(`label = ?${params.length + 1}`);
  }
  if (sets.length === 0) return;
  await db
    .prepare(`UPDATE note_versions SET ${sets.join(', ')} WHERE id = ?1`)
    .bind(versionId, ...params)
    .run();
}

/**
 * Old automatic snapshots across all users, newest first, so the retention job can collapse them
 * to a daily rollup per note.
 */
export function listOldAutoVersions(
  db: D1Database,
  beforeIso: string,
  limit = 5000,
): Promise<NoteVersionRow[]> {
  return db
    .prepare(
      `SELECT ${COLUMNS} FROM note_versions
       WHERE source = 'auto' AND pinned = 0 AND created_at < ?1
       ORDER BY note_id ASC, created_at DESC
       LIMIT ?2`,
    )
    .bind(beforeIso, limit)
    .all<NoteVersionRow>()
    .then((result) => result.results ?? []);
}

export async function deleteVersionsByIds(db: D1Database, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  // Chunked so a large prune never builds an oversized statement.
  const CHUNK = 50;
  for (let index = 0; index < ids.length; index += CHUNK) {
    const chunk = ids.slice(index, index + CHUNK);
    const placeholders = chunk.map((_, i) => `?${i + 1}`).join(', ');
    await db
      .prepare(`DELETE FROM note_versions WHERE id IN (${placeholders})`)
      .bind(...chunk)
      .run();
  }
}

export async function countVersionsForNote(db: D1Database, noteId: string): Promise<number> {
  return db
    .prepare('SELECT COUNT(*) AS n FROM note_versions WHERE note_id = ?1')
    .bind(noteId)
    .first<{ n: number }>()
    .then((row) => row?.n ?? 0);
}
