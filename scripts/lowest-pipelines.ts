// Finds the lowest @railway-ts/pipelines version that use-form's peer range accepts, for CI's
// use-form-min-pipelines job, and prints it as GitHub Actions step outputs:
//
//   bun scripts/lowest-pipelines.ts >> "$GITHUB_OUTPUT"
//
//   version=<the lowest accepted version>
//   older=<true if it is older than the workspace's pipelines>
//
// The job installs that version from npm and runs use-form's checks against it. Right after a
// pipelines minor, and in the PR that makes one, the lowest accepted version is the workspace's
// own (or not published yet). The checks job already tests that, so older is false and the job
// skips its checks.

import { lt, minVersion } from 'semver';

type Manifest = { version: string; peerDependencies?: Record<string, string> };

const useForm = (await Bun.file('packages/use-form/package.json').json()) as Manifest;
const pipelines = (await Bun.file('packages/pipelines/package.json').json()) as Manifest;

const range = new Map(Object.entries(useForm.peerDependencies ?? {})).get('@railway-ts/pipelines');
if (range === undefined) {
  throw new Error('use-form has no peer dependency on @railway-ts/pipelines');
}
// minVersion throws on an invalid range and returns null for one that accepts no version.
const lowest = minVersion(range);
if (!lowest) {
  throw new Error(`use-form's peer range on @railway-ts/pipelines accepts no version: "${range}"`);
}
const older = lt(lowest, pipelines.version);

console.error(
  `Lowest @railway-ts/pipelines that use-form accepts ("${range}"): ${lowest.version}. ` +
    (older
      ? `Older than the workspace's ${pipelines.version}: testing it.`
      : `Not older than the workspace's ${pipelines.version}, which the checks job tests: skipping.`),
);
console.log(`version=${lowest.version}`);
console.log(`older=${older}`);
