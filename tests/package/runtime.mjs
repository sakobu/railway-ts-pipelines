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

// The CommonJS and ESM builds must also agree (an app can load both).
assert.deepStrictEqual(require('@railway-ts/pipelines/result').ok(1), result.ok(1));
assert.deepStrictEqual(require('@railway-ts/pipelines/option').some(1), option.some(1));

// No emitted JS file carries more than one source map comment (tsup used to emit two).
const dist = path.resolve(import.meta.dirname, '../../dist');
const jsFiles = readdirSync(dist, { recursive: true })
  .map(String)
  .filter((file) => /\.(mjs|cjs)$/.test(file));
for (const file of jsFiles) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- paths come from listing our own dist/
  const comments = readFileSync(path.join(dist, file), 'utf8').match(/\/\/# sourceMappingURL=/g) ?? [];
  assert.ok(comments.length <= 1, `${file} has ${comments.length} sourceMappingURL comments`);
}

console.log('package runtime checks passed');
