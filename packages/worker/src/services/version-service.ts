import {
  ApiError,
  EDIT_SESSION_IDLE_MS,
  ERROR_CODES,
  newId,
  nowIso,
  type NoteDto,
  type NoteVersionDto,
  type VersionSource,
} from '@luminote/core';
import { bytesOf, normalizeSnapshot, shouldStoreSnapshot } from '@luminote/versions';
import { appendChange } from '../db/changelog-repo';
import { findNoteForUser, updateNote } from '../db/notes-repo';
import {
  findVersionForUser,
  insertVersion,
  latestVersionForNote,
  listVersionsForNote,
  updateVersion,
} from '../db/versions-repo';
import type { NoteVersionRow } from '../db/types';
import type { Env } from '../env';
import type { AuthContext } from '../http/context';
import { toNoteDto, toVersionDto } from './mappers';

export interface RecordVersionInput {
  userId: string;
  noteId: string;
  title: string | null;
  body: string;
  source: VersionSource;
  label?: string | null;
  deviceId: string | null;
  restoredFromId?: string | null;
  createdAt?: string;
  id?: string;
}

function buildRow(input: RecordVersionInput, createdAt: string, id: string): NoteVersionRow {
  const normalized = normalizeSnapshot({ title: input.title, body: input.body });
  return {
    id,
    note_id: input.noteId,
    user_id: input.userId,
    title: normalized.title,
    body: normalized.body,
    source: input.source,
    label: input.label ?? null,
    device_id: input.deviceId,
    bytes: bytesOf(normalized.body),
    pinned: 0,
    restored_from_id: input.restoredFromId ?? null,
    created_at: createdAt,
  };
}

/** Inserts a version unconditionally. Callers decide whether it is worth keeping. */
export async function recordVersion(env: Env, input: RecordVersionInput): Promise<NoteVersionRow> {
  const createdAt = input.createdAt ?? nowIso();
  const row = buildRow(input, createdAt, input.id ?? newId('ver'));
  await insertVersion(env.DB, row);
  await appendChange(env.DB, {
    userId: input.userId,
    entity: 'version',
    entityId: row.id,
    op: 'upsert',
    rev: 1,
    createdAt,
  });
  return row;
}

/** Stores a snapshot only when it differs from the newest one (no-op snapshots are noise). */
export async function recordVersionIfChanged(
  env: Env,
  input: RecordVersionInput,
): Promise<NoteVersionRow | null> {
  const latest = await latestVersionForNote(env.DB, input.noteId);
  const previous = latest ? { title: latest.title, body: latest.body } : null;
  const candidate = normalizeSnapshot({ title: input.title, body: input.body });
  if (!shouldStoreSnapshot(candidate, previous)) return null;
  return recordVersion(env, { ...input, title: candidate.title });
}

/**
 * Implements "one automatic snapshot per editing session" on the server side.
 *
 * A session is inferred from idleness: if a snapshot was already taken within the idle window, the
 * user is still in the same sitting, so nothing is written. Otherwise the content as it was before
 * this edit is preserved, which is exactly the state the user might want back.
 */
export async function captureEditingSessionSnapshot(
  env: Env,
  args: {
    userId: string;
    noteId: string;
    deviceId: string | null;
    title: string | null;
    body: string;
    now?: Date;
  },
): Promise<NoteVersionRow | null> {
  const now = args.now ?? new Date();
  const latest = await latestVersionForNote(env.DB, args.noteId);
  if (latest) {
    const elapsed = now.getTime() - new Date(latest.created_at).getTime();
    if (elapsed < EDIT_SESSION_IDLE_MS) return null;
  }
  return recordVersionIfChanged(env, {
    userId: args.userId,
    noteId: args.noteId,
    title: args.title,
    body: args.body,
    source: 'auto',
    deviceId: args.deviceId,
    createdAt: now.toISOString(),
  });
}

// ------------------------------------------------------------------ read paths

export interface ListVersionsResult {
  items: NoteVersionDto[];
  nextCursor: string | null;
}

