---
'@railway-ts/use-form': minor
---

Form methods now see the calls made before them in the same handler. Before, they read the state from the last render, so:

- `setFieldValue`, `setValues`, `resetForm` or an array helper followed by `handleSubmit` submitted the old values. If a submission of the old values was running, the edit was never submitted.
- Two array helper calls in a row, such as two `push`es, kept only the last change.
- Validation after a second call, or after `setFieldTouched`, could show an error for a value that had already changed.

**Breaking:** `setFieldValue` now stores the new value before calling `onFieldChange`, so any form call made inside `onFieldChange` applies on top of the change. Before, the outer write was applied last. A nested write to the same field now wins, and a nested `resetForm()` or `setValues()` now also resets or overwrites the field that just changed. To reset the other fields when one changes, call `setValues({ ...defaults, [field]: value })` inside `onFieldChange`.
