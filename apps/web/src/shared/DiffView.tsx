import { diffLines } from '@luminote/versions';
import { useMemo } from 'react';

export interface DiffViewProps {
  before: string;
  after: string;
  /** `split` for desktop, `inline` for the narrow mobile sheet. */
  mode: 'split' | 'inline';
}

/** Renders a line-level diff between two versions. */
export function DiffView({ before, after, mode }: DiffViewProps) {
  const result = useMemo(() => diffLines(before, after), [before, after]);

  if (result.hunks.length === 0) {
    return <p className="muted">两个版本内容相同。</p>;
  }

  return (
    <div className={`diff diff--${mode}`}>
      <div className="diff__summary">
        <span className="diff__added">+{result.added}</span>
        <span className="diff__removed">-{result.removed}</span>
        {result.coarse ? <span className="muted">（内容过大，已按整体替换显示）</span> : null}
      </div>
      <div className="diff__body">
        {result.hunks.map((hunk, hunkIndex) => (
          <div className="diff__hunk" key={`${hunk.oldStart}-${hunk.newStart}-${hunkIndex}`}>
            <div className="diff__hunk-header">
              @@ -{hunk.oldStart},{hunk.oldCount} +{hunk.newStart},{hunk.newCount} @@
            </div>
            {hunk.lines.map((line, lineIndex) => (
              <div
                className={`diff__line diff__line--${line.type}`}
                key={`${hunkIndex}-${lineIndex}`}
              >
                {mode === 'split' ? (
                  <>
                    <span className="diff__gutter">{line.oldLine ?? ''}</span>
                    <span className="diff__gutter">{line.newLine ?? ''}</span>
                  </>
                ) : null}
                <span className="diff__sign">
                  {line.type === 'insert' ? '+' : line.type === 'delete' ? '-' : ' '}
                </span>
                <span className="diff__text">{line.text || '\u00a0'}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
