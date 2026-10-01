import { ApiError, ERROR_CODES } from '@luminote/core';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../http/context';
import { ok } from '../http/respond';
import { parseJson } from '../http/validate';
import { resolveEnvProviders, providerStatus } from '../services/provider-config';

const chatMessageSchema = z
  .object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string().min(1).max(20_000),
  })
  .strict();

const chatRequestSchema = z
  .object({
    messages: z.array(chatMessageSchema).min(1).max(50),
    temperature: z.number().min(0).max(2).optional(),
  })
  .strict();

/** Read-only provider status; available to any authenticated session, including recovery scope. */
export const providerRoutes = new Hono<AppEnv>();

providerRoutes.get('/status', (c) => ok(c, providerStatus(c.env)));

export const aiRoutes = new Hono<AppEnv>();

/**
 * Streams a completion as Server-Sent Events so the client can render tokens as they arrive.
 *
 * The API key never leaves the Worker: the browser talks to this endpoint, not to the vendor.
 */
aiRoutes.post('/chat', async (c) => {
  const body = await parseJson(c, chatRequestSchema);
  const { llm } = resolveEnvProviders(c.env);

  const encoder = new TextEncoder();
  const signal = c.req.raw.signal;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };
      try {
        for await (const delta of llm.chat(body.messages, {
          temperature: body.temperature,
          signal,
        })) {
          if (signal.aborted) break;
          if (delta.text) send({ text: delta.text, done: false });
          if (delta.done) send({ text: '', done: true });
        }
      } catch (error) {
        send({
          error: error instanceof Error ? error.message : '模型调用失败',
          done: true,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no',
    },
  });
});

export const sttRoutes = new Hono<AppEnv>();

/** Generic speech-to-text entry point. The audio never reaches a vendor directly. */
sttRoutes.post('/transcribe', async (c) => {
  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, '请求必须是 multipart/form-data');
  }

  const audio = form.get('audio');
  if (!audio || typeof audio === 'string') {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, '缺少 audio 文件字段');
  }

  const language = form.get('language');
  const { stt } = resolveEnvProviders(c.env);
  const transcript = await stt.transcribe(audio as unknown as Blob, {
    language: typeof language === 'string' && language.length > 0 ? language : undefined,
    signal: c.req.raw.signal,
  });
  return ok(c, { transcript });
});
