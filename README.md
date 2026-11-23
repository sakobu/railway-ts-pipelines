# railway-ts

[![CI](https://github.com/sakobu/railway-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/sakobu/railway-ts/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Typed errors, schemas, pipelines and React forms for TypeScript. One error model from the request to the form, in under 11 kB minified and brotli-compressed, with no runtime.

## Why

A typical TypeScript app stitches this together from separate libraries: Zod or Valibot for schemas, neverthrow or try/catch for errors, React Hook Form and a resolver for forms. Each has its own error shape, and much of the code that translates between them is yours to write and keep in sync.

railway-ts covers the same ground with one model. `validate()` returns a `Result`, your async steps chain on that `Result`, and the form's `onSubmit` and `handleSubmit` return one too. Errors are values, not exceptions, from the schema all the way to the form.

## One schema, end to end

Define the schemas once, in a module both sides import. The server validates requests with `signupSchema`, the form is driven by it, and the client reads the server's answer with `createdUser`.

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

// Non-strict, so the server can add fields without breaking older clients
export const createdUser = S.object({ id: S.required(S.string()) }, { strict: false });

export type CreatedUser = S.InferSchemaType<typeof createdUser>;
```

```ts
// server.ts
import { pipeAsync } from '@railway-ts/pipelines/composition';
import { flatMapWith, fromPromiseWithError, type Result } from '@railway-ts/pipelines/result';
import { validate, type ValidationError } from '@railway-ts/pipelines/schema';

import { createdUser, signupSchema, type CreatedUser, type Signup } from './signupSchema';

// Your data layer. A taken email returns err([{ path: ['email'], message: 'Email already registered' }]).
declare function createUser(input: Signup): Promise<Result<CreatedUser, ValidationError[]>>;

const notJson = (): ValidationError[] => [{ path: [], message: 'Request body must be JSON' }];

export async function handleSignup(request: Request): Promise<Response> {
  const result = await pipeAsync(
    fromPromiseWithError(request.json(), notJson),
    flatMapWith((body) => validate(body, signupSchema)),
    flatMapWith(createUser),
    flatMapWith((user) => validate(user, createdUser)), // send only the fields createdUser lists
  );

  // A Result is its own wire format: { ok, value } or { ok, error }
  return Response.json(result, { status: result.ok ? 201 : 422 });
}
```

```tsx
// SignupForm.tsx
import { decodeResult, ROOT_ERROR_KEY } from '@railway-ts/pipelines/schema';
import { useForm } from '@railway-ts/use-form';

import { createdUser, signupSchema } from './signupSchema';

export function SignupForm() {
  const form = useForm(signupSchema, {
    initialValues: { email: '', password: '', confirmPassword: '' },
    onSubmit: async (values) => {
      const res = await fetch('/api/signup', { method: 'POST', body: JSON.stringify(values) });
      return decodeResult(await res.json(), createdUser);
    },
  });

  return (
    <form noValidate onSubmit={(e) => void form.handleSubmit(e)}>
      <input type="email" {...form.getFieldProps('email')} />
      {form.getFieldError('email')}
      <input type="password" {...form.getFieldProps('password')} />
      {form.getFieldError('password')}
      <input type="password" {...form.getFieldProps('confirmPassword')} />
      {form.getFieldError('confirmPassword')}
      {form.errors[ROOT_ERROR_KEY]}
      <button type="submit">Sign up</button>
    </form>
  );
}
```

A taken email ends up under the same field as a malformed one. `createUser` returns it as a `ValidationError` on `email`, the server sends the `Result` as JSON, and `decodeResult` turns it back into a typed `Result` without a cast. `useForm` puts each error under its field, and `handleSubmit` resolves to the same `Result`: `ok` with the new user, or `err` with the errors, whether the schema caught them in the browser or the server sent them.

`createdUser` works on both sides. The server runs its answer through it, so only the fields it lists leave the server, even if `createUser` returns a whole database row. The client checks the reply against it, and because it's non-strict, a field the server adds later doesn't break older clients.

Failures along the way are values too. On the server, a request body that isn't JSON comes back as an error. On the client, a response that isn't a `Result` becomes one error that the form shows at `ROOT_ERROR_KEY`. If the request itself fails, or the response body isn't JSON, `handleSubmit` still doesn't reject: the form shows a generic error in the same place.

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

`@railway-ts/pipelines` also works on its own, on the server or anywhere else. Both packages are ESM-only and need TypeScript 6.0+ and Node.js 22.12+. use-form also needs React 19 and `@railway-ts/pipelines` 0.4.

## Works with what you have

Both packages support [Standard Schema](https://standardschema.dev), so choosing railway-ts doesn't lock you in either direction:

- **Out:** wrap a pipelines schema with `toStandardSchema(signupSchema)` and hand it to tRPC, TanStack Form, React Hook Form or any other Standard Schema consumer.
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
