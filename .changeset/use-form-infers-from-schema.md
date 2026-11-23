---
'@railway-ts/use-form': minor
---

`useForm(schema, …)` now infers the form values from the schema alone, exactly as `InferSchemaType`, including optional fields, and even when `initialValues` comes from a variable. Two cases need attention:

- A validator whose output type is `never` or too loose now needs an explicit `useForm<T>`.
- An explicit `useForm<T>` whose `T` writes optional fields as required `x: number | undefined` keys no longer matches a pipelines schema. Write `x?: number`, or use `S.InferSchemaType<typeof schema>`.
