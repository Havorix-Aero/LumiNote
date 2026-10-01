import type { ChatDelta, ChatMessage, ChatOptions, LlmProvider } from '../types';

/**
 * Deterministic offline provider.
 *
 * It is the default in development and in tests, so the whole capture -> discuss flow can be
 * exercised without an API key or network access.
 */
export class MockLlmProvider implements LlmProvider {
  readonly name = 'mock';
  readonly model = 'mock-echo';

  async *chat(messages: readonly ChatMessage[], _options?: ChatOptions): AsyncIterable<ChatDelta> {
    const lastUser = [...messages].reverse().find((message) => message.role === 'user');
    const prompt = lastUser?.content.trim() ?? '';
    const reply =
      `（模拟回复）我收到了你的灵感：\n\n${prompt || '（空）'}\n\n` +
      '1. 初步判断：方向可行，可以先做一个最小验证。\n' +
      '2. 建议先明确目标用户与核心场景。\n' +
      '3. 下一步可以把方案拆成两三个可验证的小实验。\n\n' +
      '（当前使用 mock provider，配置 DEEPSEEK_API_KEY 并切换 LLM_PROVIDER 后会返回真实结果。）';

    for (const chunk of chunkText(reply, 12)) {
      yield { text: chunk, done: false };
    }
    yield { text: '', done: true };
  }
}

function* chunkText(text: string, size: number): Generator<string> {
  for (let index = 0; index < text.length; index += size) {
    yield text.slice(index, index + size);
  }
}
