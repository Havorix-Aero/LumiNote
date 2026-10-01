import { SYNC_PAGE_SIZE, type SyncPushResponse, type SyncPullResponse } from '@luminote/core';
import { apiFetch } from './api';
import { META_KEYS, db, readMeta, writeMeta, type OutboxEntry } from './local-db';
import { reconcileFromServer } from './repository';

export interface SyncReport {
  pushed: number;
  conflicts: number;
  rejected: number;
  pulled: number;
  cursor: number;
  at: string;
}

let running = false;

function mutationIdFor(entry: OutboxEntry): string {
  return `${entry.entity}:${entry.entityId}:${entry.enqueuedAt}`;
}

/**
 * Drains the outbox, then pulls everything other devices changed.
 *
 * Push-before-pull matters: it means the server has already decided who wins a conflicting edit
 * before this device sees the result, so the user never watches their own text get overwritten.
 */
export async function runSync(): Promise<SyncReport> {
  if (running)
    return {
      pushed: 0,
      conflicts: 0,
      rejected: 0,
      pulled: 0,
      cursor: 0,
      at: new Date().toISOString(),
    };
  running = true;
  try {
    const pushed = await pushOutbox();
    const pulled = await pullChanges();
    return {
      ...pushed,
      pulled: pulled.pulled,
      cursor: pulled.cursor,
      at: new Date().toISOString(),
    };
  } finally {
    running = false;
  }
}

async function pushOutbox(): Promise<Omit<SyncReport, 'pulled' | 'at'>> {
  const entries = await db.outbox.orderBy('enqueuedAt').limit(SYNC_PAGE_SIZE).toArray();
  if (entries.length === 0) {
    return { pushed: 0, conflicts: 0, rejected: 0, cursor: await currentCursor() };
  }

  const mutations = [];
  for (const entry of entries) {
    if (entry.entity === 'note') {
      const note = await db.notes.get(entry.entityId);
      if (!note) {
        await db.outbox.delete(entry.key);
        continue;
      }
      mutations.push({
        mutationId: mutationIdFor(entry),
        entity: 'note' as const,
        entityId: entry.entityId,
        op: entry.op,
        note: {
          title: note.title,
          body: note.body,
          pinned: note.pinned,
          createdAt: note.clientCreatedAt ?? note.createdAt,
          updatedAt: note.updatedAt,
          deletedAt: note.deletedAt,
          baseRev: note.rev,
        },
      });
    } else {
      const version = await db.versions.get(entry.entityId);
      if (!version) {
        await db.outbox.delete(entry.key);
        continue;
      }
      mutations.push({
        mutationId: mutationIdFor(entry),
        entity: 'version' as const,
        entityId: entry.entityId,
        op: entry.op,
        version: {
          title: version.title,
          body: version.body,
          source: version.source,
          label: version.label,
          createdAt: version.createdAt,
        },
      });
    }
  }

  if (mutations.length === 0) {
    return { pushed: 0, conflicts: 0, rejected: 0, cursor: await currentCursor() };
  }

  const response = await apiFetch<SyncPushResponse>('/api/v1/sync/push', {
    method: 'POST',
    json: { mutations },
  });

  let pushed = 0;
  let conflicts = 0;
  let rejected = 0;

  const byMutationId = new Map(entries.map((entry) => [mutationIdFor(entry), entry]));

  for (const result of response.results) {
    const entry = byMutationId.get(result.mutationId);
    if (!entry) continue;

    if (result.status === 'rejected') {
      rejected++;
      await db.outbox.delete(entry.key);
      continue;
    }

    if (entry.entity === 'note') {
      const note = await db.notes.get(entry.entityId);
      if (note) {
        if (result.status === 'conflict' && result.note) {
          // The server copy won. Adopt it; the losing text is preserved server-side as a version
          // and will arrive on the next pull.
          conflicts++;
          await db.notes.put({
            ...note,
            title: result.note.title,
            body: result.note.body,
            pinned: result.note.pinned,
            rev: result.note.rev,
            updatedAt: result.note.updatedAt,
            deletedAt: result.note.deletedAt,
            dirty: false,
          });
        } else {
          await db.notes.put({
            ...note,
            rev: result.rev ?? note.rev,
            updatedAt: result.note?.updatedAt ?? note.updatedAt,
            dirty: false,
          });
        }
      }
    } else {
      const version = await db.versions.get(entry.entityId);
      if (version) await db.versions.put({ ...version, dirty: false });
    }

    await db.outbox.delete(entry.key);
    pushed++;
  }

  await writeMeta(META_KEYS.syncCursor, response.cursor);
  return { pushed, conflicts, rejected, cursor: response.cursor };
}

async function currentCursor(): Promise<number> {
  return (await readMeta<number>(META_KEYS.syncCursor)) ?? 0;
}

async function pullChanges(): Promise<{ pulled: number; cursor: number }> {
  let cursor = await currentCursor();
  let pulled = 0;

  for (let guard = 0; guard < 20; guard++) {
    const response = await apiFetch<SyncPullResponse>('/api/v1/sync/pull', {
      method: 'POST',
      json: { cursor, limit: SYNC_PAGE_SIZE },
    });

    await reconcileFromServer(response.notes, response.versions);
    pulled += response.notes.length + response.versions.length;
    cursor = response.cursor;
    await writeMeta(META_KEYS.syncCursor, cursor);

    if (!response.hasMore) break;
  }

  return { pulled, cursor };
}

export type SyncListener = (report: SyncReport | null, error: unknown) => void;

const listeners = new Set<SyncListener>();

export function onSync(listener: SyncListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function tick(): Promise<void> {
  if (!navigator.onLine) return;
  try {
    const report = await runSync();
    for (const listener of listeners) listener(report, null);
  } catch (error) {
    for (const listener of listeners) listener(null, error);
  }
}

/**
 * Runs sync on an interval, on reconnect, and whenever the tab becomes visible again — the three
 * moments when a device is most likely to have something new to exchange.
 */
export function startSyncLoop(intervalMs = 15_000): () => void {
  const timer = window.setInterval(() => void tick(), intervalMs);
  const onOnline = () => void tick();
  const onVisible = () => {
    if (document.visibilityState === 'visible') void tick();
  };

  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisible);
  void tick();

  return () => {
    window.clearInterval(timer);
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
