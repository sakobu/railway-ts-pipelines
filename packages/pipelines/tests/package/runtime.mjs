// Runtime checks against the built package, loaded by name through package.json
// "exports" in Node, as consumers load it.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import * as option from '@railway-ts/pipelines/option';
import * as result from '@railway-ts/pipelines/result';

const require = createRequire(import.meta.url);

// A Result built by the option entry equals one built by the result entry,
// and likewise for Options: both entry points must share the same brand symbols.
assert.deepStrictEqual(option.mapToResult(option.some(1), 'missing'), result.ok(1));
assert.deepStrictEqual(result.mapToOption(result.ok(1)), option.some(1));

// The package is ESM-only: require() goes through Node's require(esm) (Node 20.19+/22.12+)
// and returns the same module instance as import, so there is no second copy to disagree with.
assert.equal(require('@railway-ts/pipelines/result'), result);
assert.equal(require('@railway-ts/pipelines/option'), option);

// No emitted JS file carries more than one source map comment (tsup used to emit two).
const dist = path.resolve(import.meta.dirname, '../../dist');
const files = readdirSync(dist, { recursive: true }).map(String);
// No CommonJS output or CommonJS declarations.
const commonJs = files.filter((file) => /\.(cjs|d\.cts)$/.test(file));
assert.deepStrictEqual(commonJs, [], `dist/ has CommonJS files: ${commonJs.join(', ')}`);
const jsFiles = files.filter((file) => file.endsWith('.mjs'));
for (const file of jsFiles) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- paths come from listing our own dist/
  const comments = readFileSync(path.join(dist, file), 'utf8').match(/\/\/# sourceMappingURL=/g) ?? [];
  assert.ok(comments.length <= 1, `${file} has ${comments.length} sourceMappingURL comments`);
}

console.log('package runtime checks passed');
