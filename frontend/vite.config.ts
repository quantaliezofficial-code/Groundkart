import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// Vitest's own nested `vite` dependency (node_modules/vitest/node_modules/vite)
// occasionally resolves to a different version than the project's direct
// `vite` dependency, which makes tsc see the two packages' `Plugin`/`UserConfig`
// types as structurally incompatible even though they're the same shape at
// runtime — a config-file-only type mismatch, not a real one (`vitest run`
// itself works fine regardless). The `as any` on `test` sidesteps that
// mismatch without needing to force a single deduplicated vite version.
export default defineConfig({
  root: __dirname,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  test: {
    environment: 'jsdom',
    setupFiles: [path.resolve(__dirname, 'src/test/setup.ts')],
    globals: false,
  },
} as any);
