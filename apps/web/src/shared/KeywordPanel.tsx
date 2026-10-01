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
    return <p className="muted">写下一些内容后，这里会出现关键词。</p>;
  }

  const max = Math.max(...keywords.map((keyword) => keyword.count));

  return (
    <div className="keywords">
      <div className="keywords__cloud">
        {keywords.map((keyword) => (
          <button
            key={keyword.term}
            type="button"
            className="keywords__term"
            style={{ fontSize: `${0.85 + (keyword.count / max) * 0.7}rem` }}
            title={`出现 ${keyword.count} 次`}
            onClick={() => onPick?.(keyword.term)}
          >
            {keyword.term}
          </button>
        ))}
      </div>
      <p className="muted keywords__hint">点击关键词可插入到正文，用于围绕它继续展开。</p>
    </div>
  );
}
