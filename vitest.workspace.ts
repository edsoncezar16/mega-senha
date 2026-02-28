import { defineWorkspace } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineWorkspace([
  {
    test: {
      name: 'node',
      environment: 'node',
      include: [
        'tests/unit/server/**',
        'tests/integration/**',
        'tests/e2e/**',
      ],
      testTimeout: 15000,
    },
  },
  {
    plugins: [react()],
    resolve: {
      alias: {
        '../../shared/types': path.resolve(__dirname, 'shared/types.ts'),
      },
    },
    test: {
      name: 'jsdom',
      environment: 'jsdom',
      globals: true,
      include: ['tests/unit/client/**'],
      setupFiles: ['tests/setup.ts'],
    },
  },
]);
