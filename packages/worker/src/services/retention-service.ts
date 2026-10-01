import { VERSION_RETENTION_DAYS } from '@luminote/core';
import { retentionPlan, type RetentionCandidate } from '@luminote/versions';
import { deleteExpiredChallenges } from '../db/auth-repo';
import { pruneOrphanedSyncCursors, trimConsumedChangeLog } from '../db/changelog-repo';
import { deleteRateLimitsOlderThan } from '../db/rate-limit-repo';
import { deleteVersionsByIds, listOldAutoVersions } from '../db/versions-repo';
import type { Env } from '../env';

export interface RetentionReport {
  versionsPruned: number;
  changeLogTrimmed: number;
  rateLimitsPruned: number;
}

/**
 * Daily housekeeping.
 *
 * `note_versions` is the one table that grows without bound, so it gets the careful treatment:
 * within the retention window, automatic snapshots collapse to one per note per day. Manual,
 * pinned and restore entries are never touched, which is what makes history trustworthy.
 */
export async function runRetention(env: Env, now: Date = new Date()): Promise<RetentionReport> {
  const cutoff = new Date(
    now.getTime() - VERSION_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const candidates = await listOldAutoVersions(env.DB, cutoff);

  const byNote = new Map<string, RetentionCandidate[]>();
  for (const row of candidates) {
    const list = byNote.get(row.note_id) ?? [];
    list.push({
      id: row.id,
      source: row.source,
      pinned: row.pinned === 1,
      createdAt: row.created_at,
    });
    byNote.set(row.note_id, list);
  }

  const toDelete: string[] = [];
  for (const versions of byNote.values()) {
    toDelete.push(...retentionPlan(versions, { now, retentionDays: VERSION_RETENTION_DAYS }));
  }
  await deleteVersionsByIds(env.DB, toDelete);

  await pruneOrphanedSyncCursors(env.DB);
  const changeLogTrimmed = await trimConsumedChangeLog(env.DB);

  await deleteExpiredChallenges(env.DB, now.toISOString());
  const rateLimitsPruned = await deleteRateLimitsOlderThan(
    env.DB,
    Math.floor(now.getTime() / 1000) - 24 * 60 * 60,
  );

  return { versionsPruned: toDelete.length, changeLogTrimmed, rateLimitsPruned };
}
