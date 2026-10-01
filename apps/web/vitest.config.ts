import { defineConfig } from 'vitest/config';

// Deliberately separate from vite.config.ts so tests never load the PWA plugin.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
});
