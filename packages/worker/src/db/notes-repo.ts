import { SYNC_PAGE_SIZE } from '@luminote/core';
import type { NoteRow } from './types';

const COLUMNS =
  'id, user_id, title, body, pinned, rev, created_at, updated_at, deleted_at, client_created_at';

export function findNote(db: D1Database, noteId: string): Promise<NoteRow | null> {
  return db.prepare(`SELECT ${COLUMNS} FROM notes WHERE id = ?1`).bind(noteId).first<NoteRow>();
}

export function findNoteForUser(
  db: D1Database,
  userId: string,
  noteId: string,
): Promise<NoteRow | null> {
  return db
    .prepare(`SELECT ${COLUMNS} FROM notes WHERE id = ?1 AND user_id = ?2`)
    .bind(noteId, userId)
    .first<NoteRow>();
}

export interface ListNotesOptions {
  includeDeleted?: boolean;
  limit?: number;
  /** Only notes whose rev is greater than this value (drives incremental list refresh). */
  sinceRev?: number;
}

export function listNotesForUser(
  db: D1Database,
  userId: string,
  options: ListNotesOptions = {},
): Promise<NoteRow[]> {
  const limit = options.limit ?? SYNC_PAGE_SIZE;
  const clauses = ['user_id = ?1'];
  const params: unknown[] = [userId];
  if (!options.includeDeleted) clauses.push('deleted_at IS NULL');
  if (options.sinceRev !== undefined) {
    params.push(options.sinceRev);
    clauses.push(`rev > ?${params.length}`);
  }
  params.push(limit);
  return db
    .prepare(
      `SELECT ${COLUMNS} FROM notes WHERE ${clauses.join(' AND ')}
       ORDER BY pinned DESC, updated_at DESC LIMIT ?${params.length}`,
    )
    .bind(...params)
    .all<NoteRow>()
    .then((result) => result.results ?? []);
}

export function listNotesByIds(db: D1Database, userId: string, ids: string[]): Promise<NoteRow[]> {
  if (ids.length === 0) return Promise.resolve([]);
  const placeholders = ids.map((_, index) => `?${index + 2}`).join(', ');
  return db
    .prepare(`SELECT ${COLUMNS} FROM notes WHERE user_id = ?1 AND id IN (${placeholders})`)
    .bind(userId, ...ids)
    .all<NoteRow>()
    .then((result) => result.results ?? []);
}

export function insertNote(db: D1Database, row: NoteRow): Promise<D1Result> {
  return db
    .prepare(
      `INSERT INTO notes (id, user_id, title, body, pinned, rev, created_at, updated_at, deleted_at, client_created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
    )
    .bind(
      row.id,
      row.user_id,
      row.title,
      row.body,
      row.pinned,
      row.rev,
      row.created_at,
      row.updated_at,
      row.deleted_at,
      row.client_created_at,
    )
    .run();
}

export interface NoteContentPatch {
  title?: string | null;
  body?: string;
  pinned?: boolean;
}

export async function updateNote(
  db: D1Database,
  noteId: string,
  patch: NoteContentPatch,
  rev: number,
  updatedAt: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE notes SET
         title = COALESCE(?2, title),
         body = COALESCE(?3, body),
         pinned = COALESCE(?4, pinned),
         rev = ?5,
         updated_at = ?6
       WHERE id = ?1`,
    )
    .bind(
      noteId,
      patch.title === undefined ? null : patch.title,
      patch.body ?? null,
      patch.pinned === undefined ? null : patch.pinned ? 1 : 0,
      rev,
      updatedAt,
    )
    .run();
}

export async function softDeleteNote(
  db: D1Database,
  noteId: string,
  deletedAt: string,
  rev: number,
): Promise<void> {
  await db
    .prepare('UPDATE notes SET deleted_at = ?2, rev = ?3, updated_at = ?2 WHERE id = ?1')
    .bind(noteId, deletedAt, rev)
    .run();
}
