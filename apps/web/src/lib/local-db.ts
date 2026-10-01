import type { VersionSource } from '@luminote/core';
import Dexie, { type Table } from 'dexie';

/**
 * Local mirror of the user's data.
 *
 * The UI reads exclusively from here so capture is instant and works with no network; the sync
 * engine reconciles with the server in the background.
 */
export interface LocalNote {
  id: string;
  title: string | null;
  body: string;
  pinned: boolean;
  rev: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  clientCreatedAt: string | null;
  /** True while a local change has not been acknowledged by the server. */
  dirty: boolean;
}

export interface LocalVersion {
  id: string;
  noteId: string;
  title: string | null;
  body: string;
  source: VersionSource;
  label: string | null;
  deviceId: string | null;
  bytes: number;
  pinned: boolean;
  restoredFromId: string | null;
  createdAt: string;
  dirty: boolean;
}

export interface OutboxEntry {
  /** `${entity}:${entityId}` so repeated edits collapse into a single pending mutation. */
  key: string;
  entity: 'note' | 'version';
  entityId: string;
  op: 'upsert' | 'delete';
  enqueuedAt: string;
}

export interface MetaEntry {
  key: string;
  value: unknown;
}

class LumiNoteDatabase extends Dexie {
  notes!: Table<LocalNote, string>;
  versions!: Table<LocalVersion, string>;
  outbox!: Table<OutboxEntry, string>;
  meta!: Table<MetaEntry, string>;

  constructor() {
    super('luminote');
    this.version(1).stores({
      notes: 'id, updatedAt, deletedAt, dirty',
      versions: 'id, noteId, createdAt, dirty',
      outbox: 'key, entityId, enqueuedAt',
      meta: 'key',
    });
  }
}

export const db = new LumiNoteDatabase();

export const META_KEYS = {
  syncCursor: 'sync.cursor',
  lastUserId: 'session.lastUserId',
} as const;

export async function readMeta<T>(key: string): Promise<T | null> {
  const row = await db.meta.get(key);
  return row ? (row.value as T) : null;
}

export async function writeMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}

/** Wipes local state; used when a different account signs in on this device. */
export async function resetLocalData(): Promise<void> {
  await db.transaction('rw', db.notes, db.versions, db.outbox, db.meta, async () => {
    await Promise.all([db.notes.clear(), db.versions.clear(), db.outbox.clear(), db.meta.clear()]);
  });
}
