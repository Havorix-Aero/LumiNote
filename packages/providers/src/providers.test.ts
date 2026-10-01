import { describe, expect, it } from 'vitest';
import { DEFAULT_STOPWORDS, extractKeywords } from './keywords';
import { MockLlmProvider } from './llm/mock';
import { OpenAiCompatibleLlmProvider } from './llm/openai-compatible';
import { IntlSegmenterProvider } from './segmenter/intl';
import { MockSttProvider } from './stt/mock';
import { ProviderNotConfiguredError } from './types';

const segmenter = new IntlSegmenterProvider();

describe('segmenter', () => {
  it('finds word boundaries in Chinese text', () => {
    const segments = segmenter.segment('我想做一个灵感笔记本');
    expect(segments.length).toBeGreaterThan(1);
    expect(segments.every((segment) => segment.text.length > 0)).toBe(true);
  });

  it('splits latin words', () => {
    const segments = segmenter
      .segment('design a note app')
      .filter((segment) => segment.isWordLike)
      .map((segment) => segment.text.trim());
    expect(segments).toContain('design');
  });
});

describe('extractKeywords', () => {
  it('weights keywords by frequency', () => {
    const keywords = extractKeywords(segmenter, '灵感 笔记本 灵感 灵感 声音');
    const top = keywords[0];
    expect(top?.term).toBe('灵感');
    expect(top?.count).toBe(3);
    expect(top?.weight).toBe(1);
  });

  it('drops stopwords and very short terms', () => {
    const keywords = extractKeywords(segmenter, '这个是 的 了 我们在做一个 音乐 音乐 项目');
    const terms = keywords.map((keyword) => keyword.term);
    expect(terms).not.toContain('的');
    expect(terms).not.toContain('了');
    expect(terms).toContain('音乐');
  });

  it('honours a custom limit', () => {
    const keywords = extractKeywords(segmenter, '苹果 香蕉 橘子 葡萄 西瓜', { limit: 2 });
    expect(keywords).toHaveLength(2);
  });

  it('returns nothing for blank input', () => {
    expect(extractKeywords(segmenter, '   ')).toEqual([]);
  });

  it('exposes the default stopword list', () => {
    expect(DEFAULT_STOPWORDS.has('的')).toBe(true);
  });
});

describe('MockLlmProvider', () => {
  it('streams a reply and terminates', async () => {
    const provider = new MockLlmProvider();
    let text = '';
    let sawDone = false;
    for await (const delta of provider.chat([{ role: 'user', content: '评估这个想法' }])) {
      text += delta.text;
      if (delta.done) sawDone = true;
    }
    expect(text).toContain('评估这个想法');
    expect(sawDone).toBe(true);
  });
});

describe('OpenAiCompatibleLlmProvider', () => {
  it('reports itself unconfigured without an API key', () => {
    const provider = new OpenAiCompatibleLlmProvider({
      name: 'deepseek',
      baseUrl: 'https://api.deepseek.com/v1',
      model: 'deepseek-chat',
    });
    expect(provider.configured).toBe(false);
  });

  it('throws rather than silently degrading when unconfigured', async () => {
    const provider = new OpenAiCompatibleLlmProvider({
      name: 'deepseek',
      baseUrl: 'https://api.deepseek.com/v1',
      model: 'deepseek-chat',
    });
    await expect(async () => {
      for await (const _ of provider.chat([{ role: 'user', content: 'hi' }])) {
        // no-op
      }
    }).rejects.toBeInstanceOf(ProviderNotConfiguredError);
  });
});

describe('MockSttProvider', () => {
  it('returns a transcript for the supplied audio', async () => {
    const provider = new MockSttProvider();
    const transcript = await provider.transcribe(new Blob(['fake-audio']), { language: 'zh' });
    expect(transcript.language).toBe('zh');
    expect(transcript.text.length).toBeGreaterThan(0);
    expect(transcript.segments).toHaveLength(1);
  });
});
