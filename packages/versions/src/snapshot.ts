import { NOTE_TITLE_MAX_LENGTH } from '@luminote/core';

export interface SnapshotContent {
  title: string | null;
  body: string;
}

const utf8 = new TextEncoder();

export function bytesOf(text: string): number {
  return utf8.encode(text).length;
}

/**
 * A note has no separate title field, so the first meaningful line becomes the provisional title.
 * Leading list markers and heading marks are stripped so "- buy milk" reads as "buy milk".
 */
export function deriveTitle(body: string, maxLength = NOTE_TITLE_MAX_LENGTH): string | null {
  for (const rawLine of body.split('\n')) {
    const line = rawLine
      .trim()
      .replace(/^#{1,6}\s+/, '')
      .replace(/^([-*+]|\d+[.)])\s+/, '')
      .trim();
    if (line.length === 0) continue;
    return line.length > maxLength ? `${line.slice(0, maxLength - 1)}…` : line;
  }
  return null;
}

function isBlank(content: SnapshotContent): boolean {
  return content.body.trim().length === 0 && (content.title ?? '').trim().length === 0;
}

/**
 * Decides whether a snapshot is worth persisting.
 *
 * Skipped when: the content is empty, or it is byte-identical to the version we would be
 * stacking on top of (a no-op snapshot adds noise to the timeline without adding information).
 */
export function shouldStoreSnapshot(
  candidate: SnapshotContent,
  previous: SnapshotContent | null,
): boolean {
  if (isBlank(candidate)) return false;
  if (!previous) return true;
  return !(
    candidate.body === previous.body && (candidate.title ?? null) === (previous.title ?? null)
  );
}

/**
 * Normalizes what gets stored so the timeline compares like-for-like.
 */
export function normalizeSnapshot(content: SnapshotContent): SnapshotContent {
  return {
    title: content.title ?? deriveTitle(content.body),
    body: content.body,
  };
}
