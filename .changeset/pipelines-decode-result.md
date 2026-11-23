---
'@railway-ts/pipelines': minor
---

Add `decodeResult` to `@railway-ts/pipelines/schema`. It reads a `Result` sent as JSON back into a typed `Result` with no cast. A `Result` serializes to `{ ok: true, value }` or `{ ok: false, error }`, so the server sends it as is (`Response.json(result)`), and the client calls `decodeResult(await res.json(), schema)`. The value is checked against the schema, and the error list against `ValidationError[]`. Anything else, such as an error page's JSON or a value the schema rejects, becomes one error at path `[]` (default message `'Unexpected response'`), and the reasons go in its `cause`.

`ValidationError` gains an optional `cause?: ValidationError[]`: the errors that explain this one, like `Error.cause`. Only `decodeResult` sets it.
