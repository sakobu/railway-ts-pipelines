import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  sourcemap: true,
  // Declarations come from Oxc's isolated-declarations emitter: no TypeScript
  // compiler API needed, and it fails the build on exports that lack the
  // explicit types it requires.
  dts: { generator: 'oxc', oxc: { stripInternal: true } },
  // React and pipelines are peers: consumers bring their own copy, so they (and
  // their subpaths, such as react/jsx-runtime) must never be inlined.
  deps: {
    neverBundle: [/^react($|\/)/, /^react-dom($|\/)/, /^@railway-ts\/pipelines($|\/)/],
  },
  // Fail the build on package.json mistakes and on types that resolve wrongly
  // for ESM consumers.
  publint: true,
  attw: { profile: 'esm-only', level: 'error' },
});
