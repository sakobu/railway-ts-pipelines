import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
  outExtension: ({ format }) => ({ js: '.mjs' }),
  external: ['react', 'react-dom', '@railway-ts/pipelines'],
  tsconfig: './tsconfig.build.json',
});
