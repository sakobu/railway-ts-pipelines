# @railway-ts/use-form

## 0.2.1

### Patch Changes

- 71a4aec: `useForm` and `isStandardSchema` now accept Standard Schemas that are functions, such as ArkType's. Before, passing an ArkType schema to `useForm` crashed with a `TypeError`.

## 0.2.0

### Minor Changes

- 3587cac: Requires `@railway-ts/pipelines` 0.2: the peer range is now `^0.2.0`, and pipelines 0.1 is no longer supported. Upgrade pipelines first; its 0.2.0 changelog lists the breaking changes.

### Patch Changes

- ae052e8: TypeScript is now an optional peer dependency. npm, pnpm and Yarn no longer install TypeScript into JavaScript projects that use the package; in TypeScript projects the `>=5.0` requirement is still checked.

## 0.1.34

### Patch Changes

- 89e8f83: Accept `@railway-ts/pipelines` 0.2 (the peer range is now `^0.1.27 || ^0.2.0`). Built with tsdown instead of tsup; the declarations file is now `dist/index.d.mts`. Repository links now point to the `railway-ts` monorepo.
