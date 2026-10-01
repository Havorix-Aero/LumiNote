import { defineConfig } from 'vitest/config';

// Each workspace package owns its own vitest config (the worker needs the Workers pool), so the
// root config only exists to keep `vitest` from picking up unrelated files.
export default defineConfig({
  test: {
    passWithNoTests: true,
    include: [],
  },
});
