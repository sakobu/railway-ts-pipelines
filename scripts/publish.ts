// Publishes every workspace package whose version is not on npm yet, then tags the release:
//
//   bun scripts/publish.ts [--dry-run]
//
// Changesets' own publish can't be used: on Bun it falls back to npm, which leaves
// `workspace:*` in use-form's packed package.json. `bun publish` can't be used either: it
// supports neither npm trusted publishing (OIDC) nor provenance. So each package is packed
// with `bun pm pack`, which rewrites `workspace:` ranges to real versions, and the tarball is
// published with `npm publish`.
//
// Afterwards `changeset git-tag` creates the @railway-ts/<name>@<version> tags and reports them
// through $CHANGESETS_OUTPUT, so changesets/action pushes them and creates the GitHub Releases.

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { $ } from 'bun';

// Dependency order: use-form depends on pipelines.
const PACKAGES = ['packages/pipelines', 'packages/use-form'];
const dryRun = process.argv.includes('--dry-run');

// True when name@version is on npm. `npm view` exits 1 with E404 for an unpublished
// version; any other failure (network, auth, registry) stops the release.
async function isPublished(name: string, version: string): Promise<boolean> {
  const result = await $`npm view ${`${name}@${version}`} version`.nothrow().quiet();
  const stdout = result.stdout.toString().trim();
  if (result.exitCode === 0 && stdout === version) {
    return true;
  }
  const output = `${stdout}\n${result.stderr.toString()}`.trim();
  if (result.exitCode !== 0 && output.includes('E404')) {
    return false;
  }
  throw new Error(`npm view ${name}@${version} failed (exit ${result.exitCode}):\n${output}`);
}

const tmp = await mkdtemp(path.join(tmpdir(), 'railway-ts-publish-'));
try {
  for (const dir of PACKAGES) {
    const { name, version } = (await Bun.file(path.join(dir, 'package.json')).json()) as {
      name: string;
      version: string;
    };
    if (await isPublished(name, version)) {
      console.log(`skip ${name}@${version} (already on npm)`);
      continue;
    }
    const packed = await $`bun pm pack --destination ${tmp} --quiet`.cwd(dir).text();
    const tarball = path.join(tmp, path.basename(packed.trim()));
    const args = [tarball, '--access', 'public', ...(dryRun ? ['--dry-run'] : [])];
    console.log(`$ npm publish ${args.join(' ')}`);
    await $`npm publish ${args}`;
  }
} finally {
  await rm(tmp, { recursive: true, force: true });
}

if (!dryRun) {
  await $`bunx changeset git-tag`;
}
