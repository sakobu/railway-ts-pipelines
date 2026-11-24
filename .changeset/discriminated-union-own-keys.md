---
'@railway-ts/pipelines': patch
---

**Security:** `discriminatedUnion()` no longer lets crafted input skip validation. It looked the discriminant up in the validator map without checking for an own key, so a value naming an `Object.prototype` member ran that built-in as the validator. `'constructor'` returned the input itself, so an input shaped like an `ok` Result, such as `{ type: 'constructor', ok: true, value: … }`, passed unvalidated. `'toString'`, `'valueOf'` or `'__proto__'` returned a non-Result or threw. The lookup now uses only the map's own keys, and any other value fails with the fallback message. Upgrade if you validate untrusted input with `discriminatedUnion()`.
