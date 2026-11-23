// Fails if a JavaScript or TypeScript file in the repo is outside every lint override:
//
//   bun scripts/check-lint-scope.ts   (run by `bun run lint` and `bun run check`)
//
// .oxlintrc.json turns oxlint's default rules off and enables rules per package through
// `overrides`, so a file no override matches (a new package, a root-level script) would be
// linted with no rules at all, and silently pass. Add an override for it, or ignore it.

import { $, Glob } from 'bun';

type OxlintConfig = { ignorePatterns?: string[]; overrides?: { files: string[] }[] };

const config = (await Bun.file('.oxlintrc.json').json()) as OxlintConfig;
const ignored = (config.ignorePatterns ?? []).map((pattern) => new Glob(pattern));
const scoped = (config.overrides ?? []).flatMap((override) => override.files).map((pattern) => new Glob(pattern));

// Tracked files plus new files git doesn't ignore, so an uncommitted package is caught too.
const listed = await $`git ls-files --cached --others --exclude-standard`.text();
const lintable = listed
  .split('\n')
  .filter((file) => /\.[cm]?[jt]sx?$/.test(file))
  .filter((file) => !ignored.some((glob) => glob.match(file)));
const unscoped = lintable.filter((file) => !scoped.some((glob) => glob.match(file)));

if (unscoped.length > 0) {
  console.error('No lint override in .oxlintrc.json matches these files, so no lint rules run on them:');
  for (const file of unscoped) {
    console.error(`  ${file}`);
  }
  process.exitCode = 1;
} else {
  console.log(`lint scope: all ${lintable.length} files are covered by an override`);
}
