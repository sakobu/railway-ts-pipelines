// Checks the types a consumer's editor shows for the built package. tsc writes the declarations of display.ts,
// which print each export's type as hover does, and an internal helper alias must not stand in for the type.
// It runs the tsc command, not the compiler API, and checks no exact text, so it holds across TypeScript versions.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const out = mkdtempSync(path.join(tmpdir(), 'pipelines-display-'));
try {
  const tsc = spawnSync('tsc', ['-p', import.meta.dirname, '--outDir', out], { encoding: 'utf8' });
  assert.equal(tsc.status, 0, `tsc failed:\n${tsc.stdout}${tsc.stderr}`);
  const printed = readFileSync(path.join(out, 'display.d.ts'), 'utf8');

  // A discriminatedUnion's output shows as the union of its members, also through InferSchemaType and nested
  assert.ok(!printed.includes('ValidatorMapOutput'), `the ValidatorMapOutput alias is shown:\n${printed}`);
  assert.ok(printed.includes('type: "circle"') && printed.includes('type: "square"'), `members missing:\n${printed}`);
} finally {
  rmSync(out, { recursive: true, force: true });
}

console.log('printed types check passed');
