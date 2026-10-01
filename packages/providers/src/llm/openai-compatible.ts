import {
  ProviderNotConfiguredError,
  type ChatDelta,
  type ChatMessage,
  type ChatOptions,
  type LlmProvider,
} from '../types';

export interface OpenAiCompatibleOptions {
  /** Display name used in status output. */
  name: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
  /** Extra headers, e.g. for gateways that need an organisation id. */
  headers?: Record<string, string>;
}

interface StreamChunk {
  choices?: Array<{ delta?: { content?: string } }>;
}

/**
 * Adapter for anything speaking the OpenAI `/chat/completions` protocol.
 *
 * DeepSeek, Moonshot, Together, vLLM and OpenAI itself all fit, so switching vendor is a base-URL
 * and model change rather than a code change.
 */
export class OpenAiCompatibleLlmProvider implements LlmProvider {
  readonly name: string;
  readonly model: string;
  readonly #baseUrl: string;
  readonly #apiKey: string | undefined;
  readonly #headers: Record<string, string>;

  constructor(options: OpenAiCompatibleOptions) {
    this.name = options.name;
    this.model = options.model;
    this.#baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.#apiKey = options.apiKey;
    this.#headers = options.headers ?? {};
  }

  get configured(): boolean {
    return Boolean(this.#apiKey);
  }

  async *chat(messages: readonly ChatMessage[], options?: ChatOptions): AsyncIterable<ChatDelta> {
    if (!this.#apiKey) throw new ProviderNotConfiguredError(this.name);

    const response = await fetch(`${this.#baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.#apiKey}`,
        ...this.#headers,
      },
      body: JSON.stringify({
        model: this.model,
        stream: true,
        messages: messages.map((message) => ({ role: message.role, content: message.content })),
        ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
        ...(options?.maxTokens !== undefined ? { max_tokens: options.maxTokens } : {}),
      }),
      signal: options?.signal,
    });

    if (!response.ok || !response.body) {
      const detail = await response.text().catch(() => '');
      throw new Error(`LLM request failed (${response.status}): ${detail.slice(0, 300)}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') {
          yield { text: '', done: true };
          return;
        }
        try {
          const parsed = JSON.parse(payload) as StreamChunk;
          const text = parsed.choices?.[0]?.delta?.content;
          if (text) yield { text, done: false };
        } catch {
          // Ignore keep-alive comments and partial frames.
        }
      }
    }

    yield { text: '', done: true };
  }
}
