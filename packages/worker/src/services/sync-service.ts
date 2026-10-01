import {
  ApiError,
  SYNC_PAGE_SIZE,
  nowIso,
  type ChangeLogEntry,
  type SyncMutationResult,
  type SyncPullResponse,
  type SyncPushResponse,
} from '@luminote/core';
import type { SyncMutationInput } from '@luminote/core';
import { appendChange, latestSeq, listChanges, setSyncCursor } from '../db/changelog-repo';
import {
  findNote,
  insertNote,
  listNotesByIds,
  softDeleteNote,
  updateNote as updateNoteRow,
} from '../db/notes-repo';
import { findVersionForUser, insertVersion, listVersionsByIds } from '../db/versions-repo';
import type { NoteVersionRow, NoteRow } from '../db/types';
import type { Env } from '../env';
import type { AuthContext } from '../http/context';
import { toNoteDto, toVersionDto } from './mappers';
import { captureEditingSessionSnapshot, recordVersionIfChanged } from './version-service';

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

// ------------------------------------------------------------------ pull

export async function pull(
  env: Env,
  auth: AuthContext,
  input: { cursor: number; limit?: number },
): Promise<SyncPullResponse> {
  const limit = input.limit ?? SYNC_PAGE_SIZE;
  const changes = await listChanges(env.DB, auth.user.id, input.cursor, limit);

  const noteIds = unique(
    changes.filter((row) => row.entity === 'note').map((row) => row.entity_id),
  );
  const versionIds = unique(
    changes.filter((row) => row.entity === 'version').map((row) => row.entity_id),
  );

  const [noteRows, versionRows] = await Promise.all([
    listNotesByIds(env.DB, auth.user.id, noteIds),
    listVersionsByIds(env.DB, versionIds),
  ]);

  const last = changes[changes.length - 1];
  const nextCursor = last ? last.seq : input.cursor;

  const entries: ChangeLogEntry[] = changes.map((row) => ({
    seq: row.seq,
    entity: row.entity,
    entityId: row.entity_id,
    op: row.op,
    rev: row.rev,
    createdAt: row.created_at,
  }));

  await setSyncCursor(env.DB, auth.user.id, auth.device.id, nextCursor, nowIso());

  return {
    cursor: nextCursor,
    hasMore: changes.length === limit,
    changes: entries,
    notes: noteRows.map(toNoteDto),
    versions: versionRows.map(toVersionDto),
  };
}

// ------------------------------------------------------------------ push

export async function push(
  env: Env,
  auth: AuthContext,
  input: { mutations: SyncMutationInput[] },
): Promise<SyncPushResponse> {
  const results: SyncMutationResult[] = [];
  for (const mutation of input.mutations) {
    results.push(await applyMutation(env, auth, mutation));
  }
  const cursor = await latestSeq(env.DB, auth.user.id);
  await setSyncCursor(env.DB, auth.user.id, auth.device.id, cursor, nowIso());
  return { results, cursor };
}

async function applyMutation(
  env: Env,
  auth: AuthContext,
  mutation: SyncMutationInput,
): Promise<SyncMutationResult> {
  try {
    if (mutation.entity === 'note') {
      return mutation.op === 'delete'
        ? await applyNoteDelete(env, auth, mutation)
        : await applyNoteUpsert(env, auth, mutation);
    }
    if (mutation.op === 'delete') {
      // Versions are immutable history; deletion only happens through retention.
      return { mutationId: mutation.mutationId, status: 'rejected', error: '版本不支持删除' };
    }
    return await applyVersionUpsert(env, auth, mutation);
  } catch (error) {
    const message = error instanceof ApiError ? error.message : '同步失败';
    return { mutationId: mutation.mutationId, status: 'rejected', error: message };
  }
}

function millis(iso: string | null | undefined): number {
  if (!iso) return 0;
  const value = new Date(iso).getTime();
  return Number.isNaN(value) ? 0 : value;
}

