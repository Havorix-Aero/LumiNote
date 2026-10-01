import type { Context } from 'hono';
import type { AppEnv } from './context';

/** Success helper that goes through `c.json` so cookies prepared on the context are attached. */
export function ok<T>(c: Context<AppEnv>, data: T, status: 200 | 201 | 202 = 200) {
  return c.json(data, status);
}

export function noContent(c: Context<AppEnv>) {
  return c.body(null, 204);
}
