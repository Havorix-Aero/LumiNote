import { describe, expect, it } from 'vitest';
import { diffLines } from './diff';
import { retentionPlan, type RetentionCandidate } from './retention';
import { bytesOf, deriveTitle, normalizeSnapshot, shouldStoreSnapshot } from './snapshot';

describe('deriveTitle', () => {
  it('uses the first non-empty line', () => {
    expect(deriveTitle('\n\n  关于音乐 App 的想法  \n第二行')).toBe('关于音乐 App 的想法');
  });

  it('strips list markers and heading marks', () => {
    expect(deriveTitle('- 买牛奶')).toBe('买牛奶');
    expect(deriveTitle('## 标题')).toBe('标题');
    expect(deriveTitle('1. 第一步')).toBe('第一步');
  });

  it('returns null for blank content', () => {
    expect(deriveTitle('   \n\n')).toBeNull();
  });

  it('truncates very long lines', () => {
    const title = deriveTitle('好'.repeat(500));
    expect(title?.length).toBeLessThanOrEqual(200);
    expect(title?.endsWith('…')).toBe(true);
  });
});

describe('shouldStoreSnapshot', () => {
  it('skips empty content', () => {
    expect(shouldStoreSnapshot({ title: null, body: '   ' }, null)).toBe(false);
  });

  it('stores the first snapshot', () => {
    expect(shouldStoreSnapshot({ title: null, body: '内容' }, null)).toBe(true);
  });

  it('skips a no-op snapshot', () => {
    const content = { title: '标题', body: '内容' };
    expect(shouldStoreSnapshot(content, { ...content })).toBe(false);
  });

  it('stores a changed body', () => {
    expect(shouldStoreSnapshot({ title: 'a', body: 'new' }, { title: 'a', body: 'old' })).toBe(
      true,
    );
  });
});

describe('normalizeSnapshot', () => {
  it('derives a title when none is provided', () => {
    expect(normalizeSnapshot({ title: null, body: '第一行\n第二行' }).title).toBe('第一行');
  });
});

describe('bytesOf', () => {
  it('counts utf-8 bytes rather than characters', () => {
    expect(bytesOf('中')).toBe(3);
    expect(bytesOf('abc')).toBe(3);
  });
});

describe('diffLines', () => {
  it('reports no hunks for identical text', () => {
    const result = diffLines('a\nb', 'a\nb');
    expect(result.hunks).toHaveLength(0);
    expect(result.added).toBe(0);
    expect(result.removed).toBe(0);
  });

  it('detects an inserted line', () => {
    const result = diffLines('a\nc', 'a\nb\nc');
    expect(result.added).toBe(1);
    expect(result.removed).toBe(0);
    const inserted = result.hunks.flatMap((hunk) => hunk.lines).filter((l) => l.type === 'insert');
    expect(inserted.map((l) => l.text)).toEqual(['b']);
  });

  it('detects a deleted line', () => {
    const result = diffLines('a\nb\nc', 'a\nc');
    expect(result.removed).toBe(1);
    expect(result.added).toBe(0);
  });

  it('detects a replacement as one delete plus one insert', () => {
    const result = diffLines('hello', 'world');
    expect(result.added).toBe(1);
    expect(result.removed).toBe(1);
  });

  it('keeps line numbers consistent', () => {
    const result = diffLines('a\nb', 'a\nx\nb');
    const inserted = result.hunks.flatMap((hunk) => hunk.lines).find((l) => l.type === 'insert');
    expect(inserted?.oldLine).toBeNull();
    expect(inserted?.newLine).toBe(2);
  });

  it('handles empty inputs', () => {
    expect(diffLines('', '').hunks).toHaveLength(0);
    expect(diffLines('', 'a').added).toBe(1);
    expect(diffLines('a', '').removed).toBe(1);
  });
});

describe('retentionPlan', () => {
  const now = new Date('2026-06-01T00:00:00.000Z');

  function candidate(
    id: string,
    createdAt: string,
    overrides: Partial<RetentionCandidate> = {},
  ): RetentionCandidate {
    return { id, source: 'auto', pinned: false, createdAt, ...overrides };
  }

  it('keeps recent versions', () => {
    const plan = retentionPlan([candidate('a', '2026-05-30T10:00:00.000Z')], { now });
    expect(plan).toEqual([]);
  });

  it('collapses old automatic versions to one per day', () => {
    const plan = retentionPlan(
      [
        candidate('newest', '2026-01-05T18:00:00.000Z'),
        candidate('same-day', '2026-01-05T09:00:00.000Z'),
        candidate('other-day', '2026-01-04T09:00:00.000Z'),
      ],
      { now },
    );
    expect(plan).toEqual(['same-day']);
  });

  it('never prunes manual or pinned versions', () => {
    const plan = retentionPlan(
      [
        candidate('manual', '2026-01-01T09:00:00.000Z', { source: 'manual' }),
        candidate('pinned', '2026-01-01T10:00:00.000Z', { pinned: true }),
        candidate('auto-a', '2026-01-01T11:00:00.000Z'),
        candidate('auto-b', '2026-01-01T12:00:00.000Z'),
      ],
      { now },
    );
    expect(plan).toEqual(['auto-a']);
  });

  it('enforces the hard cap on unpinned automatic versions', () => {
    const versions: RetentionCandidate[] = [];
    for (let day = 0; day < 6; day++) {
      versions.push(
        candidate(`v${day}`, `2026-05-${(20 + day).toString().padStart(2, '0')}T10:00:00.000Z`),
      );
    }
    const plan = retentionPlan(versions, { now, hardCapPerNote: 2 });
    expect(plan).toHaveLength(4);
    expect(plan).not.toContain('v5');
    expect(plan).not.toContain('v4');
  });

  it('leaves restore-created versions alone', () => {
    const plan = retentionPlan(
      [
        candidate('restore', '2026-01-01T09:00:00.000Z', { source: 'restore' }),
        candidate('auto', '2026-01-01T10:00:00.000Z'),
      ],
      { now },
    );
    expect(plan).toEqual([]);
  });
});
