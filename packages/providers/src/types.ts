/**
 * Provider contracts.
 *
 * Everything the product does with models goes through one of these three interfaces, so swapping
 * DeepSeek for another vendor (or a self-hosted model) never touches feature code.
 */

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface ChatDelta {
  /** Incremental text. */
  text: string;
  done: boolean;
}

export interface LlmProvider {
  readonly name: string;
  readonly model: string;
  chat(messages: readonly ChatMessage[], options?: ChatOptions): AsyncIterable<ChatDelta>;
}

export interface TranscriptSegment {
  text: string;
  startMs: number;
  endMs: number;
}

export interface Transcript {
  text: string;
  language: string | null;
  segments: TranscriptSegment[];
}

export interface SttOptions {
  language?: string;
  signal?: AbortSignal;
}

export interface SttProvider {
  readonly name: string;
  transcribe(audio: Blob, options?: SttOptions): Promise<Transcript>;
}

export interface Segment {
  text: string;
  /** True when the token carries meaning (drives word-cloud weighting). */
  isWordLike: boolean;
}

export interface SegmenterProvider {
  readonly name: string;
  segment(text: string, locale?: string): Segment[];
}

export class ProviderNotConfiguredError extends Error {
  constructor(provider: string) {
    super(`Provider "${provider}" is not configured. Set the required credentials and retry.`);
    this.name = 'ProviderNotConfiguredError';
  }
}
