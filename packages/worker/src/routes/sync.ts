import { syncPullRequestSchema, syncPushRequestSchema } from '@luminote/core';
import { Hono } from 'hono';
import type { AppEnv } from '../http/context';
import { auth as authContext } from '../http/guards';
import { ok } from '../http/respond';
import { parseJson } from '../http/validate';
import { pull, push } from '../services/sync-service';

export const syncRoutes = new Hono<AppEnv>();

syncRoutes.post('/pull', async (c) => {
  const body = await parseJson(c, syncPullRequestSchema);
  return ok(c, await pull(c.env, authContext(c), body));
});

syncRoutes.post('/push', async (c) => {
  const body = await parseJson(c, syncPushRequestSchema);
  return ok(c, await push(c.env, authContext(c), body));
});
