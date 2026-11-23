// Fails if a package is about to drop support for a peer version without a breaking release:
//
//   bun scripts/check-peer-ranges.ts   (run by `bun run ci:version`, after `changeset version`)
//
// Compares each publishable package's peer dependencies with those of its latest release on
// npm. Narrowing a peer range, adding a peer, or making an optional peer required can leave a
// user's existing install unsatisfiable, so the new version must be a breaking release: outside
// `^<latest>`, which is a minor while the package is 0.x and a major from 1.0.
//
// The usual cause: a pipelines minor is outside use-form's `^0.y.0` peer range, so Changesets
// moves the range to the new minor but gives use-form only a patch. Add a minor changeset for
// use-form in the same PR.

import { readdir } from 'node:fs/promises';
import path from 'node:path';

import { $ } from 'bun';
import { major, satisfies, subset } from 'semver';

type Release = {
  version: string;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
};
type Manifest = Release & { name: string; private?: boolean };
type Peer = { range: string; optional: boolean };

// The latest release of `name` on npm, or undefined if it was never published. `npm view`
// exits 1 with E404 for an unpublished package; any other failure stops the check.
async function latestRelease(name: string): Promise<Release | undefined> {
  const result = await $`npm view ${`${name}@latest`} version peerDependencies peerDependenciesMeta --json`
    .nothrow()
    .quiet();
  if (result.exitCode !== 0) {
    const output = `${result.stdout.toString()}\n${result.stderr.toString()}`.trim();
    if (output.includes('E404')) {
      return undefined;
    }
    throw new Error(`npm view ${name}@latest failed (exit ${result.exitCode}):\n${output}`);
  }
  // With only `version` set, npm prints it as a bare string instead of an object.
  const release = JSON.parse(result.stdout.toString()) as string | Release;
  return typeof release === 'string' ? { version: release } : release;
}

// Each peer a release declares. A peer it doesn't declare accepts any version, or none.
function peersOf(release: Release): Map<string, Peer> {
  const meta = new Map(Object.entries(release.peerDependenciesMeta ?? {}));
  return new Map(
    Object.entries(release.peerDependencies ?? {}).map(([name, range]) => [
      name,
      { range, optional: meta.get(name)?.optional === true },
    ]),
  );
}

const ANY: Peer = { range: '*', optional: true };
const describe = (peer: Peer): string =>
  peer === ANY ? 'not a peer' : `"${peer.range}"${peer.optional ? ' (optional)' : ''}`;

let failed = false;
for (const entry of await readdir('packages', { withFileTypes: true })) {
  const file = Bun.file(path.join('packages', entry.name, 'package.json'));
  if (!entry.isDirectory() || !(await file.exists())) {
    continue;
  }
  const next = (await file.json()) as Manifest;
  const latest = next.private ? undefined : await latestRelease(next.name);
  // Nothing to compare with, or a breaking release, which may drop any peer version.
  if (latest === undefined || !satisfies(next.version, `^${latest.version}`)) {
    continue;
  }
  const before = peersOf(latest);
  const after = peersOf(next);
  for (const name of new Set([...before.keys(), ...after.keys()])) {
    const was = before.get(name) ?? ANY;
    const now = after.get(name) ?? ANY;
    if (subset(was.range, now.range) && (now.optional || !was.optional)) {
      continue;
    }
    console.error(
      `${next.name} ${next.version} drops ${name} versions that its latest release, ${latest.version}, accepts: ` +
        `${describe(was)} becomes ${describe(now)}. That is a breaking change, so add a ` +
        `${major(latest.version) === 0 ? 'minor' : 'major'} changeset for ${next.name}, or keep the old range.`,
    );
    failed = true;
  }
}

if (failed) {
  process.exitCode = 1;
}
