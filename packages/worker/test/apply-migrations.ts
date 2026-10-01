import { applyD1Migrations, env } from 'cloudflare:test';

// Applies the real migrations so tests run against the same schema that ships.
await applyD1Migrations(
  env.DB,
  (env as unknown as { TEST_MIGRATIONS: D1Migration[] }).TEST_MIGRATIONS,
);
