---
name: open-pr
description: Simplify, review and check the current branch, then push it and open its PR. Rerun after new commits to push them to the open PR.
argument-hint: '[code-review level: low|medium|high|xhigh]'
disable-model-invocation: true
---

# Open a PR

Take the current branch from "the work is done" to an open pull request. Work through the steps in order. Stop and tell me when a step fails in a way you can't fix, or needs my decision.

## 1. Check the branch

- If the current branch is `main`, stop.
- Commit any uncommitted work, in the style of step 6. The reviews below look only at commits.
- Run `git fetch origin`. If `origin/main` has commits this branch doesn't (`git merge-base --is-ancestor origin/main HEAD` fails), ask whether to rebase onto it first.
- If `git diff origin/main...HEAD` is empty, there is nothing to open a PR for: stop.

Both reviews get `origin/main...HEAD` as their target, which is the whole branch as the PR shows it. Without a target, they compare against the branch's pushed copy, so a branch that was already pushed would show them nothing.

## 2. Simplify

Run the built-in `simplify` skill with the argument `origin/main...HEAD`. Commit what it changed as `refactor(<scope>): …`, one commit per logical change.

## 3. Review

Run the `code-review` skill with the arguments `<level> --fix origin/main...HEAD`, where `<level>` is `$ARGUMENTS`, or `xhigh` if that is empty. Fix every real finding, minor ones included. Note each finding you skip, and why, for the report. Commit the fixes as `fix(<scope>): …`, `test(<scope>): …` or `docs(<scope>): …`.

## 4. Changesets and docs

Follow CONTRIBUTING.md:

- A change to a published package (anything under `packages/*/` that ships) needs a changeset in `.changeset/` naming each changed package and its bump: patch for fixes, minor for features and, while 0.x, for breaking changes.
- A pipelines minor also needs a use-form minor, with use-form's `@railway-ts/pipelines` peer range moved to the new minor.
- A behavior change updates that package's docs: `docs/`, the README and the JSDoc.

Add whatever is missing.

## 5. Run the checks

Run `bun run format`, then `bun run check`, which runs everything CI checks. Fix failures and rerun until it passes.

## 6. Commit and mark the reviewed commit

Commit anything left, matching `git log`: conventional commits, scope `pipelines` or `use-form` (none for repo-wide changes), `!` when breaking, and a subject that says what is now true. Then record the reviewed commit, which the `gh pr create` hook in `.claude/settings.json` checks:

```sh
git rev-parse HEAD > "$(git rev-parse --git-dir)/open-pr-reviewed"
```

## 7. Push and open the PR

Run `git push -u origin HEAD`. If the branch already has an open PR (`gh pr view` succeeds), stop here and report its URL.

Otherwise open it with `gh pr create --base main`:

- **Title:** a conventional commit, like recent PRs: `fix(use-form): …`, `feat(pipelines)!: …`.
- **Body:** shaped like #43 and #46 (`gh pr view 46` to compare):
  - `## Summary`, opening with `Fixes #N` when an issue covers this change. Look for one in the commits, the branch name and `gh issue list`.
  - Paragraphs led in bold: **The problem.**, **The fix.** (or **The rule.**), **Tests.**, **Docs.** and **Release.** (each package's bump, from → to). Leave out the ones that don't apply.
  - With a changeset, end the summary with: After this merges, the release workflow opens a "Version Packages" PR. GitHub runs no CI on that PR, so check it out and run `bun install --frozen-lockfile && bun run check` before merging it.
  - `## Related, not fixed here` for known problems next to this change, with their issue numbers.

## 8. Report

Give the PR URL, what simplify and the review changed, each finding you skipped and why, and whether an issue was linked. Remind me that `/steward` watches CI and review comments until the PR is merged, and that `/release-check` handles the Version Packages PR afterwards.
