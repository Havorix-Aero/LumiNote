import { describeProviders, resolveProviders, type ProviderBundle } from '@luminote/providers';
import type { ProviderStatusDto } from '@luminote/core';
import type { Env } from '../env';

/**
 * Builds the provider bundle from Worker configuration.
 *
 * Providers are stateless and cheap to construct, so they are resolved per request rather than
 * cached across isolates (which would also make config changes take effect immediately).
 */
export function resolveEnvProviders(env: Env): ProviderBundle {
  return resolveProviders({
    llm: {
      provider: env.LLM_PROVIDER ?? 'mock',
      baseUrl: env.LLM_BASE_URL ?? 'https://api.deepseek.com/v1',
      model: env.LLM_MODEL ?? 'deepseek-chat',
      apiKey: env.DEEPSEEK_API_KEY,
    },
    stt: { provider: env.STT_PROVIDER ?? 'mock' },
  });
}

export function providerStatus(env: Env): ProviderStatusDto {
  return describeProviders(resolveEnvProviders(env));
}
