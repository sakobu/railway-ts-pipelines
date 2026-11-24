---
'@railway-ts/use-form': patch
---

`setValues` stores a `File`, `Blob`, `Map`, `Set` or class instance as given. Before, when the field already held an object, the new value was merged into it as a plain object: picking a second file stored `{}` instead of the `File`, and a dayjs value lost its methods. A plain object in `setValues` still merges into the object there, as `setFieldValue` on each of its keys would. `setValues`'s type now takes a `Map` or `Set` whole, as it already did for a `Date` or `File`.

An array no longer equals an object with the same keys, such as `['x']` and `{ 0: 'x' }`, for `isDirty`, following new `initialValues`, auto-save and repeated submits. Before, a change between them could read as no change and skip a save.

Marking every field touched on submit no longer adds entries inside a `File` (`avatar.name`, `avatar.type`) in test DOMs such as happy-dom, whose `File` has fields of its own.
