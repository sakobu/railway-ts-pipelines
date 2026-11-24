---
'@railway-ts/use-form': minor
---

Requires `@railway-ts/pipelines` 0.6.

`useForm`'s options, each `fieldValidators` entry, `FormMessages`, and `useFormAutoSubmission`'s `isStale` accept an explicit `undefined`. With `exactOptionalPropertyTypes` on, a conditional option such as `validationMode: mode` or `fieldValidators: on ? { … } : undefined` now type-checks. At runtime, `undefined` already meant "not set". Part of #41.

- **Breaking with `exactOptionalPropertyTypes`:** passing a `FormMessages` to your own type written without `| undefined` no longer type-checks; add `| undefined` there. Without the flag, nothing changes.
