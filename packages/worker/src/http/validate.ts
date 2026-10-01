import { ApiError, ERROR_CODES } from '@luminote/core';
import type { Context } from 'hono';
import type { z } from 'zod';
import type { AppEnv } from './context';

/** Parses and validates a JSON body, converting zod failures into a structured 422. */
export async function parseJson<T extends z.ZodTypeAny>(
  c: Context<AppEnv>,
  schema: T,
): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new ApiError(ERROR_CODES.BAD_REQUEST, '请求体不是合法的 JSON');
  }
  return validate(schema, raw);
}

export function parseQuery<T extends z.ZodTypeAny>(c: Context<AppEnv>, schema: T): z.infer<T> {
  const query: Record<string, string> = {};
  for (const [key, value] of new URL(c.req.url).searchParams.entries()) {
    query[key] = value;
  }
  return validate(schema, query);
}

export function validate<T extends z.ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, '请求参数校验失败', {
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }
  return result.data;
}
