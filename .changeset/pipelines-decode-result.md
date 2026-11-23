---
'@railway-ts/pipelines': minor
---

Add `decodeResult` to `@railway-ts/pipelines/schema`. It reads a `Result` sent as JSON back into a typed `Result` with no cast. A `Result` serializes to `{ ok: true, value }` or `{ ok: false, error }`, so the server sends it as is (`Response.json(result)`), and the client calls `decodeResult(await res.json(), schema)`. The value is checked against the schema, and the error list against `ValidationError[]`. Anything else, such as an error page's JSON or a value the schema rejects, becomes one error at path `[]` (default message `'Unexpected response'`), and the reasons go in its `cause`. Write each `object()` in a response schema with `{ strict: false }`, so the server can add fields without breaking older clients.

- `ValidationError` gains an optional `cause?: ValidationError[]`: the errors that explain this one, like `Error.cause`. Only `decodeResult` sets it.
- **Breaking:** a type that has its own `cause` of another type (for example `cause: unknown` from mapping an `Error`, or `cause?: string`) is no longer assignable to `ValidationError`, so passing it to pipelines or to use-form's `setServerErrors` is a type error. Rename that field, or map each error to `{ path, message }`.
