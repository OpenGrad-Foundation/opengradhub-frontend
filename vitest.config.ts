import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const resolveConfig = {
  // Mirror tsconfig "@/*" -> project root so tests can import app modules.
  alias: { '@': path.resolve(__dirname) },
};

export default defineConfig({
  resolve: resolveConfig,
  test: {
    setupFiles: ['fake-indexeddb/auto'],
    passWithNoTests: true,
    globals: true,
    projects: [
      {
        resolve: resolveConfig,
        test: {
          name: 'node',
          environment: 'node',
          include: ['test/**/*.spec.ts'],
          setupFiles: ['fake-indexeddb/auto'],
        },
      },
      {
        resolve: resolveConfig,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['test/**/*.spec.tsx'],
          setupFiles: ['fake-indexeddb/auto'],
          globals: true,
        },
      },
    ],
  },
});
