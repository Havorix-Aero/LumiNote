import type { SttOptions, SttProvider, Transcript } from '../types';

/**
 * Offline stand-in for speech-to-text.
 *
 * The real transcription pipeline (a Whisper-compatible endpoint, or the browser's Web Speech API
 * on the client) plugs into the same interface, so the capture UI does not change.
 */
export class MockSttProvider implements SttProvider {
  readonly name = 'mock';

  async transcribe(audio: Blob, options?: SttOptions): Promise<Transcript> {
    const size = audio.size;
    const text = `（模拟转写）收到 ${size} 字节的音频片段，这里会返回真实的语音识别结果。`;
    return {
      text,
      language: options?.language ?? null,
      segments: [{ text, startMs: 0, endMs: 0 }],
    };
  }
}
