# @railway-ts/use-form

[![npm version](https://img.shields.io/npm/v/@railway-ts/use-form.svg)](https://www.npmjs.com/package/@railway-ts/use-form) [![Build Status](https://github.com/sakobu/railway-ts-use-form/workflows/CI/badge.svg)](https://github.com/sakobu/railway-ts-use-form/actions) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![Bundle Size](https://img.shields.io/bundlephobia/minzip/@railway-ts/use-form)](https://bundlephobia.com/package/@railway-ts/use-form) [![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/) [![Coverage](https://img.shields.io/codecov/c/github/sakobu/railway-ts-use-form)](https://codecov.io/gh/sakobu/railway-ts-use-form)

React form hook where the schema is the source of truth. Define validation once, get TypeScript types, field autocomplete, error handling, and native HTML bindings for free.

> **Part of the [@railway-ts](https://github.com/sakobu) ecosystem.** Uses [@railway-ts/pipelines](https://github.com/sakobu/railway-ts-pipelines) for composable validation and Result types. Also accepts any [Standard Schema v1](https://github.com/standard-schema/standard-schema) validator (Zod, Valibot, ArkType).

## Install

```bash
bun add @railway-ts/use-form @railway-ts/pipelines  # or npm, pnpm, yarn
```

Requires React 18+ and @railway-ts/pipelines ^0.1.10.

## Quick Start

```tsx
import { useForm } from '@railway-ts/use-form';
import {
  object, string, required, chain,
  nonEmpty, email, type InferSchemaType,
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

      <button type="submit" disabled={form.isSubmitting || !form.isValid}>
        {form.isSubmitting ? 'Logging in...' : 'Log In'}
      </button>
    </form>
  );
}
```

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

## What's Included

- **Type-safe field paths** -- autocomplete for nested fields, dot-notation everywhere
- **Railway validation** -- composable validators that accumulate all errors in one pass
- **Standard Schema v1** -- bring your own Zod, Valibot, or ArkType schema instead
- **Native HTML bindings** -- spread `getFieldProps` onto inputs, selects, checkboxes, files, radios, sliders
- **Three error layers** -- client validation, per-field async validators, and server errors with automatic priority
- **Array helpers** -- type-safe `push`, `remove`, `swap`, `move`, `insert`, `replace` with field bindings
- **Four validation modes** -- `live`, `blur`, `mount`, `submit` for different UX needs
- **Auto-submission** -- `useFormAutoSubmission` for search/filter forms with debounced submit
- **React 18 + 19** -- compatible with both, tree-shakeable ESM

## API at a Glance

The `useForm` hook returns:

| Category | Properties / Methods |
|---|---|
| **State** | `values`, `touched`, `errors`, `clientErrors`, `serverErrors`, `fieldErrors`, `isValid`, `isDirty`, `isSubmitting`, `isValidating`, `validatingFields`, `submitCount` |
| **Field Management** | `setFieldValue(field, value, shouldValidate?)`, `setFieldTouched(field, touched?, shouldValidate?)`, `setValues(values, shouldValidate?)` |
| **Server Errors** | `setServerErrors(errors)`, `clearServerErrors()` |
| **Form Actions** | `handleSubmit(e?)` → `Promise<Result>`, `resetForm()`, `validateForm(values)` |
| **Field Bindings** | `getFieldProps`, `getSelectFieldProps`, `getCheckboxProps`, `getSwitchProps`, `getSliderProps`, `getFileFieldProps`, `getCheckboxGroupOptionProps`, `getRadioGroupOptionProps` |
| **Arrays** | `arrayHelpers(field)` → `{ values, push, remove, insert, swap, move, replace, getFieldProps, ... }` |

## Works With

Any [Standard Schema v1](https://github.com/standard-schema/standard-schema) library works out of the box -- no adapters, no wrappers. Pass the schema directly to `useForm`:

- **Zod** 3.23+ (v4 also supported)
- **Valibot** v1+
- **ArkType** 2.0+
- **@railway-ts/pipelines** (native)

See [Recipes: Standard Schema](./docs/RECIPES.md#standard-schema--bring-your-own-validator) for Zod and Valibot examples.

## Documentation

- **[Getting Started](docs/GETTING_STARTED.md)** -- Step-by-step from first form to arrays
- **[Recipes](./docs/RECIPES.md)** -- Patterns and techniques, each recipe self-contained
- **[Advanced](./docs/ADVANCED.md)** -- Error priority, discriminated unions, custom validators
- **[API Reference](./docs/API.md)** -- Complete API documentation

For a real-world example combining schema validation, async field validators, server errors, cross-field validation, and Result pattern-matching, see the [Full Registration Form](./docs/RECIPES.md#capstone-full-registration-form) recipe.

## Contributing

[CONTRIBUTING.md](CONTRIBUTING.md)

## License

MIT © Sarkis Melkonian
