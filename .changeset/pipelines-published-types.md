---
'@railway-ts/pipelines': minor
---

Fix the published type declarations. This can surface new type errors in code that relied on the holes, so it ships as a minor.

- The `RESULT_BRAND`, `OPTION_BRAND` and `TupleType` declarations are back in the published `.d.ts` files. They were marked `@internal` and stripped, while `Result`, `Option` and `tuple()` still referenced them, so with `skipLibCheck` on (the usual setting) a hand-written `{ ok: true, value }` object type-checked as a `Result` and `tuple()` lost its element types. Code that type-checked only because of that may now report errors: build values with `ok()`, `err()`, `some()` and `none()` instead of object literals.
- CommonJS consumers get CommonJS types. The exports map now nests `types` under `import` (`.d.mts`) and `require` (`.d.cts`); before, `require()` consumers were given the ESM declarations.
- The brands use `Symbol.for`, so values created by any entry point, in the ESM or the CommonJS build, are recognized by every other one.
- Built with tsdown instead of tsup: one shared runtime chunk for Option and Result, no phantom declaration exports, one source map comment per file.
- Repository links now point to the `railway-ts` monorepo.
