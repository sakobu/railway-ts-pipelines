---
'@railway-ts/use-form': minor
---

A field validator lists the fields it reads with the new `withDeps`, and its error lasts only while they hold the values it checked (#58). Validation asked for inside `onFieldChange` runs once, after the outermost call returns (#57).

**Breaking:** a function in `fieldValidators` gets only its value, and the `values` argument is gone. A validator that read other fields lists them with `withDeps(deps, validate)`, where `validate(value, depValues)` gets only the listed fields, or the rule moves into the schema with `refineAt`.

- New: `fieldValidators: { slug: withDeps(['workspaceId'], (slug, { workspaceId }) => …) }`. Each listed value comes in typed, and reading a field the validator didn't list is a type error. Write `withDeps` inside the `fieldValidators` entry, where it takes the form's types. Editing a listed field re-checks the validator in `live` mode, blurring one does in `blur` mode, and the next submit does in every mode.
- A field-validator error goes as soon as an edit changes its field or a listed field, in every mode, and `isValid` follows. A Save button disabled while `!isValid`, and auto-save, no longer get stuck on an error for values the form no longer holds.
- `setValues` that validates (by default in `live` mode, or with `shouldValidate: true` in any mode) runs the field validators of the values it changed, and hides the schema errors at those paths while an async schema check runs.
- A validator's own field matches by overlap: editing `address.city` re-checks a validator on `address`, and setting `address` re-checks one on `address.city`.
- A schema error at, inside or above the validator's field or a listed field skips it, so no request goes out with an input the schema rejects. **Breaking** for a validator on an object field: it no longer runs while a schema error sits inside that object.
- A field check of values the form no longer holds ends with no error, such as a submit's check of a field edited while the submit's schema check ran. `handleSubmit`'s `err` still includes it.
- A submit whose schema or field checks fail on values that changed while they ran (an edit, a follow of new `initialValues` or `resetForm()`) now says so: the form doesn't show those errors, so the submit error reads "The values changed while they were checked, so nothing was saved. Review them and save again.", and `err` holds it at path `[]` after the errors. The new `messages.changedWhileChecking` replaces the text. Not while auto-save is on, since it saves the changed values on its own.
- A follow of new `initialValues` changes the values as an edit does. In `live` mode it re-runs each field validator whose field or listed field it changed, even one that passed, so a refetch can send lookups: a check like "username taken" that should accept the record's own value lists the record's id with `withDeps`. In every mode, a check the follow cut short runs again while its values hold. A follow that only server errors preceded now re-validates too, as one that other errors preceded does. **Breaking:** a follow no longer re-runs a validator only because it showed an error. One whose values the follow left as they were keeps its error, and outside `live` mode one whose values it changed loses its error and waits for the next blur or submit.
- `shouldValidate: true` on an edit that makes the form follow new `initialValues` now checks the edit's fields too, along with the follow's own checks.
- Validation asked for inside `onFieldChange` runs once, after the outermost call returns. A cascade no longer runs a validator twice, and the schema runs once per call.
- A sync throw from a check asked for inside `onFieldChange` reaches the outermost call. A sync throw from the schema in `resetForm()` (in `mount` mode), or from the schema or a field validator in a follow an edit caused, reaches the caller instead of being logged.

Fixes #58, Fixes #57
