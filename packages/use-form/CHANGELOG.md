# @railway-ts/use-form

## 0.6.0

### Minor Changes

- ce8875d: Forms now follow new `initialValues`. **Behavior change:** before, a form kept the values it mounted with when `initialValues` changed. Now, when the form has no unsaved edits, it shows the new values in the same render, with no flash of the old ones. When it has edits, they stay, and the new `isStale` flag turns true if someone else changed the record, so you can hold Save and offer a Reload (`resetForm()`). An edit that undoes every unsaved edit makes the form show the latest version, as a form with no edits does. After a successful submit, the saved record passed back in is followed even if the server changed it, for example by trimming a value. That holds whether it arrives before or after `onSubmit` returns. The new `savedValues` option maps `onSubmit`'s `ok` value to the form values the save stored, so the form knows which version is the save's answer: an optimistic write of the submitted values isn't taken for it, and a change by someone else that arrives during the save shows as `isStale`. Without it, a saved record equal to the version before the save, as when the server trims the only edit away, leaves the typed values and the form dirty, and an optimistic write is taken for the answer. `isStale` reads false while `isSubmitting`, since a version that arrives then may be the save's own answer. A save doesn't overwrite a newer version that its caller hadn't seen: when one arrives while the save validates, or a running save hid `isStale`, `onSubmit` isn't called, and the submit error says the record changed. An `onSubmit` that fires and forgets (`mutation.mutate`) counts as saved when it returns: in an edit form, return the save's promise or a `Result`. A `handleSubmit` with no `onSubmit` only validates: nothing is saved, so the values stay edits, and a newer version raises `isStale` rather than replacing them. Save in `onSubmit`, so the form follows the saved record. The new `messages` option replaces the submit errors `useForm` writes itself, for other wording or a translation: `changedWhileSaving` for this one, and `submitFailed` for the existing "Something went wrong. Please try again." Values that equal the latest `initialValues` count as having no edits, except while `isSubmitting`, so the form follows the next version.

  `useFormAutoSubmission` pauses while `isStale` is true, so an auto-save can't overwrite someone else's newer change. Once `isStale` clears, it saves the edits made meanwhile. An edit made during a running auto-save still goes out as soon as that save settles, with the same timing as before, but no longer if the save ended with the form stale or invalid. Its form parameter accepts an optional `isStale`, and its `handleSubmit` may return anything.

  New `resetKey` option: pass the loaded record's id (`resetKey: data?.id`). When it changes, the form starts over as if remounted, without remounting the component. Results of a save or validation still running for the previous record don't land on the new one.

  `initialValues` must be built the same way on every render. A value that changes on its own, such as `crypto.randomUUID()`, `new Date()` or storage read during render, makes renders look like new versions. `useForm` now logs an error naming the cause when it notices one. A form that shows `isStale` after every edit is the other sign. Create generated values once, at module scope or with `useState(() => …)`. A `Set`, `Map` or Temporal value compares by identity, so build it with `useMemo`, keyed on the data it comes from, or use an array or plain object.

  `resetForm()` no longer lets an async validation still running for the discarded values write its errors onto the reset form.

  A validation that finishes at once now replaces one still running. Before, the older async result could land over it. For example, a field validator that checks a username on the server but rejects a short one at once showed the server's answer for the older, longer value. The same goes for a schema error over a field validator still running.

  This replaces the workarounds for loading new values: calling `setValues` during render, a `key` on the form's component, or `resetForm()` in an effect.

  Also in this release: `useFormAutoSubmission` logs a `handleSubmit` that throws or rejects with `console.error` and keeps auto-saving. It no longer submits values whose async validation is still running, which used to fail and mark every field touched. It saves values that differ from `initialValues`, so pass what was saved back in: the docs' examples now do. After a `resetKey` switch, the new record's auto-save waits for the previous record's running auto-save, then goes out. An edit auto-save hasn't sent when the record switches or the form unmounts is dropped, like the form's other unsaved edits, whether it was still in its delay, being validated, or waiting for a running save: before, one waiting for its validation could still be saved after unmount. `useDebounce` now ignores a call made after unmount. `useDebounce` now runs the callback from the latest render, even when its timer fires before that render's effects. A submission's own validation no longer lands after a follow or `resetForm()`. In `mount` mode, `resetForm()` now marks every field touched, as on mount, so the errors of the values it resets to show. The maps the form returns (`touched`, `errors`, `clientErrors`, `serverErrors`, `fieldErrors`, `validatingFields`) are now typed read-only: an empty one is a shared frozen object, so writing into it throws. Copy one before changing it. A failed save's error for a field the user changed during the save no longer lands on that field, so the change can still be auto-saved. A validator that throws during a validation the form starts on its own, on mount, after a reset or on a follow, is logged with `console.error('Form validation error:', …)` instead of breaking the render. An async schema or field validator that rejects is logged the same way, and no longer leaves `isValidating` stuck at true. `isValidating` now stays true until a submission's validation ends, even when a check started by typing ends first. A submission whose validation passes now clears the errors of an earlier attempt: before, in `submit` mode, an error the user had fixed still showed after a successful submit. A submission's validation errors no longer land over a check of values the user edited during it. `useFormAutoSubmission` logs a `validateForm` that throws or rejects with `console.error`, instead of breaking the render, and doesn't save the values it checked.

