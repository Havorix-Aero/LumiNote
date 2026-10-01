import type { RateLimitRow } from './types';

export interface RateLimitState {
  count: number;
  windowStart: number;
  /** Seconds until the current window rolls over. */
  retryAfter: number;
}

/**
 * Fixed-window counter backed by D1.
 *
 * D1 rather than KV because throttling must be immediately consistent: an attacker must not be
 * able to replay a burst against a different edge location that has not seen the earlier attempts.
 */
export async function incrementRateLimit(
  db: D1Database,
  bucketKey: string,
  windowSeconds: number,
  nowEpochSeconds: number,
): Promise<RateLimitState> {
  const windowStart = nowEpochSeconds - (nowEpochSeconds % windowSeconds);
  await db
    .prepare(
      `INSERT INTO rate_limits (bucket_key, window_start, count)
       VALUES (?1, ?2, 1)
       ON CONFLICT (bucket_key) DO UPDATE SET
         count = CASE
           WHEN rate_limits.window_start = ?2 THEN rate_limits.count + 1
           ELSE 1
         END,
         window_start = ?2`,
    )
    .bind(bucketKey, windowStart)
    .run();

  const row = await readRateLimit(db, bucketKey);
  const count = row?.count ?? 1;
  const start = row?.window_start ?? windowStart;
  return {
    count,
    windowStart: start,
    retryAfter: Math.max(1, start + windowSeconds - nowEpochSeconds),
  };
}

export function readRateLimit(db: D1Database, bucketKey: string): Promise<RateLimitRow | null> {
  return db
    .prepare('SELECT bucket_key, window_start, count FROM rate_limits WHERE bucket_key = ?1')
    .bind(bucketKey)
    .first<RateLimitRow>();
}

export async function clearRateLimit(db: D1Database, bucketKey: string): Promise<void> {
  await db.prepare('DELETE FROM rate_limits WHERE bucket_key = ?1').bind(bucketKey).run();
}

export async function clearRateLimitsWithPrefix(db: D1Database, prefix: string): Promise<void> {
  await db.prepare("DELETE FROM rate_limits WHERE bucket_key LIKE ?1 || '%'").bind(prefix).run();
}

/** Rate-limit buckets are only meaningful for a short window; drop the rest. */
export async function deleteRateLimitsOlderThan(
  db: D1Database,
  beforeEpochSeconds: number,
): Promise<number> {
  const result = await db
    .prepare('DELETE FROM rate_limits WHERE window_start < ?1')
    .bind(beforeEpochSeconds)
    .run();
  return Number(result.meta.changes ?? 0);
}
