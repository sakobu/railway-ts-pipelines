---
'@railway-ts/pipelines': minor
---

`object()` now types optional fields as optional keys (`{ age?: number }`), the same shape `InferSchemaType` gives. Before, they were required keys typed `number | undefined`. Code annotated with the old shape may need updating. This includes `refineAt<…>` type arguments that write `age: number | undefined` (write `age?: number`, or use `InferSchemaType`), and generic helpers that return `object(schema)` as `Validator<unknown, T>` (let TypeScript infer the return type).
