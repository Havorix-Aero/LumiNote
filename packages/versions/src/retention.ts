import { VERSION_RETENTION_DAYS, type VersionSource } from '@luminote/core';

export interface RetentionCandidate {
  id: string;
  source: VersionSource;
  pinned: boolean;
  createdAt: string;
}

export interface RetentionOptions {
  /** Reference time; injected so the rule is deterministic under test. */
  now: Date;
  retentionDays?: number;
  /** Upper bound on retained non-pinned auto versions per note. */
  hardCapPerNote?: number;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Chooses which versions to delete.
 *
 * Only automatic, unpinned versions older than the retention window are eligible. Within that set
 * the newest version of each UTC day survives — older snapshots collapse to a daily rollup, so a
 * note edited heavily a year ago still leaves one restore point per day. Manual, pinned and
 * restore-created versions are never pruned.
 */
export function retentionPlan(
  candidates: readonly RetentionCandidate[],
  options: RetentionOptions,
): string[] {
  const retentionDays = options.retentionDays ?? VERSION_RETENTION_DAYS;
  const hardCap = options.hardCapPerNote ?? 500;
  const cutoff = options.now.getTime() - retentionDays * 24 * 60 * 60 * 1000;

  const protectedIds = new Set(
    candidates.filter((c) => c.pinned || c.source !== 'auto').map((c) => c.id),
  );

  const eligible = candidates
    .filter((c) => !protectedIds.has(c.id))
    .filter((c) => new Date(c.createdAt).getTime() < cutoff)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const pruned = new Set<string>();
  const seenDays = new Set<string>();
  for (const candidate of eligible) {
    const key = dayKey(candidate.createdAt);
    if (seenDays.has(key)) {
      pruned.add(candidate.id);
    } else {
      seenDays.add(key);
    }
  }

  const survivors = candidates.filter((c) => !pruned.has(c.id));
  const autoSurvivors = survivors
    .filter((c) => !c.pinned && c.source === 'auto')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const excess of autoSurvivors.slice(hardCap)) {
    pruned.add(excess.id);
  }

  return [...pruned];
}
