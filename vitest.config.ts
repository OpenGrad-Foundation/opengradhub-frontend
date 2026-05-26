import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Polyfills `indexedDB` globally so the draft store can be tested.
    setupFiles: ['fake-indexeddb/auto'],
    include: ['test/**/*.spec.ts'],
    passWithNoTests: true,
  },
});
