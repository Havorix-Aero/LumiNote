import type { Segment, SegmenterProvider } from '../types';

/**
 * Word segmentation via the platform's built-in ICU segmenter.
 *
 * For Chinese this gives real dictionary-based word breaks with no dictionary to ship, which is
 * exactly what keyword extraction and the word cloud need. It sits behind the provider interface
 * so a jieba-class segmenter can replace it without touching the UI.
 */
export class IntlSegmenterProvider implements SegmenterProvider {
  readonly name = 'intl-segmenter';
  readonly #locale: string;

  constructor(locale = 'zh-Hans') {
    this.#locale = locale;
  }

  segment(text: string, locale = this.#locale): Segment[] {
    const supported =
      typeof Intl !== 'undefined' &&
      typeof (Intl as { Segmenter?: unknown }).Segmenter === 'function';
    if (!supported) return fallbackSegment(text);

    const segmenter = new Intl.Segmenter(locale, { granularity: 'word' });
    const out: Segment[] = [];
    for (const part of segmenter.segment(text)) {
      out.push({ text: part.segment, isWordLike: part.isWordLike === true });
    }
    return out;
  }
}

/**
 * Degrades to CJK-character grouping plus latin word splitting when the runtime has no ICU
 * segmenter (older WebViews).
 */
function fallbackSegment(text: string): Segment[] {
  const out: Segment[] = [];
  const pattern = /[A-Za-z0-9']+|[^\sA-Za-z0-9']/gu;
  for (const match of text.matchAll(pattern)) {
    const value = match[0];
    out.push({ text: value, isWordLike: /[\p{L}\p{N}]/u.test(value) });
  }
  return out;
}
