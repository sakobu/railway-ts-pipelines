---
'@railway-ts/use-form': minor
---

Auto-save is now a `useForm` option, and it saves a dirty form as soon as nothing blocks it (#54).

**Breaking:** `useFormAutoSubmission` is removed. Replace `useFormAutoSubmission(form, 500)` with `autoSave: { delay: 500 }` in `useForm`'s options (`autoSave: true` waits 200 ms). A form-like object that isn't a `useForm` form is no longer supported.

- A form that turns valid without an edit is saved, for example after a field validator is switched off or `clearServerErrors()` clears the error that blocked it.
- Values that went out aren't sent again until they change, whatever the server answered. To retry, call `clearServerErrors()` then `handleSubmit()`.
- In `live` mode auto-save reuses the form's own checks, so an edit runs the schema once less. In the other modes it checks the schema once the delay ends instead of on every edit.
- Edits made while `isStale` go out as soon as it clears, without another delay.
- A Save click that is running holds auto-save instead of queueing it. Once the Save settles, auto-save sends any newer edits.
- After a `resetKey` switch, the new record's auto-save waits for every submission the previous record still runs, Save clicks included, not only its auto-save.
- `autoSave` can be switched at runtime. Switching it off drops an edit waiting out its delay.
