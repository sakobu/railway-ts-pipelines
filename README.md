# railway-ts

[![CI](https://github.com/sakobu/railway-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/sakobu/railway-ts/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Typed errors, schemas, pipelines and React forms for TypeScript. One error model from the request to the form, in under 10 kB minified and brotli-compressed, with no runtime.

## Why

A typical TypeScript app stitches this together from separate libraries: Zod or Valibot for schemas, neverthrow or try/catch for errors, React Hook Form and a resolver for forms. Each has its own error shape, and much of the code that translates between them is yours to write and keep in sync.

railway-ts covers the same ground with one model. `validate()` returns a `Result`, your async steps chain on that `Result`, and the form's `handleSubmit` returns one too. Errors are values, not exceptions, from the schema all the way to the form.

## One schema, end to end

Define the schema once. The server validates requests with it, and the form is driven by it.

```ts
// signupSchema.ts
import * as S from '@railway-ts/pipelines/schema';

export const signupSchema = S.chain(
  S.object({
    email: S.required(S.chain(S.string(), S.email())),
    password: S.required(S.chain(S.string(), S.minLength(8))),
    confirmPassword: S.required(S.string()),
  }),
  S.refineAt('confirmPassword', (d) => d.password === d.confirmPassword, 'Passwords must match'),
);

export type Signup = S.InferSchemaType<typeof signupSchema>;
```

```ts
// server.ts
import { pipeAsync } from '@railway-ts/pipelines/composition';
import { flatMapWith, fromPromiseWithError, match, type Result } from '@railway-ts/pipelines/result';
import * as S from '@railway-ts/pipelines/schema';

import { signupSchema, type Signup } from './signupSchema';

// Your data layer. A taken email returns err([{ path: ['email'], message: 'Email already registered' }]).
declare function createUser(input: Signup): Promise<Result<{ id: string }, S.ValidationError[]>>;

const notJson = (): S.ValidationError[] => [{ path: [], message: 'Request body must be JSON' }];

export async function handleSignup(request: Request): Promise<Response> {
  const result = await pipeAsync(
    fromPromiseWithError(request.json(), notJson),
    flatMapWith((body) => S.validate(body, signupSchema)),
    flatMapWith(createUser),
  );

  return match(result, {
    ok: (user) => Response.json(user, { status: 201 }),
    err: (errors) => Response.json(S.formatErrors(errors), { status: 422 }),
  });
}
```

```tsx
// SignupForm.tsx
import { useForm } from '@railway-ts/use-form';

import { signupSchema, type Signup } from './signupSchema';

export function SignupForm() {
  const form = useForm<Signup>(signupSchema, {
    initialValues: { email: '', password: '', confirmPassword: '' },
    onSubmit: async (values) => {
      const res = await fetch('/api/signup', { method: 'POST', body: JSON.stringify(values) });
      if (res.status === 422) form.setServerErrors((await res.json()) as Record<string, string>);
    },
  });

  return (
    <form onSubmit={(e) => void form.handleSubmit(e)}>
      <input type="email" {...form.getFieldProps('email')} />
      {form.getFieldError('email')}
      <input type="password" {...form.getFieldProps('password')} />
      {form.getFieldError('password')}
      <input type="password" {...form.getFieldProps('confirmPassword')} />
      {form.getFieldError('confirmPassword')}
      <button type="submit">Sign up</button>
    </form>
  );
}
```

A taken email ends up under the same field as a malformed one. `createUser` returns it as a `ValidationError` on `email`, `formatErrors` turns that into `{ email: 'Email already registered' }`, and `setServerErrors` shows it under the email field, with no glue code in between. (`handleSubmit`'s own `Result` covers the client-side check; the server's answer arrives through `setServerErrors`.) Even a request body that isn't JSON comes back as an error value, not an exception.

## What's in the box

Two packages, five pieces. Each piece is its own import, so you only ship what you use.

- **Result**: success or failure as a value, with `map`, `flatMap`, `match`, `combine` and friends. [API](packages/pipelines/docs/API.md#result)
- **Option**: values that may be missing, without null checks. [API](packages/pipelines/docs/API.md#option)
- **Composition**: `pipe` and `flow`, plus async versions that await each step. [API](packages/pipelines/docs/API.md#composition)
- **Schema**: parse unknown input into typed values, collecting every error in one pass. [API](packages/pipelines/docs/API.md#schema)
- **use-form**: a React form hook driven by the schema, with typed field paths, native input bindings, async field checks and server errors. [API](packages/use-form/docs/API.md)

```bash
bun add @railway-ts/pipelines @railway-ts/use-form  # or npm, pnpm, yarn
```

`@railway-ts/pipelines` also works on its own, on the server or anywhere else. Both packages are ESM-only. use-form needs React 18 or later and `@railway-ts/pipelines` 0.2.

## Works with what you have

Both packages support [Standard Schema](https://standardschema.dev), so choosing railway-ts doesn't lock you in either direction:

- **Out:** wrap a pipelines schema with `S.toStandardSchema(signupSchema)` and hand it to tRPC, TanStack Form, React Hook Form or any other Standard Schema consumer.
- **In:** pass a Zod, Valibot or ArkType schema straight to `useForm`. Its errors come back through the same `Result` from `handleSubmit`.

## How it compares

|                                 | railway-ts   | Zod + neverthrow + React Hook Form | Effect         |
| ------------------------------- | ------------ | ---------------------------------- | -------------- |
| Typed errors as values          | ✓            | ✓ (neverthrow)                     | ✓              |
| Option type                     | ✓            | —                                  | ✓              |
| `pipe` / `flow`, sync and async | ✓            | method chaining                    | ✓              |
| Schema validation               | ✓            | ✓ (Zod)                            | ✓ (Schema)     |
| React form hook                 | ✓ (use-form) | ✓ (needs a resolver)               | not included   |
| One error type, schema to form  | ✓            | separate per library               | no form layer  |
| Standard Schema                 | in and out   | Zod out, RHF in                    | Schema out     |
| Runtime required                | none         | none                               | Effect runtime |

Zod and React Hook Form both work alongside railway-ts through Standard Schema, so it doesn't have to be all or nothing (see [Works with what you have](#works-with-what-you-have)). Effect is a full effect system and covers far more than this table. railway-ts stays small on purpose: plain functions over plain values.

## Packages

| Package                                        | Description                                                                    | npm                                                                                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| [`@railway-ts/pipelines`](packages/pipelines/) | `Result`/`Option` pipelines, composition and schema validation. ESM only.      | [![npm](https://img.shields.io/npm/v/@railway-ts/pipelines.svg)](https://www.npmjs.com/package/@railway-ts/pipelines) |
| [`@railway-ts/use-form`](packages/use-form/)   | React form hook driven by a pipelines schema or any Standard Schema. ESM only. | [![npm](https://img.shields.io/npm/v/@railway-ts/use-form.svg)](https://www.npmjs.com/package/@railway-ts/use-form)   |

Each package has its own Getting Started guide, recipes and API reference under `docs/`.

## Contributing

Bug reports and pull requests are welcome. [CONTRIBUTING.md](CONTRIBUTING.md) covers setup, the checks CI runs and how releases work.

## License

MIT © Sarkis Melkonian
