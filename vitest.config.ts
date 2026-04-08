import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
