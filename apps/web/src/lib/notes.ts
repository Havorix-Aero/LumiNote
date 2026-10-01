import type { LocalNote, LocalVersion } from './local-db';
import { useSyncExternalStore } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './local-db';
import { getLocalNote, listLocalNotes, listLocalVersions } from './repository';
import { onSync, type SyncReport } from './sync';

export function useLocalNotes(): LocalNote[] {
  return useLiveQuery(() => listLocalNotes(), [], [] as LocalNote[]);
}

export function useLocalNote(id: string | undefined): LocalNote | undefined {
  return useLiveQuery(() => (id ? getLocalNote(id) : undefined), [id]);
}

export function useLocalVersions(noteId: string | undefined): LocalVersion[] {
  return useLiveQuery(
    () => (noteId ? listLocalVersions(noteId) : Promise.resolve([] as LocalVersion[])),
    [noteId],
    [] as LocalVersion[],
  );
}

export function usePendingCount(): number {
  return useLiveQuery(() => db.outbox.count(), [], 0);
}

// ------------------------------------------------------------------ sync status

export interface SyncStatus {
  report: SyncReport | null;
  error: unknown;
  syncing: boolean;
}

let status: SyncStatus = { report: null, error: null, syncing: false };
const statusListeners = new Set<() => void>();
let started = false;

function notify() {
  for (const listener of statusListeners) listener();
}

function ensureStarted(): void {
  if (started) return;
  started = true;
  onSync((report, error) => {
    status = { report, error, syncing: false };
    notify();
  });
}

ensureStarted();

export function markSyncing(syncing: boolean): void {
  status = { ...status, syncing };
  notify();
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (listener) => {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
    () => status,
    () => status,
  );
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    (listener) => {
      window.addEventListener('online', listener);
      window.addEventListener('offline', listener);
      return () => {
        window.removeEventListener('online', listener);
        window.removeEventListener('offline', listener);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}
