import type { ProviderStatusDto } from '@luminote/core';
import { MockLlmProvider } from './llm/mock';
import { OpenAiCompatibleLlmProvider } from './llm/openai-compatible';
import { IntlSegmenterProvider } from './segmenter/intl';
import { MockSttProvider } from './stt/mock';
import type { LlmProvider, SegmenterProvider, SttProvider } from './types';

export interface ProviderConfig {
  llm: {
    /** `mock` keeps everything offline; any other value is treated as an OpenAI-compatible vendor. */
    provider: string;
    baseUrl: string;
    model: string;
    apiKey?: string;
  };
  stt: {
    provider: string;
  };
  segmenterLocale?: string;
}

export interface ProviderBundle {
  llm: LlmProvider;
  stt: SttProvider;
  segmenter: SegmenterProvider;
}

function createLlmProvider(config: ProviderConfig['llm']): LlmProvider {
  if (config.provider === 'mock') return new MockLlmProvider();
  return new OpenAiCompatibleLlmProvider({
    name: config.provider,
    baseUrl: config.baseUrl,
    model: config.model,
    apiKey: config.apiKey,
  });
}

function createSttProvider(config: ProviderConfig['stt']): SttProvider {
  // Only the mock exists today; a Whisper-compatible HTTP provider drops in here.
  void config;
  return new MockSttProvider();
}

export function resolveProviders(config: ProviderConfig): ProviderBundle {
  return {
    llm: createLlmProvider(config.llm),
    stt: createSttProvider(config.stt),
    segmenter: new IntlSegmenterProvider(config.segmenterLocale),
  };
}

export function describeProviders(bundle: ProviderBundle): ProviderStatusDto {
  const llm = bundle.llm as LlmProvider & { configured?: boolean };
  return {
    llm: { provider: bundle.llm.name, configured: llm.configured ?? true },
    stt: { provider: bundle.stt.name, configured: true },
    segmenter: { provider: bundle.segmenter.name },
  };
}
