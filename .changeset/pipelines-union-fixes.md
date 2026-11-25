---
'@railway-ts/pipelines': patch
---

`union` fixes:

- With `collectAllErrors: false`, `union` tries every validator until one accepts the value, as it does by default. It stopped at the first validator that failed, so `union([string(), number()], { collectAllErrors: false })(42)` was an error, though `number()` accepts `42`. A union that fails still reports only the first validator's errors. Values such a union rejected before now pass, and a union whose first validator is sync and fails now runs the async validators after it, so it can return a `Promise`, as its `MaybeAsyncValidator` type allows. Fixes #45.
- A failing `union` keeps each error's `cause`. It rebuilt every error as `{ path, message }`, so a `cause` set by your own validator was lost, with or without `errorPrefix`. `errorPrefix` now changes only `message`. Fixes #48.
- `errorPrefix` goes before the error of a union with no validators too, as it does before every other error.
