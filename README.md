# railway-ts

[![CI](https://github.com/sakobu/railway-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/sakobu/railway-ts/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Railway-oriented programming for TypeScript. `@railway-ts/pipelines` gives you typed `Result` and `Option` values, composition helpers and a schema layer that validates untrusted input into a `Result`. `@railway-ts/use-form` builds schema-first React forms on top of it. Errors are values, not exceptions, from the schema all the way to the form.

| Package                                        | Description                                                                    | npm                                                                                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| [`@railway-ts/pipelines`](packages/pipelines/) | `Result`/`Option` pipelines, composition and schema validation. ESM only.      | [![npm](https://img.shields.io/npm/v/@railway-ts/pipelines.svg)](https://www.npmjs.com/package/@railway-ts/pipelines) |
| [`@railway-ts/use-form`](packages/use-form/)   | React form hook driven by a pipelines schema or any Standard Schema. ESM only. | [![npm](https://img.shields.io/npm/v/@railway-ts/use-form.svg)](https://www.npmjs.com/package/@railway-ts/use-form)   |

## Development

The repo is a [Bun](https://bun.com) workspace. Bun's version is pinned in `package.json` (`packageManager`). Builds need Node 22.18+ or 24.11+ as well, because tsdown and the package checks run on Node.

```bash
bun install
bun run check   # build, type-check, lint, format check, tests, package checks, size limits
bun run dev     # rebuild pipelines on change (use-form imports its built output)
```

Every pull request that changes a package needs a changeset:

```bash
bun run changeset
```

Merging to `main` collects pending changesets into a "Version Packages" pull request. Merging that publishes the new versions to npm, tags them and creates the GitHub Releases.

See [CONTRIBUTING.md](CONTRIBUTING.md) for every command and the conventions.

## License

MIT © Sarkis Melkonian
