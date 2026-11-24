---
'@railway-ts/pipelines': minor
---

Options accept an explicit `undefined`. With `exactOptionalPropertyTypes` on, `validate(value, validator, { abortEarly: maybe })`, `object(schema, { strict: maybe })` and `union(validators, { errorPrefix: maybe })` now type-check. At runtime, `undefined` already meant "not set". `union`'s options are a named, exported type, `UnionOptions`. Part of #41.

- `validate`'s `path` and options arguments accept `undefined` too, with or without the flag. `validate(value, validator, maybeOptions)` and `validate(value, validator, path, maybeOptions)` failed to compile when the argument could be `undefined`, though `validateAndFormatResult` accepted it.
- **Breaking with `exactOptionalPropertyTypes`:** `ValidationError.cause` and `ValidateOptions.abortEarly` are typed `?: T | undefined`. Passing a `ValidationError` or `ValidateOptions` to your own type written without `| undefined`, such as `cause?: ValidationError[]`, no longer type-checks; add `| undefined` there. Without the flag, nothing changes.
