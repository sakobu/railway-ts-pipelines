---
'@railway-ts/pipelines': patch
'@railway-ts/use-form': patch
---

TypeScript is now an optional peer dependency. npm, pnpm and Yarn no longer install TypeScript into JavaScript projects that use the package; in TypeScript projects the `>=5.0` requirement is still checked.
