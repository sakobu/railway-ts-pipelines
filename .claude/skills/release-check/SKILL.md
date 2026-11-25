---
name: release-check
description: Wait for CI on the open "Version Packages" PR, merge it once I say so, then confirm the release reached npm and GitHub.
disable-model-invocation: true
---

# Release check

The release workflow opens the "Version Packages" PR (branch `changeset-release/main`), then its `start-ci` job starts CI on it: GitHub runs none on its own for a PR opened with `github.token`. Wait for that CI, merge the PR once I say so, and confirm what was published. Stop and report when anything fails.

To wait for a workflow run, run this in the background, since a run can outlast the Bash timeout, and keep its output short: `gh run watch <id> --exit-status --compact --interval 10 > /dev/null; echo "exit=$?"`. Then run `gh run view <id>`, adding `--log-failed` when it failed. A run can take a few seconds to be listed after whatever started it, so when `gh run list` finds none, look again shortly before concluding there is none.

## 1. Find the PR

Run `gh pr list --head changeset-release/main --state open --json number,title,url,headRefOid`.

If there is none, look at the latest release run: `gh run list --workflow release.yml --branch main --limit 1`. If it is still running, wait for it and look again. Otherwise report that no release is pending and stop.

## 2. Read what it releases

From `gh pr diff <number>`, list each package's version (from → to) and its changelog entries.

## 3. Wait for its CI

Find the CI run for the PR's head commit: `gh run list --workflow ci.yml --commit <headRefOid> --json databaseId,status,conclusion`. If there is none, the release run that last updated the PR may still be running: wait for it as in step 1 and look again. If that run has finished and there is still no CI run, show me its `start-ci` job's log (or that the job was skipped) and offer to start CI with `gh workflow run ci.yml --ref changeset-release/main`, which runs it as me. Only on a yes, run it and look again.

Wait for the CI run. Its `release-plan` job checks the PR's peer ranges against npm, the rule CONTRIBUTING.md (Changesets) gives for a pipelines minor.

## 4. Merge once I say so

Show me the versions and the CI result, and ask whether to merge. Merging publishes to npm, and a published version can't be taken back. Only on a yes, run `gh pr merge <number> --merge --match-head-commit <headRefOid>`, so that a PR the release workflow updated after its CI ran isn't merged unchecked. If the merge is refused because the head moved, start again from step 1.

## 5. Watch the release run

Get the merge commit with `gh pr view <number> --json mergeCommit --jq .mergeCommit.oid`, find its run with `gh run list --workflow release.yml --commit <sha> --json databaseId`, and wait for it.

## 6. Confirm what was published

For each released package and version:

- npm serves it, with provenance: `npm view @railway-ts/<name>@<version> version dist.attestations.provenance.predicateType --json` prints the version and `https://slsa.dev/provenance/v1`. npm can lag the run by a few minutes, so wait for it with one background loop rather than by polling again and again.
- Its tag and GitHub Release exist: `gh release view @railway-ts/<name>@<version> --json url`.

Then, if my checkout is on `main` with no changes, run `git pull --ff-only`. Report each result.
