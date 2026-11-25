---
'@railway-ts/use-form': minor
---

Switching a field validator off now drops the error it set. Leaving its key out of `fieldValidators`, or setting it to `undefined`, clears its error and validating flag in the same render, and a check of it still running never lands, even if the validator is switched back on. A submit waiting on that check counts it as never run, and calls `onSubmit` if nothing else fails. Fixes #42.

Every validation check now lives in the form state, and only the newest check of the schema or of a field lands its result. Other changes you can see:

- While a submit runs its field checks, `validatingFields` and `isValidating` show them.
- A field's error stays while a check of the same value runs, so resubmitting or blurring an unchanged value, or following a version that leaves it unchanged, no longer blinks it off and on. Typing a new value hides the old error at once, even while an async schema check runs.
- A submit's field check replaces a check of that field still running from typing, so only one result lands.
- Methods use the latest render's field validators, and keep their identity when an inline `fieldValidators` object changes.
- A bracket path such as `setFieldValue('r1[0]', …)` finds the `r1.0` field validator.
- Following new `initialValues` re-checks a field whose check it interrupted.
