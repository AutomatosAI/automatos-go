import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Core, API and auth logic is pure TS — no native runtime needed, so vitest
// (not jest-expo) runs it fast in node. Coverage gate (PRD-001 §4.11): >=80%
// lines/functions/statements and >=70% branches on src/core/*.ts, src/api/**
// and src/auth/**, enforced here and in CI.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts', 'plugins/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/core/*.ts', 'src/api/**/*.ts', 'src/auth/**/*.ts'],
      exclude: ['**/__tests__/**', '**/*.test.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
      reporter: ['text', 'lcov'],
    },
  },
});
