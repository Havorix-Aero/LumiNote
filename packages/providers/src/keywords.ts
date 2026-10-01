import type { SegmenterProvider } from './types';

export interface Keyword {
  term: string;
  count: number;
  /** Relative importance in 0..1, normalized against the most frequent term. */
  weight: number;
}

/**
 * Words that carry no signal for an idea map. Kept small and language-focused rather than
 * exhaustive: over-filtering hides the user's own vocabulary.
 */
export const DEFAULT_STOPWORDS: ReadonlySet<string> = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'if',
  'then',
  'so',
  'of',
  'to',
  'in',
  'on',
  'at',
  'for',
  'with',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'am',
  'do',
  'does',
  'did',
  'it',
  'this',
  'that',
  'these',
  'those',
  'i',
  'you',
  'he',
  'she',
  'we',
  'they',
  'my',
  'your',
  'its',
  'as',
  '的',
  '了',
  '是',
  '在',
  '和',
  '与',
  '或',
  '也',
  '就',
  '都',
  '而',
  '及',
  '对',
  '把',
  '被',
  '我',
  '你',
  '他',
  '她',
  '它',
  '我们',
  '你们',
  '他们',
  '这',
  '那',
  '这个',
  '那个',
  '一个',
  '可以',
  '如果',
  '因为',
  '所以',
  '但是',
  '然后',
  '还是',
  '以及',
  '进行',
  '需要',
  '没有',
]);

export interface ExtractKeywordsOptions {
  limit?: number;
  stopwords?: ReadonlySet<string>;
  /** Terms shorter than this are dropped (single CJK characters rarely make useful tags). */
  minLength?: number;
}

/**
 * Turns note text into weighted keywords using the active segmenter.
 *
 * Segmentation quality is the whole game for Chinese, which is why this takes a provider rather
 * than hard-coding a tokenizer.
 */
export function extractKeywords(
  segmenter: SegmenterProvider,
  text: string,
  options: ExtractKeywordsOptions = {},
): Keyword[] {
  const limit = options.limit ?? 30;
  const stopwords = options.stopwords ?? DEFAULT_STOPWORDS;
  const minLength = options.minLength ?? 2;

  const counts = new Map<string, number>();
  for (const segment of segmenter.segment(text)) {
    if (!segment.isWordLike) continue;
    const term = normalizeTerm(segment.text);
    if (term.length < minLength) continue;
    if (stopwords.has(term)) continue;
    counts.set(term, (counts.get(term) ?? 0) + 1);
  }

  if (counts.size === 0) return [];
  const max = Math.max(...counts.values());
  return [...counts.entries()]
    .map(([term, count]) => ({ term, count, weight: count / max }))
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term))
    .slice(0, limit);
}

function normalizeTerm(value: string): string {
  return value
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
    .trim();
}
