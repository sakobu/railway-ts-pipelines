---
'@railway-ts/pipelines': minor
---

`object()`'s output keys now match its input, and `InferSchemaType` is exactly a validator's output type. Fixes #17.

- **Breaking:** `object()` no longer adds a key the input doesn't have, unless its validator returns a value. `object({ age: optional(number()) })` turns `{}` into `{}`, not `{ age: undefined }`. A key the input has is kept, even when its value becomes `undefined`: `{ age: null }` gives `{ age: undefined }`. Code that reads `'age' in output` or `Object.keys(output)`, or compares the output with `toStrictEqual` or a deep-equal that counts keys, may see a difference. Spreading the output over a record (`{ ...record, ...output }`) no longer overwrites fields the input didn't send.
- **Breaking:** `InferSchemaType<V>` no longer rewrites the output type, so it is what `validate()` returns. A hand-typed `Validator<unknown, { a: number | undefined }>` now infers a required `a`, as the validator declares it.
- `InferSchemaType` keeps class instances: `URL` from `parseURL()`, `File`, and classes with private fields were turned into plain object types that weren't assignable to the class. It also works for validators whose input isn't `unknown`: `InferSchemaType` of `minLength(3)` is `string`, not `never`.
- **Breaking with `exactOptionalPropertyTypes`:** optional keys are typed `age?: number | undefined`. Without the flag this is the same type as before. With it, the type now says the key can hold `undefined`, as the runtime allows, so a value like `{ age: undefined }` or `{ age: maybeAge }` is accepted. Code that assumed a present key is never `undefined` gets a type error, and so does an annotation written `age?: number`, such as the `refineAt<{ age?: number }>` type argument the 0.3.0 notes suggested: write `age?: number | undefined`, or use `InferSchemaType`.
