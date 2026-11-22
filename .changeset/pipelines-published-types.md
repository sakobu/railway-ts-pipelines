---
'@railway-ts/pipelines': minor
---

ESM-only, with fixed type declarations. Both changes can break existing code, so this ships as a minor.

- **ESM-only.** The CommonJS build is gone. `import` works as before on Node.js 18+. CommonJS code can still `require()` the package on Node.js 20.19+ or 22.12+, where Node loads ES modules from `require()`; with TypeScript, that needs `module: nodenext` and TypeScript 5.8+. Older Node.js versions, older TypeScript CommonJS setups, and test runners that load modules as CommonJS (such as Jest without ESM support) need to switch to ESM or transform the package. Every module system now sees one copy of the code and one set of types.
- The `RESULT_BRAND`, `OPTION_BRAND` and `TupleType` declarations are back in the published declaration files. They were marked `@internal` and stripped, while `Result`, `Option` and `tuple()` still referenced them, so with `skipLibCheck` on (the usual setting) a hand-written `{ ok: true, value }` object type-checked as a `Result` and `tuple()` lost its element types. Code that type-checked only because of that may now report errors: build values with `ok()`, `err()`, `some()` and `none()` instead of object literals.
- The brands use `Symbol.for`, so values created by any entry point, or by a second installed copy of the package, are recognized everywhere.
- Built with tsdown instead of tsup: one shared runtime chunk for Option and Result, no phantom declaration exports, one source map comment per file.
- Repository links now point to the `railway-ts` monorepo.
