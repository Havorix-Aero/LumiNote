import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.wrangler/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/worker-configuration.d.ts',
      'apps/web/public/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // React hooks rules only mean anything for the browser app; the Worker, the e2e suite and the
    // packages are plain TypeScript.
    files: ['apps/web/src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  // Layout isolation: mobile and desktop must never import each other's components.
  {
    files: ['apps/web/src/mobile/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/desktop/**',
                '@/desktop/*',
                '~desktop/*',
                '../desktop/*',
                '../../desktop/*',
              ],
              message:
                'Mobile must not reuse desktop components. Put shared pieces in apps/web/src/shared.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/web/src/desktop/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/mobile/**', '@/mobile/*', '~mobile/*', '../mobile/*', '../../mobile/*'],
              message:
                'Desktop must not reuse mobile components. Put shared pieces in apps/web/src/shared.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', 'e2e/**/*.ts', '**/*.config.ts', '**/*.config.js'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // Plain Node scripts: they run outside both the browser and the Workers runtime.
    files: ['tools/**/*.mjs'],
    languageOptions: {
      globals: {
        Buffer: 'readonly',
        console: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
  prettier,
);
