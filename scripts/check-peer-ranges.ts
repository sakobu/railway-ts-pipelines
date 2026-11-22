// Fails if `changeset version` narrowed a peer range between workspace packages:
//
//   bun scripts/check-peer-ranges.ts   (run by `bun run ci:version`, after `changeset version`)
//
// While pipelines is 0.x, every minor is outside a `^0.y` range, so Changesets rewrites
// use-form's peer range to the new minor only (e.g. `^0.1.27 || ^0.2.0` becomes `^0.3.0`) and
// patch-bumps use-form. That release would silently drop every pipelines version users have.
// Widen the range in the PR that bumps pipelines instead (`^0.1.27 || ^0.2.0 || ^0.3.0`); then
// the new version is in range and Changesets leaves it alone.
//
// Compares each package.json in the working tree with the committed one (HEAD): every
// version a committed range names must still satisfy the new range.

import { readdir } from 'node:fs/promises';
import path from 'node:path';

import { $ } from 'bun';

type Manifest = { name: string; peerDependencies?: Record<string, string> };

const entries = await readdir('packages', { withFileTypes: true });
const dirs = entries.filter((entry) => entry.isDirectory()).map((entry) => path.join('packages', entry.name));
const manifests = new Map<string, Manifest>();
for (const dir of dirs) {
  const file = Bun.file(path.join(dir, 'package.json'));
  if (await file.exists()) {
    manifests.set(dir, (await file.json()) as Manifest);
  }
}
const workspaceNames = new Set([...manifests.values()].map((manifest) => manifest.name));

let narrowed = false;
for (const [dir, manifest] of manifests) {
  const committed = await $`git show HEAD:${dir}/package.json`.nothrow().quiet();
  if (committed.exitCode !== 0) {
    continue; // a package added in this change has no previous range
  }
  const before = new Map(Object.entries((JSON.parse(committed.stdout.toString()) as Manifest).peerDependencies ?? {}));
  for (const [dependency, range] of Object.entries(manifest.peerDependencies ?? {})) {
    const previous = before.get(dependency);
    if (!workspaceNames.has(dependency) || previous === undefined) {
      continue;
    }
    const dropped = (previous.match(/\d+\.\d+\.\d+/g) ?? []).filter((version) => !Bun.semver.satisfies(version, range));
    if (dropped.length > 0) {
      console.error(
        `${manifest.name}: changeset version would narrow its peer range on ${dependency} ` +
          `from "${previous}" to "${range}", dropping ${dropped.join(', ')}. ` +
          `Widen the range in package.json in the same PR as the ${dependency} bump.`,
      );
      narrowed = true;
    }
  }
}

if (narrowed) {
  process.exitCode = 1;
}