## 0.5.0

### Minor Changes

- c72a664: Form methods now see the calls made before them in the same handler. Before, they read the state from the last render, so:

  - `setFieldValue`, `setValues`, `resetForm` or an array helper followed by `handleSubmit` submitted the old values. If a submission of the old values was running, the edit was never submitted.
  - Two array helper calls in a row, such as two `push`es, kept only the last change.
  - Validation after a second call, or after `setFieldTouched`, could show an error for a value that had already changed.
  - A `setFieldValue` called from a child component's effect right after a re-render ran the previous render's `onFieldChange`.
  - In `'mount'` validation mode, a `resetForm` kept from an earlier render validated that render's `initialValues` instead of the values it reset to.
  - `isDirty` only updated on the next edit, so passing a saved record back in as `initialValues` left the form dirty. It now always compares the current values with the latest `initialValues`.

  **Breaking:** `setFieldValue` now stores the new value before calling `onFieldChange`, so any form call made inside `onFieldChange` applies on top of the change. Before, the outer write was applied last. A nested write to the same field now wins, and a nested `resetForm()` or `setValues()` now also resets or overwrites the field that just changed. To reset the other fields when one changes, call `setValues({ ...defaults, [field]: value })` inside `onFieldChange`.

  The form's state now lives outside React, in a store React renders from with `useSyncExternalStore`. As a result:

  - Calling a form method while rendering makes React log a warning. Call methods from event handlers and effects. To load new values when a prop changes, give the form's component a `key`, or pass them as `initialValues` and call `resetForm()` in an effect.
  - Form updates made inside `startTransition` render right away instead of in the background.
  - `resetForm` keeps the same identity across renders, so an effect can list it as a dependency.

## 0.4.1

### Patch Changes

- 07c3e36: Correct the bundle sizes quoted in the README, and the TypeScript badge (6.0+).

## 0.4.0

### Minor Changes

- 62f9376: Requires `@railway-ts/pipelines` 0.4.

## 0.3.0

### Minor Changes

- 39a1975: `useForm(schema, …)` now infers the form values from the schema alone (for pipelines schemas, exactly `InferSchemaType`, including optional fields), even when `initialValues` comes from a variable. Two cases need attention:

  - A validator whose output type is `never` or too loose now needs an explicit `useForm<T>`.
  - An explicit `useForm<T>` whose `T` writes optional fields as required `x: number | undefined` keys no longer matches a pipelines schema. Write `x?: number`, or use `S.InferSchemaType<typeof schema>`.

