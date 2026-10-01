import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from './http/context';
import { errorHandler, notFoundHandler } from './http/errors';
import {
  attachRequestMeta,
  csrfProtection,
  originCheck,
  requireQuestionsReset,
  requireSession,
} from './http/guards';
import { ok } from './http/respond';
import { authRoutes } from './routes/auth';
import { meRoutes } from './routes/me';
import { noteRoutes } from './routes/notes';
import { aiRoutes, providerRoutes, sttRoutes } from './routes/providers';
import { syncRoutes } from './routes/sync';

export const API_PREFIX = '/api/v1';

/**
 * Version 1 routes, rooted at {@link API_PREFIX}.
 *
 * Route groups are stacked by how much of the account's security state they require:
 * `public` (login), `authenticated` (settings, including the forced question reset), and
 * `workspace` (notes, sync, models — blocked until a recovery login has re-provisioned every
 * security question).
 *
 * Guards are applied per prefix rather than by mounting a guarded sub-app at `/`: a sub-app's
 * `use('*')` is hoisted into the parent as `/*` and would then guard `/auth/login` as well.
 */
function createV1Routes(): Hono<AppEnv> {
  const api = new Hono<AppEnv>();

  api.get('/health', (c) => ok(c, { status: 'ok', environment: c.env.ENVIRONMENT ?? 'unknown' }));

  api.route('/auth', authRoutes);

  function mount(prefix: string, router: Hono<AppEnv>, ...guards: MiddlewareHandler<AppEnv>[]) {
    if (guards.length > 0) {
      api.use(prefix, ...guards);
      api.use(`${prefix}/*`, ...guards);
    }
    api.route(prefix, router);
  }

  mount('/me', meRoutes, requireSession, csrfProtection);
  mount('/providers', providerRoutes, requireSession, csrfProtection);

  const workspaceGuards: MiddlewareHandler<AppEnv>[] = [
    requireSession,
    csrfProtection,
    requireQuestionsReset,
  ];
  mount('/notes', noteRoutes, ...workspaceGuards);
  mount('/sync', syncRoutes, ...workspaceGuards);
  mount('/ai', aiRoutes, ...workspaceGuards);
  mount('/stt', sttRoutes, ...workspaceGuards);

  return api;
}

export function createApiApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  // Cross-cutting middleware lives on the outermost app so it also covers unmatched /api/v1 paths.
  app.use('*', attachRequestMeta);
  app.use('*', originCheck);
  app.route(API_PREFIX, createV1Routes());

  app.notFound(notFoundHandler);
  app.onError(errorHandler);

  return app;
}

export const apiApp = createApiApp();
