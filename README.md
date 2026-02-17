# @railway-ts/pipelines

[![npm version](https://img.shields.io/npm/v/@railway-ts/pipelines.svg)](https://www.npmjs.com/package/@railway-ts/pipelines) [![Build Status](https://github.com/sakobu/railway-ts-pipelines/workflows/CI/badge.svg)](https://github.com/sakobu/railway-ts-pipelines/actions) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/) [![Coverage](https://img.shields.io/codecov/c/github/sakobu/railway-ts-pipelines)](https://codecov.io/gh/sakobu/railway-ts-pipelines)

Railway-oriented programming for TypeScript. Typed `Result<T, E>` pipelines with first-class validation and optional `Option<T>` support -- small, modular, and fully tree-shakable.

## Why?

Most TypeScript projects end up combining:

- A validation library (Zod, Valibot, Yup)
- A Result library (neverthrow, fp-ts, custom)
- Manual async error wiring

This library unifies those around a single `Result<T, E>` model so validation, async operations, and business logic compose without adapters.

No runtime. No global context. No required framework. Import only what you need.

## Design

The library is layered and modular:

- **Result** -- explicit success/failure, no exceptions
- **Option** -- nullable handling without null checks
- **Schema** -- parse unknown input into typed values
- **Composition** -- build sync and async pipelines

Each layer works independently. Combine them when it makes sense.

Fully tree-shakable:

- `result` -- 582 B
- `option` -- 402 B
- `composition` -- 233 B
- `schema` -- ~3 kB

**~4.2 kB total** (minified + brotli)

## Install

```bash
bun add @railway-ts/pipelines  # or npm, pnpm, yarn
```

Requires TypeScript 5.0+ and Node.js 18+.

## Quick Start

Validate untrusted input, transform it, handle the result -- in one pipeline:

```typescript
import { pipeAsync } from '@railway-ts/pipelines/composition';
import { mapWith, match } from '@railway-ts/pipelines/result';
import { validate, object, required, chain, parseNumber, min, formatErrors } from '@railway-ts/pipelines/schema';

const schema = object({
  x: required(chain(parseNumber(), min(0))),
  y: required(chain(parseNumber(), min(1))),
});

async function compute(input: unknown) {
  const result = await pipeAsync(
    validate(input, schema),
    mapWith(({ x, y }) => x / y),
  );

  return match(result, {
    ok: (value) => ({ valid: true as const, data: value }),
    err: (errors) => ({ valid: false as const, errors: formatErrors(errors) }),
  });
}

await compute({ x: '10', y: '2' }).then(console.log); // { valid: true, data: 5 }
```

Validate at boundaries, chain operations, branch once at the end. Errors propagate automatically.

## Real-World Use Case

Cross-field validation + async operations:

```typescript
import { object, required, chain, string, minLength, refineAt, validate } from '@railway-ts/pipelines/schema';
import { pipeAsync } from '@railway-ts/pipelines/composition';
import { flatMapWith, tapWith } from '@railway-ts/pipelines/result';

const signupSchema = chain(
  object({
    password: required(chain(string(), minLength(8))),
    confirmPassword: required(string()),
  }),
  refineAt('confirmPassword', (d) => d.password === d.confirmPassword, 'Passwords must match'),
);

const result = await pipeAsync(
  validate(input, signupSchema),
  flatMapWith(createUser),
  tapWith((user) => sendWelcomeEmail(user.email)),
);
```

- Accumulates validation errors
- Supports cross-field constraints
- Mixes sync + async steps seamlessly
- Branch once at the end

## Core Modules

### Result

Typed success/failure without exceptions.

```typescript
import { pipe } from '@railway-ts/pipelines/composition';
import { ok, err, mapWith, match } from '@railway-ts/pipelines/result';

const divide = (a: number, b: number) => (b === 0 ? err('div by zero') : ok(a / b));

const result = pipe(
  divide(10, 2),
  mapWith((x) => x * 3),
);

match(result, {
  ok: (value) => console.log(value),
  err: (error) => console.error(error),
}); // Output: 15
```

`ok` · `err` · `isOk` · `isErr` · `map` · `flatMap` · `mapErr` · `bimap` · `filter` · `tap` · `tapErr` · `orElse` · `combine` · `combineAll` · `fromPromise` · `fromTry` · `match` · `unwrapOr` -- [full API](docs/API.md#result)

### Option

Nullable handling without `if (x !== null)` everywhere.

```typescript
import { pipe } from '@railway-ts/pipelines/composition';
import { some, mapWith, match } from '@railway-ts/pipelines/option';

const user = some({ name: 'Alice', age: 25 });
const name = pipe(
  user,
  mapWith((u) => u.name),
);

match(name, {
  some: (n) => console.log(n),
  none: () => console.log('No user'),
}); // Output: Alice
```

`some` · `none` · `isSome` · `isNone` · `map` · `flatMap` · `bimap` · `filter` · `tap` · `combine` · `fromNullable` · `mapToResult` · `match` · `unwrapOr` -- [full API](docs/API.md#option)

Use independently, or convert to Result when needed.

### Schema

Parse unknown data into typed values. Accumulates all validation errors.

> **Standard Schema v1 compliant** -- use `toStandardSchema()` for interop with tRPC, TanStack Form, React Hook Form, and other Standard Schema consumers. See [Recipes -> Standard Schema Interop](docs/RECIPES.md#standard-schema-interop).

```typescript
import {
  validate,
  object,
  required,
  optional,
  chain,
  string,
  parseNumber,
  min,
  max,
  type InferSchemaType,
} from '@railway-ts/pipelines/schema';

const userSchema = object({
  name: required(string()),
  age: required(chain(parseNumber(), min(18), max(120))),
  email: optional(string()),
});

type User = InferSchemaType<typeof userSchema>;
// { name: string; age: number; email?: string }

const result = validate(input, userSchema);
// Result<User, ValidationError[]>
```

`object` · `array` · `tuple` · `required` · `optional` · `chain` · `string` · `parseNumber` · `email` · `min` · `max` · `union` · `discriminatedUnion` · `refine` · `refineAt` · `transform` · `validate` · `toStandardSchema` -- [full API](docs/API.md#schema)

### Composition

Build readable pipelines. No nested function calls.

```typescript
import { pipe, flow, pipeAsync, flowAsync } from '@railway-ts/pipelines/composition';

// Immediate execution
const result = pipe(
  5,
  (x) => x * 2,
  (x) => x + 1,
); // 11

// Reusable pipeline
const process = flow(
  (x: number) => x * 2,
  (x) => x + 1,
);
process(5); // 11

// Async pipeline (awaits each step)
const data = await pipeAsync(userId, fetchUser, validateUser, enrichProfile);

// Reusable async pipeline
const processOrder = flowAsync(validateOrder, chargePayment, createShipment);
await processOrder(orderInput);
```

`pipe` · `flow` · `pipeAsync` · `flowAsync` · `curry` · `uncurry` · `tupled` · `untupled` -- [full API](docs/API.md#composition)

Sync and async composition share the same mental model.

## Ecosystem

- **[@railway-ts/use-form](https://github.com/sakobu/railway-ts-use-form)** -- Type-safe React form hook built directly on the Schema layer. Define a schema once -- use it for validation, type inference, and form state.

## Documentation

- **[Getting Started](docs/GETTING_STARTED.md)** -- Learn the concepts, one at a time
- **[Recipes](docs/RECIPES.md)** -- Patterns for real work: async pipelines, error recovery, validation, Standard Schema
- **[API Reference](docs/API.md)** -- Every function signature and description
- **[Examples](examples/)** -- Working code you can run

For a complete real-world pipeline, see the [Launch Decision Pipeline](docs/RECIPES.md#full-example-launch-decision-pipeline) -- validates input, fetches weather data, and makes a GO/NO-GO decision.

## Philosophy

- Explicit over implicit
- No exceptions for control flow
- No required runtime
- No hidden global state
- Import only what you use

Small pieces. Composable layers. One error model.

## Contributing

[CONTRIBUTING.md](CONTRIBUTING.md)

## License

MIT © Sarkis Melkonian
