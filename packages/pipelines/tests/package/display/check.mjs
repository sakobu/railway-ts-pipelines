// Checks the types a consumer's editor shows for the built package. tsc writes the declarations of display.ts,
// which print each export's type as hover does, and an internal helper alias must not stand in for the type.
// It runs the tsc command, not the compiler API, and looks for the alias name and the members' discriminants
// rather than the whole printed type, so it holds across TypeScript versions.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';

// The workspace's tsc, run by this Node: it needs no PATH entry, and no shell for Windows' tsc.cmd
const tscBin = createRequire(import.meta.url).resolve('typescript/bin/tsc');

const out = mkdtempSync(path.join(tmpdir(), 'pipelines-display-'));
try {
  const tsc = spawnSync(process.execPath, [tscBin, '-p', import.meta.dirname, '--outDir', out], { encoding: 'utf8' });
  assert.ifError(tsc.error);
  assert.equal(tsc.status, 0, `tsc failed:\n${tsc.stdout}${tsc.stderr}`);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- out is the temp dir this script created
  const printed = readFileSync(path.join(out, 'display.d.ts'), 'utf8');

  // A discriminatedUnion's output shows as the union of its members, also through InferSchemaType and nested
  assert.ok(!printed.includes('ValidatorMapOutput'), `the ValidatorMapOutput alias is shown:\n${printed}`);
  // Either quote style and any spacing, so the check doesn't depend on how a TypeScript version prints literals
  assert.match(printed, /\btype:\s*["']circle["']/, `the circle member is missing:\n${printed}`);
  assert.match(printed, /\btype:\s*["']square["']/, `the square member is missing:\n${printed}`);
} finally {
  rmSync(out, { recursive: true, force: true });
}

console.log('printed types check passed');
