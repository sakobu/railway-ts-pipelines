---
'@railway-ts/use-form': minor
---

Form methods now see the calls made before them in the same handler. Before, they read the state from the last render, so:

- `setFieldValue`, `setValues`, `resetForm` or an array helper followed by `handleSubmit` submitted the old values. If a submission of the old values was running, the edit was never submitted.
- Two array helper calls in a row, such as two `push`es, kept only the last change.
- Validation after a second call, or after `setFieldTouched`, could show an error for a value that had already changed.
- A `setFieldValue` called from a child component's effect right after a re-render ran the previous render's `onFieldChange`.
- In `'mount'` validation mode, a `resetForm` kept from an earlier render validated that render's `initialValues` instead of the values it reset to.

**Breaking:** `setFieldValue` now stores the new value before calling `onFieldChange`, so any form call made inside `onFieldChange` applies on top of the change. Before, the outer write was applied last. A nested write to the same field now wins, and a nested `resetForm()` or `setValues()` now also resets or overwrites the field that just changed. To reset the other fields when one changes, call `setValues({ ...defaults, [field]: value })` inside `onFieldChange`.

The form's state now lives outside React, in a store React renders from with `useSyncExternalStore`. As a result:

- Calling a form method while rendering makes React log a warning. Call methods from event handlers and effects. To load new values when a prop changes, give the form's component a `key`, or pass them as `initialValues` and call `resetForm()` in an effect.
- Form updates made inside `startTransition` render right away instead of in the background.
- `resetForm` keeps the same identity across renders, so an effect can list it as a dependency.
