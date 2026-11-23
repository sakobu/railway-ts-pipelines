---
'@railway-ts/pipelines': minor
---

`object()` now types optional fields as optional keys (`{ age?: number }`), the same shape `InferSchemaType` gives. Before, they were required keys typed `number | undefined`. Code annotated with the old shape may need updating.
