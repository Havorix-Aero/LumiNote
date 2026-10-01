import { apiApp } from './app';
import type { Env } from './env';
import { runRetention } from './services/retention-service';

/**
 * Serves the SPA with history-API fallback.
 *
 * `/api/*` goes to the Hono app; anything else is an asset, and an unknown asset path is a client
 * route, so it falls back to `index.html`.
 */
async function serveAppShell(request: Request, env: Env): Promise<Response> {
  const response = await env.ASSETS.fetch(request);
  if (response.status !== 404) return response;

  const indexUrl = new URL(request.url);
  indexUrl.pathname = '/index.html';
  indexUrl.search = '';
  return env.ASSETS.fetch(new Request(indexUrl.toString(), { method: 'GET' }));
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      return apiApp.fetch(request, env, ctx);
    }
    return serveAppShell(request, env);
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      runRetention(env, new Date(controller.scheduledTime)).then((report) => {
        console.warn('luminote retention', JSON.stringify(report));
      }),
    );
  },
} satisfies ExportedHandler<Env>;
