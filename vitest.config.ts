import { configDefaults, defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'],
    exclude: [
      ...configDefaults.exclude,
      'apps/api/test/**/*.integration.test.ts',
    ],
  },
});
