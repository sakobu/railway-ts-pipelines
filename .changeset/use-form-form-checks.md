---
'@railway-ts/use-form': minor
---

Switching a field validator off now drops the error it set. Leaving its key out of `fieldValidators`, or setting it to `undefined`, clears its error and validating flag in the same render, and a check of it still running never lands, even if the validator is switched back on. A submit waiting on that check still waits for it to settle, then counts it as never run, and calls `onSubmit` if nothing else fails. Fixes #42.

Every validation check now lives in the form state, and only the newest check of the schema or of a field lands its result. Other changes you can see:

- While a submit runs its field checks, `validatingFields` and `isValidating` show them.
- `isValidating` stays true while a field check waits on an older schema check, after a newer one ended.
- A field's error stays while a check of the same value runs, so resubmitting or blurring an unchanged value, or following a version that leaves it unchanged, no longer blinks it off and on. In `live` mode, typing a new value hides the old error at once, even while an async schema check runs.
- A submit's field check replaces a check of that field still running from typing, so only one result lands.
- A submit whose field validator throws or rejects waits for its other field checks to settle before it fails, where it used to fail at once.
- Methods use the latest render's field validators, and keep their identity when an inline `fieldValidators` object changes.
- A bracket path such as `setFieldValue('r1[0]', …)` finds the `r1.0` field validator.
- Following new `initialValues` re-checks a field whose check it interrupted.
- A thenable that isn't a native `Promise`, such as a library's promise or one from another realm, is now awaited wherever an answer can be async: a field or schema validator's when typing or blurring (a submit already awaited it), a Standard Schema's result, and `validateForm`'s in `useFormAutoSubmission`.
- A field named after an `Object.prototype` member, such as `constructor`, now gets its field validator. Before, the form read the inherited member as a schema error for the field, and skipped it. Such a field is also marked touched on change in `live` mode now, so `getFieldError` shows its error, and it reads no error where the field has none.
