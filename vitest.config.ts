import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      SERVICE_TOKEN: 'test-service-token',
    },
  },
});
