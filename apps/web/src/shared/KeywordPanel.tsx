import { IntlSegmenterProvider, extractKeywords } from '@luminote/providers';
import { useMemo } from 'react';

const segmenter = new IntlSegmenterProvider();

export interface KeywordPanelProps {
  body: string;
  onPick?: (term: string) => void;
}

/**
 * Keyword extraction with a frequency-weighted cloud.
 *
 * Real Chinese word segmentation comes from the platform segmenter, which is why this works
 * offline and without a dictionary; the layout is intentionally simple (frequency sizing) until
 * the dedicated cloud view lands.
 */
export function KeywordPanel({ body, onPick }: KeywordPanelProps) {
  const keywords = useMemo(() => extractKeywords(segmenter, body, { limit: 24 }), [body]);

  if (keywords.length === 0) {
    return (
      <p className="text-xs leading-relaxed text-fg-subtle">写下一些内容后，这里会出现关键词。</p>
    );
  }

  const max = Math.max(...keywords.map((keyword) => keyword.count));

  return (
    <div className="keywords flex flex-col gap-2.5">
      <div className="keywords__cloud flex flex-wrap gap-1.5">
        {keywords.map((keyword) => (
          <button
            key={keyword.term}
            type="button"
            className="keywords__term inline-flex min-h-8 cursor-pointer items-center rounded-full border border-line bg-surface-2 px-2.5 text-fg-muted transition-colors hover:border-accent/50 hover:bg-accent-soft hover:text-accent-ink"
            style={{ fontSize: `${0.8 + (keyword.count / max) * 0.35}rem` }}
            title={`出现 ${keyword.count} 次`}
            onClick={() => onPick?.(keyword.term)}
          >
            {keyword.term}
          </button>
        ))}
      </div>
      <p className="keywords__hint text-[11px] leading-relaxed text-fg-subtle">
        点击关键词可插入到正文，用于围绕它继续展开。
      </p>
    </div>
  );
}
