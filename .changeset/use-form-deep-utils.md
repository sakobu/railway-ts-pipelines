---
'@railway-ts/use-form': minor
---

`setValues` stores a `File`, `Blob`, `Map`, `Set`, typed array or class instance as given. Before, when the field already held an object, the new value was merged into it as a plain object: picking a second file stored `{}` instead of the `File`, and a dayjs value lost its methods. A plain object in `setValues` still merges into the object there, as `setFieldValue` on each of its keys would, including a plain object from another realm, such as an iframe or a test runner reading JSON from Node's own `fetch`. A `__proto__` key in the data, as `JSON.parse` can produce, is skipped instead of replacing the prototype of the form's values.

**Breaking:** a class instance passed to `setValues` replaces the value before it. Before, one that held only some fields, such as a model from a PATCH response, merged into it. Spread it into a plain object to merge it: `setValues({ address: { ...patch } })`.

**Breaking:** `setValues`'s type takes arrays, readonly ones and tuples too, and any value with methods, such as a `Date`, `File`, `Map`, `Set`, `URL`, Temporal or dayjs value, whole. Before, a partial of a `Map`, `Set`, `URL`, Temporal or dayjs value compiled, such as `{}`, as did partial items for a readonly array, and at runtime it replaced the value or lost its methods.

An array no longer equals an object with the same keys, such as `['x']` and `{ 0: 'x' }`, for `isDirty`, following new `initialValues`, auto-save and repeated submits. Before, a change between them could read as no change and skip a save. Also in these comparisons:

- A `Map` or `Set` subclass with fields of its own compares by identity, as a `Map` or `Set` does. Before, it compared by those fields alone, so different entries read as equal.
- A typed array compares by identity. Before, it was compared one byte at a time.
- Two invalid Dates are equal. Before, an `initialValues` holding an invalid Date counted as a new version on every render.
- A value that contains itself, such as a tree node with a `parent`, no longer overflows the stack when compared or when submit marks every field touched.

Marking every field touched on submit no longer adds an entry for every byte of a typed array, or entries inside a `File` (`avatar.name`, `avatar.type`) in test DOMs such as happy-dom, whose `File` has fields of its own.
