// Enforces 100% line coverage for each package directory given on the command line:
//
//   bun scripts/check-coverage.ts packages/pipelines packages/use-form
//
// For each <pkgDir> it reads <pkgDir>/coverage/lcov.info, reports every file with LH < LF
// (as <pkgDir>/<file>, relative to the repo root), and writes <pkgDir>/coverage/lcov.repo.info
// with every SF: path prefixed by <pkgDir>/, so Codecov maps it to the right file in the repo.
// Exits 1 if any package is below 100% or has no lcov.info.
import path from 'node:path';

const pkgDirs = process.argv.slice(2);
if (pkgDirs.length === 0) {
  throw new Error('usage: bun scripts/check-coverage.ts <pkgDir>...');
}

let failed = false;

for (const pkgDir of pkgDirs) {
  const lcovPath = path.join(pkgDir, 'coverage', 'lcov.info');
  const lcov = Bun.file(lcovPath);
  if (!(await lcov.exists())) {
    console.error(`${pkgDir}: missing ${lcovPath}`);
    failed = true;
    continue;
  }

  let currentFile = '';
  let lf = 0;
  let pkgOk = true;
  const rewritten: string[] = [];

  const text = await lcov.text();
  for (const line of text.split('\n')) {
    if (line.startsWith('SF:')) {
      currentFile = path.join(pkgDir, line.slice(3));
      rewritten.push(`SF:${currentFile}`);
      continue;
    }
    rewritten.push(line);
    if (line.startsWith('LF:')) {
      lf = Number.parseInt(line.slice(3), 10) || 0;
    } else if (line.startsWith('LH:')) {
      const lh = Number.parseInt(line.slice(3), 10) || 0;
      if (lh < lf) {
        console.error(`Coverage < 100% for ${currentFile}: LH ${lh} / LF ${lf}`);
        pkgOk = false;
      }
    }
  }

  await Bun.write(path.join(pkgDir, 'coverage', 'lcov.repo.info'), rewritten.join('\n'));

  if (pkgOk) {
    console.log(`${pkgDir}: 100% OK`);
  } else {
    failed = true;
  }
}

if (failed) {
  console.error('Coverage enforcement failed: some files are below 100%');
  process.exitCode = 1;
}
