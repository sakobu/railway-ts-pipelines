---
'@railway-ts/use-form': patch
---

`useForm` and `isStandardSchema` now accept Standard Schemas that are functions, such as ArkType's. Before, passing an ArkType schema to `useForm` crashed with a `TypeError`.
