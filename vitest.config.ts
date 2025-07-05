/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    globals: true, // Optional: to use Vitest globals like expect, describe, it without importing
    environment: 'jsdom', // Use JSDOM for simulating browser environment
    setupFiles: [], // If you have setup files, add them here
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'], // Pattern for test files
  },
});
