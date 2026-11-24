---
'@railway-ts/use-form': patch
---

A `fieldValidators` entry set to `undefined` no longer fails every submit. `handleSubmit` called every entry, so an `undefined` one threw, the submit ended with the default submit error, and `onSubmit` never ran. An entry set to `undefined` now behaves like a missing one, as it already did when a field changed. Fixes #40.
