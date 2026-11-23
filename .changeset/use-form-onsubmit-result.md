---
'@railway-ts/use-form': minor
---

`onSubmit` can return a `Result`, and `setServerErrors` takes `ValidationError[]`.

- `onSubmit` returns nothing on every path, or a `Result` on every path. `handleSubmit` resolves with `onSubmit`'s `ok` value or its `err`, and the `err` lands on the fields.
- **Breaking:** `setServerErrors` takes `ValidationError[]` (`{ path, message }`) instead of a record. Per-path errors land on their fields and mark those paths touched.
- **Breaking:** an `onSubmit` that returns a value that is neither `undefined` nor a `Result` now fails with the generic submit error, which is logged. Before, it resolved `ok(values)`. The typical trap is a prop typed `(v: T) => void` that the parent fills with `(v) => api.save(v)`, which returns a `Response` or `mutateAsync`'s data: it type-checks, then fails at runtime. Return nothing (`async (v) => { await save(v); }`) or return a `Result`.
- A server error at path `[]`, or any failed submission, is the submit error: shown at `errors._root`, not counted by `isValid`, and cleared by any edit.
- `handleSubmit` never rejects. A throw in a validator, a field validator or `onSubmit`, or a non-`Result` `onSubmit` value, returns the generic `_root` error ("Something went wrong. Please try again."), is logged, and resets `isSubmitting` and `isValidating`.
- Edits also clear server errors on the groups that contain the edited field.
- Overlapping submits: with unchanged values, a submit shares the running one, which fixes `onSubmit` running twice on a double-click during a slow request. With changed values, it runs afterwards, so auto-save no longer misses edits made during a save.
- `File`s and `Blob`s, and objects whose state is hidden (`Map`, `Set`, `Temporal` values), now compare by identity. Before, any two of them compared equal. Replacing a file now marks the form dirty and triggers auto-submit. Date-library values like dayjs still compare by content.
- `handleSubmit` takes a `SyntheticEvent` (was `FormEvent`, which `@types/react` 19.3 deprecates).
- Types: `useForm<T>(…)` with only `T` given, plus an `onSubmit` that returns `Result<U, …>`, is a type error. Write `useForm(schema, …)` or `useForm<T, U>(…)`. With explicit `useForm<T, U>`, pass an `onSubmit` that returns a `Result`: one that returns nothing (for example a forgotten `return`) is a type error, and with no `onSubmit` the `ok` value is not checked (it is the form values, typed `U`).
- Types: a child component typed `UseFormReturn<V>` doesn't accept a form whose `onSubmit` returns `Result<U, …>`. Type it `UseFormReturn<V, unknown>`.
