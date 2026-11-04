import { defineConfig } from 'vitest/config';

// GitHub Pages serves the site under /<repo-name>/, so assets must use that base.
export default defineConfig({
  base: '/just-for-claud/',
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
  },
});
