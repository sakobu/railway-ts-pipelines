# @railway-ts/pipelines

## 0.6.0

### Minor Changes

- bfb5029: Options accept an explicit `undefined`. With `exactOptionalPropertyTypes` on, `validate(value, validator, { abortEarly: maybe })`, `object(schema, { strict: maybe })` and `union(validators, { errorPrefix: maybe })` now type-check. At runtime, `undefined` already meant "not set". `union`'s options are a named, exported type, `UnionOptions`. Part of #41.

  - `validate`'s `path` and options arguments accept `undefined` too, with or without the flag. `validate(value, validator, maybeOptions)` and `validate(value, validator, path, maybeOptions)` failed to compile when the argument could be `undefined`, though `validateAndFormatResult` accepted it.
  - **Breaking with `exactOptionalPropertyTypes`:** `ValidationError.cause` and `ValidateOptions.abortEarly` are typed `?: T | undefined`. Passing a `ValidationError` or `ValidateOptions` to your own type written without `| undefined`, such as `cause?: ValidationError[]`, no longer type-checks; add `| undefined` there. Without the flag, nothing changes.

## 0.5.0

### Minor Changes

- c42edbb: `object()`'s output keys now match its input, and `InferSchemaType` is exactly a validator's output type. Fixes #17.

  - **Breaking:** `object()` no longer adds a key the input doesn't have, unless its validator returns a value. `object({ age: optional(number()) })` turns `{}` into `{}`, not `{ age: undefined }`. A key the input has is kept, even when its value becomes `undefined`: `{ age: null }` gives `{ age: undefined }`. Code that reads `'age' in output` or `Object.keys(output)`, or compares the output with `toStrictEqual` or a deep-equal that counts keys, may see a difference. Spreading the output over a record (`{ ...record, ...output }`) no longer overwrites fields the input didn't send.
  - **Breaking:** `object()` and `discriminatedUnion()` read only the input's own properties. A key the input inherits, like a getter declared on a class, is missing: `optional()` leaves it out and `required()` fails. A missing optional key named like an `Object.prototype` member, such as `toString` or `constructor`, no longer reads the built-in and fails validation.
  - **Breaking:** `InferSchemaType<V>` no longer rewrites the output type, so it is what `validate()` returns. A hand-typed `Validator<unknown, { a: number | undefined }>` now infers a required `a`, as the validator declares it.
  - `InferSchemaType` keeps class instances: `URL` from `parseURL()`, `File`, and classes with private fields were turned into plain object types that weren't assignable to the class. It also works for validators whose input isn't `unknown`: `InferSchemaType` of `minLength(3)` is `string`, not `never`.
  - **Breaking with `exactOptionalPropertyTypes`:** optional keys are typed `age?: number | undefined`. Without the flag this is the same type as before. With it, the type now says the key can hold `undefined`, as the runtime allows, so a value like `{ age: undefined }` or `{ age: maybeAge }` is accepted. Code that assumed a present key is never `undefined` gets a type error, and so does an annotation written `age?: number`, such as the `refineAt<{ age?: number }>` type argument the 0.3.0 notes suggested: write `age?: number | undefined`, or use `InferSchemaType`.

## 0.4.2

### Patch Changes

- 05e206f: **Security:** `discriminatedUnion()` no longer lets crafted input skip validation. It looked the discriminant up in the validator map without checking for an own key, so a value naming an `Object.prototype` member ran that built-in as the validator. `'constructor'` returned the input itself, so an input shaped like an `ok` Result, such as `{ type: 'constructor', ok: true, value: … }`, passed unvalidated. `'toString'`, `'valueOf'` or `'__proto__'` returned a non-Result or threw. The lookup now uses only the map's own keys, and any other value fails with the fallback message. Upgrade if you validate untrusted input with `discriminatedUnion()`.

## 0.4.1

### Patch Changes

- 07c3e36: Correct the bundle sizes quoted in the README, and the TypeScript badge (6.0+).

## 0.4.0

### Minor Changes

- 62f9376: Add `decodeResult` to `@railway-ts/pipelines/schema`. It reads a `Result` sent as JSON back into a typed `Result` with no cast. A `Result` serializes to `{ ok: true, value }` or `{ ok: false, error }`, so the server sends it as is (`Response.json(result)`), and the client calls `decodeResult(await res.json(), schema)`. The value is checked against the schema, and the error list against `ValidationError[]`. Anything else, such as an error page's JSON or a value the schema rejects, becomes one error at path `[]` (default message `'Unexpected response'`), and the reasons go in its `cause`. Write each `object()` in a response schema with `{ strict: false }`, so the server can add fields without breaking older clients.

  - `ValidationError` gains an optional `cause?: ValidationError[]`: the errors that explain this one, like `Error.cause`. Only `decodeResult` sets it.
  - **Breaking:** a type that has its own `cause` of another type (for example `cause: unknown` from mapping an `Error`, or `cause?: string`) is no longer assignable to `ValidationError`, so passing it to pipelines or to use-form's `setServerErrors` is a type error. Rename that field, or map each error to `{ path, message }`.

## 0.3.0

### Minor Changes

- 4f280d7: Add `isResult(value)`, which tells whether any value is a `Result`.
- 8c66e2a: `object()` now types optional fields as optional keys (`{ age?: number }`), the same shape `InferSchemaType` gives. Before, they were required keys typed `number | undefined`. Code annotated with the old shape may need updating. This includes `refineAt<…>` type arguments that write `age: number | undefined` (write `age?: number`, or use `InferSchemaType`), and generic helpers that return `object(schema)` as `Validator<unknown, T>` (let TypeScript infer the return type).
- 2c5dbc2: Requires TypeScript 6.0 or later (was 5.0) and Node.js 22.12 or later (was 18).

## 0.2.1

### Patch Changes

- ae052e8: TypeScript is now an optional peer dependency. npm, pnpm and Yarn no longer install TypeScript into JavaScript projects that use the package; in TypeScript projects the `>=5.0` requirement is still checked.

## 0.2.0

### Minor Changes

- 89e8f83: ESM-only, with fixed type declarations. Both changes can break existing code, so this ships as a minor.

  - **ESM-only.** The CommonJS build is gone. `import` works as before on Node.js 18+. CommonJS code can still `require()` the package on Node.js 20.19+ or 22.12+, where Node loads ES modules from `require()`; with TypeScript, that needs `module: nodenext` and TypeScript 5.8+. Older Node.js versions, older TypeScript CommonJS setups, and test runners that load modules as CommonJS (such as Jest without ESM support) need to switch to ESM or transform the package. Every module system now sees one copy of the code and one set of types.
  - The `RESULT_BRAND`, `OPTION_BRAND` and `TupleType` declarations are back in the published declaration files. They were marked `@internal` and stripped, while `Result`, `Option` and `tuple()` still referenced them, so with `skipLibCheck` on (the usual setting) a hand-written `{ ok: true, value }` object type-checked as a `Result` and `tuple()` lost its element types. Code that type-checked only because of that may now report errors: build values with `ok()`, `err()`, `some()` and `none()` instead of object literals.
  - The brands use `Symbol.for`, so values created by any entry point, or by a second installed copy of the package, are recognized everywhere.
  - Built with tsdown instead of tsup: one shared runtime chunk for Option and Result, no phantom declaration exports, one source map comment per file.
  - Repository links now point to the `railway-ts` monorepo.
