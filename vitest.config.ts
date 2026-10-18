import { defineConfig } from 'vitest/config';

// Unit tests only. Playwright specs under tests/e2e import @playwright/test and must not run under Vitest.
export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**', 'tests/e2e/**'],
  },
});
