// ESLint flat config — eslint-config-expo (SDK 54 pairing) + prettier compat.
// PRD-001 §4.11: no console.* anywhere — everything routes through src/lib/logger.ts.
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
  ...expoConfig,
  prettierConfig,
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'coverage/**',
      'shims/**',
      // vendored from automatos-ai by scripts/sync-core.ts — never edited by hand
      'src/core/web/**',
      'scripts/ralph/**',
      'babel.config.js',
      'metro.config.js',
      'eslint.config.js',
    ],
  },
  {
    rules: {
      'no-console': 'error',
    },
  },
  {
    files: ['src/lib/logger.ts'],
    rules: {
      'no-console': 'off',
    },
  },
];
