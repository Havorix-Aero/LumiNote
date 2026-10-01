export type DiffLineType = 'equal' | 'insert' | 'delete';

export interface DiffLine {
  type: DiffLineType;
  text: string;
  /** 1-based line number in the old text; null for inserted lines. */
  oldLine: number | null;
  /** 1-based line number in the new text; null for deleted lines. */
  newLine: number | null;
}

export interface DiffHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLine[];
}

export interface DiffResult {
  hunks: DiffHunk[];
  added: number;
  removed: number;
  /** True when the inputs were too large for a precise diff and were reported as a full replace. */
  coarse: boolean;
}

const CONTEXT_LINES = 3;
/** Guards against O(n·m) blow-up on pathological notes. */
const MAX_DP_CELLS = 2_000_000;

function toLines(text: string): string[] {
  return text.length === 0 ? [] : text.split('\n');
}

/**
 * Line-level diff between two document bodies.
 *
 * Uses an LCS dynamic program. Notes are prose, not source code, so line granularity is the right
 * level of detail and keeps the whole thing dependency-free. Very large documents degrade to a
 * single replace hunk rather than exhausting memory.
 */
export function diffLines(oldText: string, newText: string): DiffResult {
  const oldLines = toLines(oldText);
  const newLines = toLines(newText);

  const n = oldLines.length;
  const m = newLines.length;

  if (n === 0 && m === 0) {
    return { hunks: [], added: 0, removed: 0, coarse: false };
  }

  if ((n + 1) * (m + 1) > MAX_DP_CELLS) {
    const lines: DiffLine[] = [
      ...oldLines.map((text, i) => ({
        type: 'delete' as const,
        text,
        oldLine: i + 1,
        newLine: null,
      })),
      ...newLines.map((text, i) => ({
        type: 'insert' as const,
        text,
        oldLine: null,
        newLine: i + 1,
      })),
    ];
    return {
      hunks: [
        {
          oldStart: n === 0 ? 0 : 1,
          oldCount: n,
          newStart: m === 0 ? 0 : 1,
          newCount: m,
          lines,
        },
      ],
      added: m,
      removed: n,
      coarse: true,
    };
  }

  const width = m + 1;
  const dp = new Uint32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * width + j] =
        oldLines[i] === newLines[j]
          ? (dp[(i + 1) * width + (j + 1)] as number) + 1
          : Math.max(dp[(i + 1) * width + j] as number, dp[i * width + (j + 1)] as number);
    }
  }

  const flat: DiffLine[] = [];
  let added = 0;
  let removed = 0;
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (oldLines[i] === newLines[j]) {
      flat.push({ type: 'equal', text: oldLines[i] as string, oldLine: i + 1, newLine: j + 1 });
      i++;
      j++;
    } else if ((dp[(i + 1) * width + j] as number) >= (dp[i * width + (j + 1)] as number)) {
      flat.push({ type: 'delete', text: oldLines[i] as string, oldLine: i + 1, newLine: null });
      removed++;
      i++;
    } else {
      flat.push({ type: 'insert', text: newLines[j] as string, oldLine: null, newLine: j + 1 });
      added++;
      j++;
    }
  }
  while (i < n) {
    flat.push({ type: 'delete', text: oldLines[i] as string, oldLine: i + 1, newLine: null });
    removed++;
    i++;
  }
  while (j < m) {
    flat.push({ type: 'insert', text: newLines[j] as string, oldLine: null, newLine: j + 1 });
    added++;
    j++;
  }

  return { hunks: groupHunks(flat), added, removed, coarse: false };
}

function groupHunks(lines: DiffLine[]): DiffHunk[] {
  const changed: number[] = [];
  for (let index = 0; index < lines.length; index++) {
    if (lines[index]?.type !== 'equal') changed.push(index);
  }
  if (changed.length === 0) return [];

  const ranges: Array<[number, number]> = [];
  for (const index of changed) {
    const start = Math.max(0, index - CONTEXT_LINES);
    const end = Math.min(lines.length - 1, index + CONTEXT_LINES);
    const last = ranges[ranges.length - 1];
    if (last && start <= last[1] + 1) {
      last[1] = Math.max(last[1], end);
    } else {
      ranges.push([start, end]);
    }
  }

  return ranges.map(([start, end]) => {
    const slice = lines.slice(start, end + 1);
    const oldNumbers = slice.map((l) => l.oldLine).filter((v): v is number => v !== null);
    const newNumbers = slice.map((l) => l.newLine).filter((v): v is number => v !== null);
    return {
      oldStart: oldNumbers[0] ?? 0,
      oldCount: oldNumbers.length,
      newStart: newNumbers[0] ?? 0,
      newCount: newNumbers.length,
      lines: slice,
    };
  });
}
