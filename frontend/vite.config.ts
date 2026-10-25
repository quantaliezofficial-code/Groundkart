/// <reference types="vitest" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

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
    testTimeout: 15000,
    include: ['src/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
  },
});
