import {
  EDIT_SESSION_IDLE_MS,
  newId,
  nowIso,
  type NoteDto,
  type NoteVersionDto,
  type VersionSource,
} from '@luminote/core';
import { bytesOf, deriveTitle, normalizeSnapshot } from '@luminote/versions';
import { db, type LocalNote, type LocalVersion } from './local-db';

export function toLocalNote(dto: NoteDto): LocalNote {
  return {
    id: dto.id,
    title: dto.title,
    body: dto.body,
    pinned: dto.pinned,
    rev: dto.rev,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    deletedAt: dto.deletedAt,
    clientCreatedAt: dto.clientCreatedAt,
    dirty: false,
  };
}

export function toLocalVersion(dto: NoteVersionDto): LocalVersion {
  return {
    id: dto.id,
    noteId: dto.noteId,
    title: dto.title,
    body: dto.body,
    source: dto.source,
    label: dto.label,
    deviceId: dto.deviceId,
    bytes: dto.bytes,
    pinned: dto.pinned,
    restoredFromId: dto.restoredFromId,
    createdAt: dto.createdAt,
    dirty: false,
  };
}

async function enqueue(
  entity: 'note' | 'version',
  entityId: string,
  op: 'upsert' | 'delete',
): Promise<void> {
  await db.outbox.put({
    key: `${entity}:${entityId}`,
    entity,
    entityId,
    op,
    enqueuedAt: nowIso(),
  });
}

// ------------------------------------------------------------------ notes

