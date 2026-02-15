# @railway-ts/use-form

[![npm version](https://img.shields.io/npm/v/@railway-ts/use-form.svg)](https://www.npmjs.com/package/@railway-ts/use-form) [![Build Status](https://github.com/sakobu/railway-ts-use-form/workflows/CI/badge.svg)](https://github.com/sakobu/railway-ts-use-form/actions) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/) [![Coverage](https://img.shields.io/codecov/c/github/sakobu/railway-ts-use-form)](https://codecov.io/gh/sakobu/railway-ts-use-form)

Schema-first React forms with full TypeScript safety, composable validation, and native HTML bindings.

**~3.6 kB** minified + brotli

## Why?

Most React form solutions split validation from types from bindings. You define a schema in one place, extract types in another, wire up resolvers in a third, and manually plumb errors into your UI. Every layer is a seam where things drift.

This library treats the **schema as the single source of truth**. One declaration gives you:

- TypeScript types (inferred, never duplicated)
- Validation (composable, accumulates all errors in one pass)
- Field bindings (spread onto native HTML elements)
- Error handling (three layers with deterministic priority)

Bring your own Zod, Valibot, or ArkType via [Standard Schema](https://github.com/standard-schema/standard-schema), or use [@railway-ts/pipelines](https://github.com/sakobu/railway-ts-pipelines) natively for cross-field validation, targeted error placement, and `Result` types.

## Design

- **Schema-driven** -- define once, get types + validation + field paths
- **Three error layers** -- client, field async, server -- with deterministic priority
- **Native HTML bindings** -- spread onto inputs, selects, checkboxes, files, radios
- **Railway Result** -- `handleSubmit` returns `Result<T, E>` for pattern matching

## Install

```bash
bun add @railway-ts/use-form @railway-ts/pipelines  # or npm, pnpm, yarn
```

Requires React 18+ and @railway-ts/pipelines ^0.1.18.

## Quick Start

```tsx
import { useForm } from '@railway-ts/use-form';
import {
  object,
  string,
  required,
  chain,
  nonEmpty,
  email,
  type InferSchemaType,
} from '@railway-ts/pipelines/schema';

const loginSchema = object({
  email: required(chain(string(), nonEmpty('Email is required'), email())),
  password: required(chain(string(), nonEmpty('Password is required'))),
});

type LoginForm = InferSchemaType<typeof loginSchema>;

export function LoginForm() {
  const form = useForm<LoginForm>(loginSchema, {
    initialValues: { email: '', password: '' },
    onSubmit: async (values) => {
      console.log('Login:', values);
    },
  });

  return (
    <form onSubmit={(e) => void form.handleSubmit(e)}>
      <input type="email" {...form.getFieldProps('email')} />
      {form.touched.email && form.errors.email && (
        <span>{form.errors.email}</span>
      )}

      <input type="password" {...form.getFieldProps('password')} />
      {form.touched.password && form.errors.password && (
        <span>{form.errors.password}</span>
      )}

      <button type="submit" disabled={form.isSubmitting}>
        {form.isSubmitting ? 'Logging in...' : 'Log In'}
      </button>
    </form>
  );
}
```

## Real-World Use Case

Registration form with cross-field validation (`refineAt` for password confirmation), per-field async validation (`fieldValidators` for username availability), and server errors -- all in one component:

```tsx
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from '@railway-ts/use-form';
import {
  object,
  string,
  required,
  chain,
  refineAt,
  nonEmpty,
  email,
  minLength,
  ROOT_ERROR_KEY,
  type InferSchemaType,
} from '@railway-ts/pipelines/schema';

// --- Schema ---

const schema = chain(
  object({
    username: required(chain(string(), nonEmpty(), minLength(3))),
    email: required(chain(string(), nonEmpty(), email())),
    password: required(chain(string(), nonEmpty(), minLength(8))),
    confirmPassword: required(chain(string(), nonEmpty())),
  }),
  refineAt(
    'confirmPassword',
    (d) => d.password === d.confirmPassword,
    'Passwords must match'
  )
);

type Registration = InferSchemaType<typeof schema>;

// --- API layer ---

const checkUsername = (username: string): Promise<{ available: boolean }> =>
  fetch(`/api/check-username?u=${encodeURIComponent(username)}`).then((res) =>
    res.ok ? res.json() : Promise.reject(`HTTP ${res.status}`)
  );

class ApiValidationError extends Error {
  constructor(public fieldErrors: Record<string, string>) {
    super('Validation failed');
  }
}

const registerUser = async (values: Registration): Promise<void> => {
  const res = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  });

  if (!res.ok) throw new ApiValidationError(await res.json());
};

// --- Component ---

export function RegistrationForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: registerUser,
    onSuccess: () => navigate('/welcome'),
    onError: (error) => {
      if (error instanceof ApiValidationError) {
        form.setServerErrors(error.fieldErrors);
      } else {
        form.setServerErrors({
          [ROOT_ERROR_KEY]: 'Network error. Please try again.',
        });
      }
    },
  });

  const form = useForm<Registration>(schema, {
    initialValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
    fieldValidators: {
      username: async (value) => {
        if (value.length < 3) return undefined;

        try {
          const { available } = await queryClient.fetchQuery({
            queryKey: ['check-username', value],
            queryFn: () => checkUsername(value),
            staleTime: 30_000,
          });
          return available ? undefined : 'Username is already taken';
        } catch {
          return 'Unable to check username availability';
        }
      },
    },
    onSubmit: (values) => mutation.mutate(values),
  });

  return (
    <form onSubmit={(e) => void form.handleSubmit(e)}>
      <input {...form.getFieldProps('username')} />
      {form.validatingFields.username && <span>Checking...</span>}
      {form.touched.username && form.errors.username && (
        <span>{form.errors.username}</span>
      )}

      <input type="email" {...form.getFieldProps('email')} />
      {form.touched.email && form.errors.email && (
        <span>{form.errors.email}</span>
      )}

      <input type="password" {...form.getFieldProps('password')} />
      {form.touched.password && form.errors.password && (
        <span>{form.errors.password}</span>
      )}

      <input type="password" {...form.getFieldProps('confirmPassword')} />
      {form.touched.confirmPassword && form.errors.confirmPassword && (
        <span>{form.errors.confirmPassword}</span>
      )}

      {form.errors[ROOT_ERROR_KEY] && (
        <span>{form.errors[ROOT_ERROR_KEY]}</span>
      )}

      <button type="submit" disabled={mutation.isPending || form.isValidating}>
        {mutation.isPending ? 'Registering...' : 'Create Account'}
      </button>
    </form>
  );
}
```

Cross-field validation, async username check, server errors, and React Query integration -- production patterns, zero glue code.

## What's Included

- **Type-safe field paths** -- autocomplete for nested fields, dot-notation everywhere
- **Railway validation** -- composable validators that accumulate all errors in one pass
- **Standard Schema v1** -- bring your own Zod, Valibot, or ArkType schema
- **Native HTML bindings** -- spread `getFieldProps` onto inputs, selects, checkboxes, files, radios, sliders
- **Three error layers** -- client, per-field async, and server errors with automatic priority
- **Array helpers** -- type-safe `push`, `remove`, `swap`, `move`, `insert`, `replace` with field bindings
- **Four validation modes** -- `live`, `blur`, `mount`, `submit`
- **Auto-submission** -- `useFormAutoSubmission` for search/filter forms with debounced submit
- **React 18 + 19** -- compatible with both, tree-shakeable ESM

## Works With

Any [Standard Schema v1](https://github.com/standard-schema/standard-schema) library works out of the box -- no adapters, no wrappers. Pass the schema directly to `useForm`:

- **Zod** 3.23+ (v4 also supported)
- **Valibot** v1+
- **ArkType** 2.0+
- **@railway-ts/pipelines** (native)

See [Recipes: Standard Schema](./docs/RECIPES.md#standard-schema-bring-your-own-validator) for Zod and Valibot examples.

## Ecosystem

`@railway-ts/use-form` is built on [@railway-ts/pipelines](https://github.com/sakobu/railway-ts-pipelines) -- composable, type-safe validation with Railway-oriented Result types. Use pipelines standalone for backend validation, or pair it with this hook for full-stack type safety.

## Documentation

- **[Getting Started](docs/GETTING_STARTED.md)** -- Step-by-step from first form to arrays
- **[Recipes](./docs/RECIPES.md)** -- Patterns and techniques, each recipe self-contained
- **[API Reference](./docs/API.md)** -- Complete API documentation

## Examples

Clone and run:

```bash
git clone https://github.com/sakobu/railway-ts-use-form.git
cd railway-ts-use-form
bun install
bun run example
```

Then open http://localhost:3000. The interactive app has tabs for:

- **Sync** -- Basic form with schema validation
- **Async (Cross-field)** -- Async schema with cross-field rules (password confirmation, date ranges)
- **Zod** -- Standard Schema integration with Zod
- **Valibot** -- Standard Schema integration with Valibot
- **Field Validators** -- Per-field async validation with loading indicators

Or try it live on [StackBlitz](https://stackblitz.com/edit/vitejs-vite-c3zpmon9?embed=1&file=src%2FApp.tsx).

## Philosophy

- Schema is the single source of truth
- Validation should accumulate, not short-circuit
- Types should be inferred, never duplicated
- Form state should be explicit and predictable
- Native HTML first, adapters never

## Contributing

[CONTRIBUTING.md](CONTRIBUTING.md)

## License

MIT © Sarkis Melkonian
