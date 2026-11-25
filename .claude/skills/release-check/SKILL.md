---
name: release-check
description: Check the open "Version Packages" PR the way CI would, merge it once I say so, then confirm the release reached npm and GitHub.
disable-model-invocation: true
---

# Release check

The release workflow opens the "Version Packages" PR (branch `changeset-release/main`) with `github.token`, so GitHub runs no CI on it. Check it locally, merge it once I say so, and confirm what was published. Stop and report when anything fails.

## 1. Find the PR

Run `gh pr list --head changeset-release/main --state open --json number,title,url`.

If there is none, look at the latest release run: `gh run list --workflow release.yml --branch main --limit 1`. If it is still running, wait for it with `gh run watch <id> --exit-status` and look again. Otherwise report that no release is pending and stop.

## 2. Read what it releases

From `gh pr diff <number>`, list each package's version (from → to) and its changelog entries. Check them against CONTRIBUTING.md (Changesets): a pipelines minor comes with a use-form minor whose `@railway-ts/pipelines` peer range is the new minor. Report anything that doesn't line up, and stop if it would publish the wrong thing.

## 3. Run the checks on it

Use a throwaway worktree, so my checkout stays as it is:

```sh
git fetch origin changeset-release/main
dir="$(mktemp -d)/release-check"
git worktree add --detach "$dir" origin/changeset-release/main
```

Inside `$dir`, run `bun install --frozen-lockfile && bun run check`. Then, from the repo, run `git worktree remove --force "$dir"`, whether the checks passed or not.

## 4. Merge once I say so

Show me the versions and the check result, and ask whether to merge. Merging publishes to npm, and a published version can't be taken back. Only on a yes, run `gh pr merge <number> --merge`.

## 5. Watch the release run

Find the release run for the merge commit (`gh run list --workflow release.yml --branch main --limit 3 --json databaseId,headSha,status`) and wait for it with `gh run watch <id> --exit-status`.

## 6. Confirm what was published

For each released package and version:

- npm serves it: `npm view @railway-ts/<name>@<version> version`. npm can lag the run by a few minutes, so wait for it with one background loop rather than by polling again and again.
- It has provenance: `npm view @railway-ts/<name>@<version> dist.attestations.provenance.predicateType` prints `https://slsa.dev/provenance/v1`.
- use-form's peer ranges are the ones the PR set: `npm view @railway-ts/use-form@<version> peerDependencies`.
- Its tag and GitHub Release exist: `gh release view @railway-ts/<name>@<version>`.

Then, if my checkout is on `main` with no changes, run `git pull --ff-only`. Report each result.