export async function listVersions(
  env: Env,
  auth: AuthContext,
  noteId: string,
  options: { limit?: number; cursor?: string },
): Promise<ListVersionsResult> {
  await assertNoteExists(env, auth, noteId);
  const limit = options.limit ?? 50;
  const rows = await listVersionsForNote(env.DB, auth.user.id, noteId, {
    limit,
    beforeCreatedAt: options.cursor,
  });
  const last = rows[rows.length - 1];
  return {
    items: rows.map(toVersionDto),
    nextCursor: rows.length === limit && last ? last.created_at : null,
  };
}

export async function getVersion(
  env: Env,
  auth: AuthContext,
  versionId: string,
): Promise<NoteVersionDto> {
  const row = await findVersionForUser(env.DB, auth.user.id, versionId);
  if (!row) throw new ApiError(ERROR_CODES.NOT_FOUND, '版本不存在');
  return toVersionDto(row);
}

async function assertNoteExists(env: Env, auth: AuthContext, noteId: string): Promise<void> {
  const note = await findNoteForUser(env.DB, auth.user.id, noteId);
  if (!note) throw new ApiError(ERROR_CODES.NOT_FOUND, '笔记不存在');
}

// ------------------------------------------------------------------ mutations

export async function saveVersion(
  env: Env,
  auth: AuthContext,
  noteId: string,
  input: { label?: string; title?: string | null; body?: string },
): Promise<NoteVersionDto> {
  const note = await findNoteForUser(env.DB, auth.user.id, noteId);
  if (!note) throw new ApiError(ERROR_CODES.NOT_FOUND, '笔记不存在');

  const row = await recordVersion(env, {
    userId: auth.user.id,
    noteId,
    title: input.title !== undefined ? input.title : note.title,
    body: input.body ?? note.body,
    source: 'manual',
    label: input.label ?? null,
    deviceId: auth.device.id,
  });
  return toVersionDto(row);
}

export async function patchVersion(
  env: Env,
  auth: AuthContext,
  versionId: string,
  patch: { pinned?: boolean; label?: string | null },
): Promise<NoteVersionDto> {
  const row = await findVersionForUser(env.DB, auth.user.id, versionId);
  if (!row) throw new ApiError(ERROR_CODES.NOT_FOUND, '版本不存在');
  await updateVersion(env.DB, row.id, patch);
  const updated = await findVersionForUser(env.DB, auth.user.id, versionId);
  return toVersionDto(updated ?? row);
}

export interface RestoreResult {
  note: NoteDto;
  version: NoteVersionDto;
}

/**
 * Restoring never rewrites history: the old version stays untouched and a *new* head version is
 * appended, so the timeline shows both the restore and what it replaced.
 */
export async function restoreVersion(
  env: Env,
  auth: AuthContext,
  noteId: string,
  versionId: string,
): Promise<RestoreResult> {
  const note = await findNoteForUser(env.DB, auth.user.id, noteId);
  if (!note) throw new ApiError(ERROR_CODES.NOT_FOUND, '笔记不存在');
  const version = await findVersionForUser(env.DB, auth.user.id, versionId);
  if (!version || version.note_id !== noteId) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, '版本不存在');
  }

  const timestamp = nowIso();

  // Preserve whatever was on screen before the restore, even inside an active editing session.
  await recordVersionIfChanged(env, {
    userId: auth.user.id,
    noteId,
    title: note.title,
    body: note.body,
    source: 'auto',
    deviceId: auth.device.id,
    createdAt: timestamp,
  });

  const rev = note.rev + 1;
  await updateNote(env.DB, noteId, { title: version.title, body: version.body }, rev, timestamp);
  await appendChange(env.DB, {
    userId: auth.user.id,
    entity: 'note',
    entityId: noteId,
    op: 'upsert',
    rev,
    createdAt: timestamp,
  });

  const restored = await recordVersion(env, {
    userId: auth.user.id,
    noteId,
    title: version.title,
    body: version.body,
    source: 'restore',
    label: `恢复自 ${version.created_at.slice(0, 16).replace('T', ' ')}`,
    deviceId: auth.device.id,
    restoredFromId: version.id,
    createdAt: timestamp,
  });

  return {
    note: toNoteDto({
      ...note,
      title: version.title,
      body: version.body,
      rev,
      updated_at: timestamp,
    }),
    version: toVersionDto(restored),
  };
}