async function applyNoteUpsert(
  env: Env,
  auth: AuthContext,
  mutation: SyncMutationInput,
): Promise<SyncMutationResult> {
  const payload = mutation.note;
  if (!payload) {
    return { mutationId: mutation.mutationId, status: 'rejected', error: 'note 载荷缺失' };
  }

  const existing = await findNote(env.DB, mutation.entityId);
  if (existing && existing.user_id !== auth.user.id) {
    return { mutationId: mutation.mutationId, status: 'rejected', error: '笔记归属不匹配' };
  }

  if (!existing) {
    const timestamp = payload.updatedAt;
    const row: NoteRow = {
      id: mutation.entityId,
      user_id: auth.user.id,
      title: payload.title ?? null,
      body: payload.body ?? '',
      pinned: payload.pinned ? 1 : 0,
      rev: 1,
      created_at: payload.createdAt ?? timestamp,
      updated_at: timestamp,
      deleted_at: payload.deletedAt ?? null,
      client_created_at: payload.createdAt ?? null,
    };
    await insertNote(env.DB, row);
    await appendChange(env.DB, {
      userId: auth.user.id,
      entity: 'note',
      entityId: row.id,
      op: 'upsert',
      rev: 1,
      createdAt: timestamp,
    });
    await recordVersionIfChanged(env, {
      userId: auth.user.id,
      noteId: row.id,
      title: row.title,
      body: row.body,
      source: 'auto',
      deviceId: auth.device.id,
      createdAt: timestamp,
    });
    return { mutationId: mutation.mutationId, status: 'applied', rev: 1, note: toNoteDto(row) };
  }

  const incomingUpdatedAt = millis(payload.updatedAt);

  // Exact replay of a mutation we already applied: acknowledge without touching history.
  if (
    incomingUpdatedAt === millis(existing.updated_at) &&
    (payload.body === undefined || payload.body === existing.body)
  ) {
    return {
      mutationId: mutation.mutationId,
      status: 'applied',
      rev: existing.rev,
      note: toNoteDto(existing),
    };
  }

  if (incomingUpdatedAt <= millis(existing.updated_at)) {
    // The server copy is newer. Keep it, but never discard the user's local text.
    let conflictVersionId: string | undefined;
    if (payload.body !== undefined && payload.body !== existing.body) {
      const preserved = await recordVersionIfChanged(env, {
        userId: auth.user.id,
        noteId: existing.id,
        title: payload.title ?? null,
        body: payload.body,
        source: 'import',
        label: '冲突副本',
        deviceId: auth.device.id,
        createdAt: nowIso(),
      });
      conflictVersionId = preserved?.id;
    }
    return {
      mutationId: mutation.mutationId,
      status: 'conflict',
      rev: existing.rev,
      conflictVersionId,
      note: toNoteDto(existing),
    };
  }

  await captureEditingSessionSnapshot(env, {
    userId: auth.user.id,
    noteId: existing.id,
    deviceId: auth.device.id,
    title: existing.title,
    body: existing.body,
  });

  const rev = existing.rev + 1;
  const nextBody = payload.body ?? existing.body;
  const nextTitle = payload.title !== undefined ? payload.title : existing.title;
  const nextPinned = payload.pinned !== undefined ? payload.pinned : existing.pinned === 1;

  await updateNoteRow(
    env.DB,
    existing.id,
    { title: nextTitle, body: nextBody, pinned: nextPinned },
    rev,
    payload.updatedAt,
  );

  const deleting = payload.deletedAt !== undefined && payload.deletedAt !== null;
  if (deleting) {
    await softDeleteNote(env.DB, existing.id, payload.deletedAt as string, rev);
  }

  await appendChange(env.DB, {
    userId: auth.user.id,
    entity: 'note',
    entityId: existing.id,
    op: deleting ? 'delete' : 'upsert',
    rev,
    createdAt: payload.updatedAt,
  });

  return {
    mutationId: mutation.mutationId,
    status: 'applied',
    rev,
    note: toNoteDto({
      ...existing,
      title: nextTitle,
      body: nextBody,
      pinned: nextPinned ? 1 : 0,
      rev,
      updated_at: payload.updatedAt,
      deleted_at: deleting ? (payload.deletedAt as string) : existing.deleted_at,
    }),
  };
}

async function applyNoteDelete(
  env: Env,
  auth: AuthContext,
  mutation: SyncMutationInput,
): Promise<SyncMutationResult> {
  const existing = await findNote(env.DB, mutation.entityId);
  if (!existing) {
    return { mutationId: mutation.mutationId, status: 'applied' };
  }
  if (existing.user_id !== auth.user.id) {
    return { mutationId: mutation.mutationId, status: 'rejected', error: '笔记归属不匹配' };
  }
  if (existing.deleted_at) {
    return {
      mutationId: mutation.mutationId,
      status: 'applied',
      rev: existing.rev,
      note: toNoteDto(existing),
    };
  }

  const timestamp = mutation.note?.updatedAt ?? nowIso();
  const rev = existing.rev + 1;
  await captureEditingSessionSnapshot(env, {
    userId: auth.user.id,
    noteId: existing.id,
    deviceId: auth.device.id,
    title: existing.title,
    body: existing.body,
  });
  await softDeleteNote(env.DB, existing.id, timestamp, rev);
  await appendChange(env.DB, {
    userId: auth.user.id,
    entity: 'note',
    entityId: existing.id,
    op: 'delete',
    rev,
    createdAt: timestamp,
  });
  return {
    mutationId: mutation.mutationId,
    status: 'applied',
    rev,
    note: toNoteDto({ ...existing, deleted_at: timestamp, rev, updated_at: timestamp }),
  };
}

async function applyVersionUpsert(
  env: Env,
  auth: AuthContext,
  mutation: SyncMutationInput,
): Promise<SyncMutationResult> {
  const payload = mutation.version;
  if (!payload) {
    return { mutationId: mutation.mutationId, status: 'rejected', error: 'version 载荷缺失' };
  }

  const note = await findNote(env.DB, mutation.entityId);
  if (!note || note.user_id !== auth.user.id) {
    return { mutationId: mutation.mutationId, status: 'rejected', error: '笔记不存在' };
  }

  const existing = await findVersionForUser(env.DB, auth.user.id, mutation.entityId);
  if (existing) {
    return { mutationId: mutation.mutationId, status: 'applied', version: toVersionDto(existing) };
  }

  const row: NoteVersionRow = {
    id: mutation.entityId,
    note_id: note.id,
    user_id: auth.user.id,
    title: payload.title ?? null,
    body: payload.body,
    source: payload.source,
    label: payload.label ?? null,
    device_id: auth.device.id,
    bytes: new TextEncoder().encode(payload.body).length,
    pinned: 0,
    restored_from_id: null,
    created_at: payload.createdAt,
  };
  await insertVersion(env.DB, row);
  await appendChange(env.DB, {
    userId: auth.user.id,
    entity: 'version',
    entityId: row.id,
    op: 'upsert',
    rev: 1,
    createdAt: row.created_at,
  });
  return { mutationId: mutation.mutationId, status: 'applied', version: toVersionDto(row) };
}
