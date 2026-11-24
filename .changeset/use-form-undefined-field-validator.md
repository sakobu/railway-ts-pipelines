---
'@railway-ts/use-form': patch
---

A `fieldValidators` entry set to `undefined` no longer fails every submit. `handleSubmit` called every entry, so an `undefined` one threw `TypeError: validatorFn is not a function`, which was logged with `console.error`. The submit then ended with the generic submit error (`messages.submitFailed`), and `onSubmit` never ran. An entry set to `undefined` is now skipped at submit, as a missing one is, and as it already was when a field changed. Fixes #40.
