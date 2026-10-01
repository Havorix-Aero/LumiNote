import { diffLines } from '@luminote/versions';
import { useMemo } from 'react';

export interface DiffViewProps {
  before: string;
  after: string;
  /** `split` for desktop, `inline` for the narrow mobile sheet. */
  mode: 'split' | 'inline';
}

const LINE_TONE: Record<string, string> = {
  insert: 'bg-ok-soft text-ok',
  delete: 'bg-critical-soft text-critical',
  equal: 'text-fg-muted',
};

/** Renders a line-level diff between two versions. */
export function DiffView({ before, after, mode }: DiffViewProps) {
  const result = useMemo(() => diffLines(before, after), [before, after]);

  if (result.hunks.length === 0) {
    return <p className="text-xs text-fg-subtle">两个版本内容相同。</p>;
  }

  return (
    <div className={`diff diff--${mode} flex flex-col gap-2`}>
      <div className="diff__summary tabular flex items-center gap-3 text-xs">
        <span className="diff__added font-medium text-ok">+{result.added}</span>
        <span className="diff__removed font-medium text-critical">-{result.removed}</span>
        {result.coarse ? (
          <span className="text-fg-subtle">（内容过大，已按整体替换显示）</span>
        ) : null}
      </div>

      <div className="diff__body scrollbar-slim max-h-96 overflow-auto rounded-lg border border-line bg-surface-2">
        {result.hunks.map((hunk, hunkIndex) => (
          <div className="diff__hunk" key={`${hunk.oldStart}-${hunk.newStart}-${hunkIndex}`}>
            <div className="diff__hunk-header tabular sticky top-0 border-y border-line bg-surface-3 px-2.5 py-1 text-[11px] text-fg-subtle">
              @@ -{hunk.oldStart},{hunk.oldCount} +{hunk.newStart},{hunk.newCount} @@
            </div>
            {hunk.lines.map((line, lineIndex) => (
              <div
                className={[
                  'diff__line diff__line--' + line.type,
                  'flex items-start gap-2 px-2.5 py-0.5 font-mono text-[12px] leading-relaxed',
                  LINE_TONE[line.type] ?? 'text-fg-muted',
                ].join(' ')}
                key={`${hunkIndex}-${lineIndex}`}
              >
                {mode === 'split' ? (
                  <>
                    <span className="diff__gutter tabular w-7 shrink-0 text-right text-fg-subtle select-none">
                      {line.oldLine ?? ''}
                    </span>
                    <span className="diff__gutter tabular w-7 shrink-0 text-right text-fg-subtle select-none">
                      {line.newLine ?? ''}
                    </span>
                  </>
                ) : null}
                <span className="diff__sign w-2 shrink-0 select-none">
                  {line.type === 'insert' ? '+' : line.type === 'delete' ? '-' : ' '}
                </span>
                <span className="diff__text min-w-0 flex-1 whitespace-pre-wrap break-words">
                  {line.text || '\u00a0'}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