- 49eb211: `onSubmit` can return a `Result`, and `setServerErrors` takes `ValidationError[]`.

  - `onSubmit` returns nothing on every path, or a `Result` on every path. `handleSubmit` resolves with `onSubmit`'s `ok` value or its `err`, and the `err` lands on the fields.
  - **Breaking:** `setServerErrors` takes `ValidationError[]` (`{ path, message }`) instead of a record. Per-path errors land on their fields and mark those paths touched.
  - **Upgrading:** a server that still returns a `{ field: message }` record must be converted to `ValidationError[]` (`{ path: string[]; message: string }[]`) before it reaches `setServerErrors` or `onSubmit`'s `err`. `res.json()` is `any`, so TypeScript won't catch it.
  - **Breaking:** an `onSubmit` that returns a value that is neither `undefined` nor a `Result` now fails with the generic submit error, which is logged. Before, it resolved `ok(values)`. The typical trap is a prop typed `(v: T) => void` that the parent fills with `(v) => api.save(v)`, which returns a `Response` or `mutateAsync`'s data: it type-checks, then fails at runtime. Return nothing (`async (v) => { await save(v); }`) or return a `Result`.
  - A server error at path `[]`, or any failed submission, is the submit error: shown at `errors._root`, not counted by `isValid`, and cleared by any edit.
  - `handleSubmit` never rejects. A throw in a validator, a field validator or `onSubmit`, or a non-`Result` `onSubmit` value, returns the generic `_root` error ("Something went wrong. Please try again."), is logged, and resets `isSubmitting` and `isValidating`. Field errors placed during a submission, for example by `setServerErrors` in a mutation's `onError`, stay when it then fails.
  - **Breaking:** a thrown `onSubmit` used to be logged and resolve `ok(values)`, with nothing shown. It now resolves `err`, and the generic `_root` message appears.
  - **Breaking:** a throwing schema validator or field validator used to make `handleSubmit` reject. It now resolves `err`, so code relying on `.catch` goes quiet.
  - Edits also clear server errors on the groups that contain the edited field.
  - Overlapping submits: with unchanged values, a submit shares the running one, which fixes `onSubmit` running twice on a double-click during a slow request. With changed values, it runs afterwards, so auto-save no longer misses edits made during a save.
  - `File`s and `Blob`s, and objects whose state is hidden (`Map`, `Set`, `Temporal` values), now compare by identity. Before, any two of them compared equal. Replacing a file now marks the form dirty and triggers auto-submit. Date-library values like dayjs still compare by content.
  - `handleSubmit` takes a `SyntheticEvent` (was `FormEvent`, which `@types/react` 19.3 deprecates).
  - Types: `useForm<T>(…)` with only `T` given, plus an `onSubmit` that returns `Result<U, …>`, is a type error. Write `useForm(schema, …)` or `useForm<T, U>(…)`. With explicit `useForm<T, U>`, pass an `onSubmit` that returns a `Result`: one that returns nothing (for example a forgotten `return`) is a type error, and with no `onSubmit` the `ok` value is not checked (it is the form values, typed `U`).
  - **Breaking:** `UseFormReturn<V>`'s second type parameter now defaults to `unknown`, so a component typed `UseFormReturn<V>` accepts any form of shape `V`. A component that reads `handleSubmit`'s `ok` value as the values writes `UseFormReturn<V, V>`.

- 2c5dbc2: Requires React 19 (was 18 or 19), TypeScript 6.0 or later (was 5.0), Node.js 22.12 or later (was 18), and `@railway-ts/pipelines` 0.3.

## 0.2.1

### Patch Changes

- 71a4aec: `useForm` and `isStandardSchema` now accept Standard Schemas that are functions, such as ArkType's. Before, passing an ArkType schema to `useForm` crashed with a `TypeError`.

## 0.2.0

### Minor Changes

- 3587cac: Requires `@railway-ts/pipelines` 0.2: the peer range is now `^0.2.0`, and pipelines 0.1 is no longer supported. Upgrade pipelines first; its 0.2.0 changelog lists the breaking changes.

### Patch Changes

- ae052e8: TypeScript is now an optional peer dependency. npm, pnpm and Yarn no longer install TypeScript into JavaScript projects that use the package; in TypeScript projects the `>=5.0` requirement is still checked.

## 0.1.34

### Patch Changes

- 89e8f83: Accept `@railway-ts/pipelines` 0.2 (the peer range is now `^0.1.27 || ^0.2.0`). Built with tsdown instead of tsup; the declarations file is now `dist/index.d.mts`. Repository links now point to the `railway-ts` monorepo.
