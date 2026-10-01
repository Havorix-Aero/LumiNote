import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end configuration.
 *
 * The suite drives the real stack: the Hono Worker on `wrangler dev` (with a local D1) behind the
 * Vite dev server, which proxies `/api` to it. Both servers are started automatically and reused
 * when they are already running, so `pnpm test:e2e` works from a cold checkout.
 *
 * The dev server is pinned to IPv4 (`server.host` in apps/web/vite.config.ts), so the base URL
 * uses `127.0.0.1` rather than `localhost`.
 *
 * Run `pnpm db:migrate:local` once before the first run so the local D1 has its schema.
 */
const WEB_URL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173';

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',

  // Every spec shares one local D1 database, so the run stays serial.
  fullyParallel: false,
  workers: 1,

  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },

  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'desktop',
      testIgnore: /mobile\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      testMatch: /mobile\.spec\.ts$/,
      use: { ...devices['Pixel 7'] },
    },
  ],

  webServer: [
    {
      command: 'pnpm --filter @luminote/worker exec wrangler dev --port 8787 --local',
      url: 'http://127.0.0.1:8787/api/v1/health',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: 'pnpm --filter @luminote/web dev',
      url: WEB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});
