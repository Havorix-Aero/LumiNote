import {
  ApiError,
  ERROR_CODES,
  SYNC_PAGE_SIZE,
  newId,
  nowIso,
  type NoteCreateRequest,
  type NoteDto,
  type NoteUpdateRequest,
} from '@luminote/core';
import { appendChange } from '../db/changelog-repo';
import {
  findNote,
  findNoteForUser,
  insertNote,
  listNotesForUser,
  softDeleteNote,
  updateNote as updateNoteRow,
} from '../db/notes-repo';
import type { NoteRow } from '../db/types';
import type { Env } from '../env';
import type { AuthContext } from '../http/context';
import { toNoteDto } from './mappers';
import { captureEditingSessionSnapshot, recordVersionIfChanged } from './version-service';

export async function createNote(
  env: Env,
  auth: AuthContext,
  input: NoteCreateRequest,
): Promise<NoteDto> {
  const id = input.id ?? newId('note');
  const existing = await findNote(env.DB, id);
  if (existing) {
    if (existing.user_id !== auth.user.id) {
      throw new ApiError(ERROR_CODES.CONFLICT, '笔记 id 冲突');
    }
    // Replaying an offline create must not duplicate or reset the note.
    return toNoteDto(existing);
  }

  const timestamp = nowIso();
  const row: NoteRow = {
    id,
    user_id: auth.user.id,
    title: input.title ?? null,
    body: input.body,
    pinned: 0,
    rev: 1,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
    client_created_at: input.clientCreatedAt ?? null,
  };
  await insertNote(env.DB, row);
  await appendChange(env.DB, {
    userId: auth.user.id,
    entity: 'note',
    entityId: id,
    op: 'upsert',
    rev: 1,
    createdAt: timestamp,
  });

  // The freshly captured idea is itself version 1 of the note's history.
  await recordVersionIfChanged(env, {
    userId: auth.user.id,
    noteId: id,
    title: row.title,
    body: row.body,
    source: 'auto',
    deviceId: auth.device.id,
    createdAt: timestamp,
  });

  return toNoteDto(row);
}

export interface ListNotesQuery {
  limit?: number;
  sinceRev?: number;
}

export async function listNotes(
  env: Env,
  auth: AuthContext,
  query: ListNotesQuery = {},
): Promise<NoteDto[]> {
  const rows = await listNotesForUser(env.DB, auth.user.id, {
    includeDeleted: false,
    limit: query.limit ?? SYNC_PAGE_SIZE,
    sinceRev: query.sinceRev,
  });
  return rows.map(toNoteDto);
}

export async function getNote(env: Env, auth: AuthContext, noteId: string): Promise<NoteDto> {
  const row = await findNoteForUser(env.DB, auth.user.id, noteId);
  if (!row) throw new ApiError(ERROR_CODES.NOT_FOUND, '笔记不存在');
  return toNoteDto(row);
}

export async function updateNoteContent(
  env: Env,
  auth: AuthContext,
  noteId: string,
  input: NoteUpdateRequest,
): Promise<NoteDto> {
  const row = await findNoteForUser(env.DB, auth.user.id, noteId);
  if (!row) throw new ApiError(ERROR_CODES.NOT_FOUND, '笔记不存在');

  if (input.baseRev !== undefined && input.baseRev !== row.rev) {
    throw new ApiError(ERROR_CODES.CONFLICT, '笔记已在其它设备上被修改', {
      current: toNoteDto(row),
    });
  }

  const timestamp = nowIso();
  const nextBody = input.body ?? row.body;
  const contentChanged = nextBody !== row.body || (input.title ?? row.title) !== row.title;

  // Snapshot the pre-edit state, once per editing session, before overwriting it.
  if (contentChanged) {
    await captureEditingSessionSnapshot(env, {
      userId: auth.user.id,
      noteId,
      deviceId: auth.device.id,
      title: row.title,
      body: row.body,
    });
  }

  const rev = row.rev + 1;
  await updateNoteRow(env.DB, noteId, input, rev, timestamp);
  await appendChange(env.DB, {
    userId: auth.user.id,
    entity: 'note',
    entityId: noteId,
    op: 'upsert',
    rev,
    createdAt: timestamp,
  });

  return toNoteDto({
    ...row,
    title: input.title !== undefined ? input.title : row.title,
    body: nextBody,
    pinned: input.pinned !== undefined ? (input.pinned ? 1 : 0) : row.pinned,
    rev,
    updated_at: timestamp,
  });
}

export async function deleteNote(env: Env, auth: AuthContext, noteId: string): Promise<void> {
  const row = await findNoteForUser(env.DB, auth.user.id, noteId);
  if (!row) throw new ApiError(ERROR_CODES.NOT_FOUND, '笔记不存在');
  if (row.deleted_at) return;

  const timestamp = nowIso();
  const rev = row.rev + 1;
  await captureEditingSessionSnapshot(env, {
    userId: auth.user.id,
    noteId,
    deviceId: auth.device.id,
    title: row.title,
    body: row.body,
  });
  await softDeleteNote(env.DB, noteId, timestamp, rev);
  await appendChange(env.DB, {
    userId: auth.user.id,
    entity: 'note',
    entityId: noteId,
    op: 'delete',
    rev,
    createdAt: timestamp,
  });
}
