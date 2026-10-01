import {
  SECURITY_QUESTION_CATALOG,
  securityQuestionsSetRequestSchema,
  twoFaDisableRequestSchema,
  twoFaEnableRequestSchema,
  updateProfileRequestSchema,
} from '@luminote/core';
import { Hono } from 'hono';
import type { AppEnv } from '../http/context';
import { auth as authContext } from '../http/guards';
import { ok } from '../http/respond';
import { parseJson } from '../http/validate';
import {
  beginTwoFactorSetup,
  buildSessionDto,
  disableTwoFactor,
  enableTwoFactor,
  listDevices,
  listSecurityQuestionEntries,
  revokeDeviceById,
  setSecurityQuestions,
  updateProfile,
} from '../services/auth-service';

export const meRoutes = new Hono<AppEnv>();

meRoutes.get('/', async (c) => {
  const current = authContext(c);
  const session = await buildSessionDto(c.env, current);
  return ok(c, { session });
});

meRoutes.patch('/', async (c) => {
  const body = await parseJson(c, updateProfileRequestSchema);
  await updateProfile(c.env, authContext(c), body.displayName);
  return ok(c, { session: await buildSessionDto(c.env, authContext(c)) });
});

meRoutes.get('/devices', async (c) => {
  return ok(c, { devices: await listDevices(c.env, authContext(c)) });
});

meRoutes.delete('/devices/:id', async (c) => {
  await revokeDeviceById(c.env, authContext(c), c.req.param('id'));
  return ok(c, { devices: await listDevices(c.env, authContext(c)) });
});

meRoutes.get('/security-questions', async (c) => {
  const current = authContext(c);
  return ok(c, {
    catalog: SECURITY_QUESTION_CATALOG,
    entries: await listSecurityQuestionEntries(c.env, current),
    mustResetQuestions: current.mustResetQuestions,
  });
});

meRoutes.put('/security-questions', async (c) => {
  const body = await parseJson(c, securityQuestionsSetRequestSchema);
  const current = authContext(c);
  await setSecurityQuestions(c.env, current, body);
  return ok(c, { session: await buildSessionDto(c.env, current) });
});

meRoutes.post('/2fa/setup', async (c) => {
  const setup = await beginTwoFactorSetup(c.env, authContext(c));
  return ok(c, setup);
});

meRoutes.post('/2fa/enable', async (c) => {
  const body = await parseJson(c, twoFaEnableRequestSchema);
  const current = authContext(c);
  const result = await enableTwoFactor(c.env, current, body);
  return ok(c, { ...result, session: await buildSessionDto(c.env, current) });
});

meRoutes.post('/2fa/disable', async (c) => {
  const body = await parseJson(c, twoFaDisableRequestSchema);
  const current = authContext(c);
  await disableTwoFactor(c.env, current, body);
  return ok(c, { session: await buildSessionDto(c.env, current) });
});
