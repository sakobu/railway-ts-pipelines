# Contributing

This repo holds two packages. Each has its own contributing notes for code rules, structure and tests:

- [`packages/pipelines/CONTRIBUTING.md`](packages/pipelines/CONTRIBUTING.md)
- [`packages/use-form/CONTRIBUTING.md`](packages/use-form/CONTRIBUTING.md)

This file covers what applies to both.

## Setup

```bash
git clone https://github.com/sakobu/railway-ts.git
cd railway-ts
bun install
```

**Prerequisites:** Bun (the version pinned in `package.json` under `packageManager`), Node 22.18+, 24.11+ or 26+ (tsdown and the package checks run on Node; CI uses 26), and TypeScript knowledge.

## Commands

Run these from the repo root. Each one builds what it needs first.

| Command                 | What it does                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| `bun run build`         | Build both packages with [tsdown](https://tsdown.dev), pipelines first                                    |
| `bun run dev`           | Rebuild pipelines on change                                                                               |
| `bun run typecheck`     | Type-check every package and the repo scripts with `tsc`                                                  |
| `bun run test`          | Run both test suites with `bun test`                                                                      |
| `bun run test:coverage` | Run the tests with coverage and enforce 100% line coverage per package                                    |
| `bun run test:package`  | Build pipelines and check it the way consumers see it (types and runtime)                                 |
| `bun run lint`          | Lint with [oxlint](https://oxc.rs/docs/guide/usage/linter), type-aware; fails if a file has no lint rules |
| `bun run lint:fix`      | Lint and apply safe fixes                                                                                 |
| `bun run format`        | Format with [oxfmt](https://oxc.rs/docs/guide/usage/formatter) and sort imports                           |
| `bun run format:check`  | Check formatting                                                                                          |
| `bun run size`          | Check bundle sizes with [size-limit](https://github.com/ai/size-limit) (build first)                      |
| `bun run check`         | Everything CI checks: build, typecheck, lint, format, tests at 100% coverage, package checks, size        |
| `bun run changeset`     | Record a release note and version bump with [Changesets](https://changesets.dev)                          |

use-form imports pipelines through its built output, exactly as npm users do. To run a command inside one package (for example `cd packages/use-form && bun test`), build pipelines first with `bun run build`, or keep `bun run dev` running.

**TypeScript stays on 6.x for now.** TypeScript 7 no longer ships the JavaScript compiler API that `@eslint-react/eslint-plugin` loads (through typescript-eslint) inside oxlint, so with 7 installed `bun run lint` fails with "Failed to load JS plugin". Type-aware lint rules already run on TypeScript 7 through `oxlint-tsgolint`. Move `typescript` to 7 once `@eslint-react/eslint-plugin` supports it.

Support floors are tested. The `typescript` peer floor in both packages is the repo's TypeScript minor, so the repo's own type check tests it; raise them together. `engines.node` is tested by CI's `node-floor` job; change its `node-version` with it.

**Options accept `undefined`.** The repo type-checks with `exactOptionalPropertyTypes`, so an option whose absence means "use the default" must say it accepts an explicit `undefined`: a property is typed `?: T | undefined`, and an optional positional argument `T | undefined`. Then a conditional option like `{ strict: maybe }` compiles. Value types, such as schema outputs and the argument of use-form's `setValues`, mirror what is stored and keep plain `?: T`. A new options type gets a line in `packages/pipelines/tests/package/optional-options.ts` or `packages/use-form/tests/types/optionalOptions.ts`, which fail when one of its options rejects `undefined`.

## Changesets

Every pull request that changes a published package needs a changeset. Run `bun run changeset`, pick the packages and the bump, and write the summary users will read in the changelog:

- **patch:** bug fixes and internal changes
- **minor:** new features, and, while the packages are 0.x, changes that can break existing code
- **major:** reserved for 1.0 and later

**use-form supports one pipelines minor at a time, so a pipelines minor needs a use-form minor in the same PR.** Set use-form's peer range in `packages/use-form/package.json` to the new minor (for example `^0.3.0`), update use-form for any breaking change, and add a minor changeset for use-form: dropping the previous pipelines minor is a breaking change for use-form users. More generally, a release that accepts fewer peer versions than the package's latest release on npm must be a breaking release. `bun run ci:version` checks this, and CI checks every pull request.

Commit the generated file in `.changeset/` with your change. Changes that publish nothing (docs outside the packages, CI, repo tooling) don't need one.

After a merge to `main`, the release workflow collects pending changesets into a "Version Packages" pull request and starts CI on it (GitHub runs none on its own for a pull request the workflow opens). Merging that pull request publishes the new versions to npm, tags them `@railway-ts/<name>@<version>` and creates the GitHub Releases.

## Pull Requests

1. Open an issue first for new features
2. One feature/fix per PR
3. Add tests for all new code
4. Update docs if behavior changes
5. Add a changeset if a package changes
6. Run `bun run check` before submitting
7. Clear PR description with issue references

## Commit Format

Use conventional commits:

```
type(scope): brief description

Longer description if needed

Fixes #123
```

**Types:** `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `chore`

**Examples:**

```
feat(result): add mapErr function
fix(schema): correct type inference for nested optional fields
feat(form): add fieldValidators option for per-field async validation
fix(reducer): correct server error auto-clear for nested paths
docs(recipes): add Standard Schema examples
test(option): add tests for combine() with mixed Some/None
```

## Questions

- Bug reports: [Open issue](https://github.com/sakobu/railway-ts/issues)
- Feature ideas and questions: [Open issue](https://github.com/sakobu/railway-ts/issues) (discuss first)

## License

By contributing, you agree your contributions will be licensed under MIT.
