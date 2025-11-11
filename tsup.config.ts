import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'option/index': 'src/option/index.ts',
    'result/index': 'src/result/index.ts',
    'composition/index': 'src/composition/index.ts',
    'schema/index': 'src/schema/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: {
    preset: 'smallest',
  },
  outDir: 'dist',
  outExtension: ({ format }) => ({
    js: format === 'esm' ? '.mjs' : '.cjs',
  }),
  external: [],
  tsconfig: './tsconfig.build.json',
});
