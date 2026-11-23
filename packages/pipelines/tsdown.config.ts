import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    'option/index': 'src/option/index.ts',
    'result/index': 'src/result/index.ts',
    'composition/index': 'src/composition/index.ts',
    'schema/index': 'src/schema/index.ts',
  },
  // ESM only. CommonJS consumers load it with require(esm) (Node 22.12+).
  format: ['esm'],
  sourcemap: true,
  // Declarations come from Oxc's isolated-declarations emitter: no TypeScript
  // compiler API needed, and it fails the build on exports that lack the
  // explicit types it requires.
  dts: { generator: 'oxc', oxc: { stripInternal: true } },
  // Fail the build on package.json mistakes and on types that resolve wrongly for
  // ESM consumers.
  publint: true,
  attw: { profile: 'esm-only', level: 'error' },
});
