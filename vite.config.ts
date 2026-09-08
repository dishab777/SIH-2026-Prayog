import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * Everything reachable only from the mock API. Listing these keeps the request
 * interception stack — graphql included, which msw bundles — out of the
 * application shell, so the public routes are not paying for a mock backend.
 */
const MOCK_DEPS = [
  'msw',
  '@mswjs',
  '@bundled-es-modules',
  'graphql',
  'outvariant',
  'strict-event-emitter',
  'headers-polyfill',
  'until-async',
  'is-node-process',
  'path-to-regexp',
  'tough-cookie',
  'set-cookie-parser',
  'psl',
  'punycode',
  'universalify',
  'cookie',
  'statuses',
  'type-fest',
  'chalk',
  'picocolors',
  'tldts',
  'tldts-core',
];

/** Everything reachable only from the lazily loaded chart components. */
const CHART_DEPS = [
  'recharts',
  'victory-vendor',
  'd3-',
  'internmap',
  'delaunator',
  'robust-predicates',
  'lodash',
  'decimal.js-light',
  'fast-equals',
  'eventemitter3',
  'react-smooth',
  'react-transition-group',
  'dom-helpers',
  '@babel/runtime',
  'tiny-invariant',
];

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: { port: 5173, open: false },
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // The whole mock API — worker, handlers, fixtures — is one chunk so it can be
          // dropped wholesale when a real backend exists.
          if (id.includes('/src/mocks/')) return 'mockapi';
          if (MOCK_DEPS.some((d) => id.includes(`node_modules/${d}`))) return 'mockapi';
          if (id.includes('node_modules')) {
            if (CHART_DEPS.some((d) => id.includes(`node_modules/${d}`))) return 'charts';
            if (id.includes('react-router')) return 'router';
            if (id.includes('@tanstack')) return 'query';
            if (id.includes('i18next')) return 'i18n';
            if (id.includes('react-hook-form') || id.includes('zod') || id.includes('@hookform')) return 'forms';
            return 'vendor';
          }
          return undefined;
        },
      },
    },
  },
});
