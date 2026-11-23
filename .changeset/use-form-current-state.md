---
'@railway-ts/use-form': patch
---

Form methods now see the calls made before them in the same handler. Before, they read the state from the last render, so:

- `setFieldValue`, `setValues`, `resetForm` or an array helper followed by `handleSubmit` submitted the old values. If a submission of the old values was running, the edit was never submitted.
- Two array helper calls in a row, such as two `push`es, kept only the last change.
- Validation after a second call, or after `setFieldTouched`, could show an error for a value that had already changed.

`setFieldValue` now stores the new value before calling `onFieldChange`, so `setFieldValue` calls made inside `onFieldChange` apply after it. A nested write to the same field now wins; before, the outer write overwrote it.
