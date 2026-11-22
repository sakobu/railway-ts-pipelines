import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    'option/index': 'src/option/index.ts',
    'result/index': 'src/result/index.ts',
    'composition/index': 'src/composition/index.ts',
    'schema/index': 'src/schema/index.ts',
  },
  format: ['esm', 'cjs'],
  sourcemap: true,
  // Declarations come from Oxc's isolated-declarations emitter: no TypeScript
  // compiler API needed, and it fails the build on exports that lack the
  // explicit types it requires.
  dts: { generator: 'oxc', oxc: { stripInternal: true } },
  // Fail the build on package.json mistakes and on types that resolve wrongly
  // for ESM or CommonJS consumers under Node 16+ resolution.
  publint: true,
  attw: { profile: 'node16', level: 'error' },
});
