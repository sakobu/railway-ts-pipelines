# @railway-ts/use-form

Type-safe React form hook with Railway-oriented validation.

## Features

- Type inference from validation schemas
- Autocomplete for nested field paths
- Railway-oriented composable validators
- Native HTML element support
- Dual error sources (client and server)
- Array field helpers with type safety
- Four validation modes (live, blur, mount, submit)
- React 19 compatible
- Tree-shakeable ESM

## Installation

```bash
bun add @railway-ts/use-form @railway-ts/pipelines react
```

Requires React 18+ and @railway-ts/pipelines ^0.1.5

## Quick Example

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

const loginValidator = object({
  email: required(chain(string(), nonEmpty('Email is required'), email())),
  password: required(chain(string(), nonEmpty('Password is required'))),
});

type LoginForm = InferSchemaType<typeof loginValidator>;

function LoginForm() {
  const form = useForm<LoginForm>(loginValidator, {
    initialValues: { email: '', password: '' },
    onSubmit: async (values) => {
      console.log('Login:', values);
    },
  });

  return (
    <form onSubmit={form.handleSubmit}>
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

## Documentation

- [Getting Started](./GETTING_STARTED.md) - Installation, setup, core concepts
- [Recipes](./docs/RECIPES.md) - Common patterns and use cases
- [Advanced](./docs/ADVANCED.md) - Complex patterns, optimization, integration
- [API Reference](./docs/API.md) - Complete API documentation

## Core Concepts

### Type Inference

Derive TypeScript types from validation schemas:

```typescript
const userValidator = object({
  username: required(string()),
  email: required(email()),
  age: required(parseNumber()),
});

type UserForm = InferSchemaType<typeof userValidator>;
// { username: string; email: string; age: number; }
```

### Railway Validation

Composable validators that accumulate errors:

```typescript
const validator = object({
  email: required(chain(string(), nonEmpty('Required'), email())),
  password: required(chain(string(), minLength(8))),
});
```

### Validation Modes

- `live` - Validate on change and blur, mark touched on change
- `blur` - Validate on blur only
- `mount` - Validate once on mount, mark all fields touched
- `submit` - Validate only on submit

## Development

```bash
bun install
bun run build
bun test
bun run example
```

## License

MIT © Sarkis Melkonian
