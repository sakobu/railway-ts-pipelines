---
'@railway-ts/use-form': minor
---

Requires `@railway-ts/pipelines` 0.5.

In 0.5, `object()` leaves out an optional key its input doesn't have. So the values `onSubmit` receives, the `ok` value of `handleSubmit()` and `validateForm()`, and what `savedValues` reads when `onSubmit` returns nothing no longer hold an optional key that the validated values don't have. A key they hold as `undefined` is kept.