export async function listLocalNotes(): Promise<LocalNote[]> {
  const notes = await db.notes.filter((note) => note.deletedAt === null).toArray();
  return notes.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

export async function getLocalNote(id: string): Promise<LocalNote | undefined> {
  return db.notes.get(id);
}

export async function createLocalNote(initialBody = ''): Promise<LocalNote> {
  const timestamp = nowIso();
  const note: LocalNote = {
    id: newId('note'),
    title: deriveTitle(initialBody),
    body: initialBody,
    pinned: false,
    rev: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    clientCreatedAt: timestamp,
    dirty: true,
  };
  await db.notes.put(note);
  await enqueue('note', note.id, 'upsert');
  return note;
}

export interface LocalNotePatch {
  title?: string | null;
  body?: string;
  pinned?: boolean;
}

export async function updateLocalNote(id: string, patch: LocalNotePatch): Promise<LocalNote> {
  const existing = await db.notes.get(id);
  if (!existing) throw new Error('笔记不存在');

  const nextTitle = patch.title !== undefined ? patch.title : existing.title;
  const nextBody = patch.body !== undefined ? patch.body : existing.body;
  const contentChanged = nextTitle !== existing.title || nextBody !== existing.body;

  // One automatic snapshot per editing session: capture the pre-edit content the first time the
  // user touches this note after it has been idle.
  if (contentChanged) {
    await captureSessionSnapshot(existing);
  }

  const updated: LocalNote = {
    ...existing,
    title: nextTitle,
    body: nextBody,
    pinned: patch.pinned !== undefined ? patch.pinned : existing.pinned,
    updatedAt: nowIso(),
    dirty: true,
  };
  await db.notes.put(updated);
  await enqueue('note', id, 'upsert');
  return updated;
}

export async function deleteLocalNote(id: string): Promise<void> {
  const existing = await db.notes.get(id);
  if (!existing) return;
  const timestamp = nowIso();
  await captureSessionSnapshot(existing);
  await db.notes.put({ ...existing, deletedAt: timestamp, updatedAt: timestamp, dirty: true });
  await enqueue('note', id, 'delete');
}

// ------------------------------------------------------------------ version history

export async function listLocalVersions(noteId: string): Promise<LocalVersion[]> {
  const versions = await db.versions.where('noteId').equals(noteId).toArray();
  return versions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function latestLocalVersion(noteId: string): Promise<LocalVersion | null> {
  const versions = await listLocalVersions(noteId);
  return versions[0] ?? null;
}

export interface CreateVersionOptions {
  source: VersionSource;
  label?: string | null;
  restoredFromId?: string | null;
  title?: string | null;
  body?: string;
  createdAt?: string;
  /** Skip the "identical to the newest version" check. */
  force?: boolean;
}

export async function createLocalVersion(
  noteId: string,
  options: CreateVersionOptions,
): Promise<LocalVersion | null> {
  const note = await db.notes.get(noteId);
  if (!note) return null;

  const candidate = normalizeSnapshot({
    title: options.title !== undefined ? options.title : note.title,
    body: options.body !== undefined ? options.body : note.body,
  });

  if (!options.force) {
    const latest = await latestLocalVersion(noteId);
    if (
      latest &&
      latest.body === candidate.body &&
      (latest.title ?? null) === (candidate.title ?? null)
    ) {
      return null;
    }
    if (candidate.body.trim().length === 0) return null;
  }

  const version: LocalVersion = {
    id: newId('ver'),
    noteId,
    title: candidate.title,
    body: candidate.body,
    source: options.source,
    label: options.label ?? null,
    deviceId: null,
    bytes: bytesOf(candidate.body),
    pinned: false,
    restoredFromId: options.restoredFromId ?? null,
    createdAt: options.createdAt ?? nowIso(),
    dirty: true,
  };
  await db.versions.put(version);
  await enqueue('version', version.id, 'upsert');
  return version;
}

async function captureSessionSnapshot(note: LocalNote): Promise<void> {
  const latest = await latestLocalVersion(note.id);
  if (latest) {
    const elapsed = Date.now() - Date.parse(latest.createdAt);
    if (elapsed < EDIT_SESSION_IDLE_MS) return;
  }
  if (note.body.trim().length === 0 && !note.title) return;
  await createLocalVersion(note.id, {
    source: 'auto',
    title: note.title,
    body: note.body,
    createdAt: nowIso(),
  });
}

export async function saveVersionNow(noteId: string, label?: string): Promise<LocalVersion | null> {
  return createLocalVersion(noteId, { source: 'manual', label: label ?? null, force: true });
}

export async function setVersionFlags(
  versionId: string,
  patch: { pinned?: boolean; label?: string | null },
): Promise<void> {
  const existing = await db.versions.get(versionId);
  if (!existing) return;
  // Pin/label are server-side metadata; the PATCH endpoint is authoritative.
  await db.versions.put({ ...existing, ...patch });
}

export async function restoreLocalVersion(noteId: string, versionId: string): Promise<LocalNote> {
  const version = await db.versions.get(versionId);
  const note = await db.notes.get(noteId);
  if (!version || !note || version.noteId !== noteId) throw new Error('版本不存在');

  await createLocalVersion(noteId, {
    source: 'auto',
    title: note.title,
    body: note.body,
    force: true,
  });

  const timestamp = nowIso();
  const restored: LocalNote = {
    ...note,
    title: version.title,
    body: version.body,
    updatedAt: timestamp,
    dirty: true,
  };
  await db.notes.put(restored);
  await enqueue('note', noteId, 'upsert');

  const marker = await createLocalVersion(noteId, {
    source: 'restore',
    label: `恢复自 ${version.createdAt.slice(0, 16).replace('T', ' ')}`,
    restoredFromId: version.id,
    title: version.title,
    body: version.body,
    force: true,
  });
  void marker;

  return restored;
}

/** Replaces local rows with server truth while keeping anything still pending in the outbox. */
export async function reconcileFromServer(
  notes: NoteDto[],
  versions: NoteVersionDto[],
): Promise<void> {
  await db.transaction('rw', db.notes, db.versions, async () => {
    for (const dto of notes) {
      const local = await db.notes.get(dto.id);
      if (local?.dirty && local.updatedAt > dto.updatedAt) continue;
      await db.notes.put(toLocalNote(dto));
    }
    for (const dto of versions) {
      const existing = await db.versions.get(dto.id);
      if (existing?.dirty) continue;
      await db.versions.put(toLocalVersion(dto));
    }
  });
}
