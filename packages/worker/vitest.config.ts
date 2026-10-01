import { defineWorkersConfig, readD1Migrations } from '@cloudflare/vitest-pool-workers/config';
import { fileURLToPath } from 'node:url';

const migrationsDir = fileURLToPath(new URL('./migrations', import.meta.url));

export default defineWorkersConfig(async () => {
  const migrations = await readD1Migrations(migrationsDir);

  return {
    test: {
      setupFiles: ['./test/apply-migrations.ts'],
      testTimeout: 30_000,
      poolOptions: {
        workers: {
          singleWorker: true,
          wrangler: { configPath: './wrangler.toml' },
          miniflare: {
            bindings: {
              TEST_MIGRATIONS: migrations,
              ENVIRONMENT: 'test',
              SESSION_PEPPER: 'test-session-pepper',
              // 32 zero bytes, base64url encoded — fine for tests, never for production.
              TOTP_MASTER_KEY: 'A'.repeat(43),
              LLM_PROVIDER: 'mock',
              STT_PROVIDER: 'mock',
            },
          },
        },
      },
    },
  };
});
