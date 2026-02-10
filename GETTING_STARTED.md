# Getting Started

## Installation

```bash
bun add @railway-ts/pipelines  # or npm, pnpm, yarn
```

Requires TypeScript 5.0+ and Node.js 18+.

## Import Strategy

Use subpath imports for tree-shaking:

```typescript
import { some, none, map } from '@railway-ts/pipelines/option';
import { ok, err, flatMap } from '@railway-ts/pipelines/result';
import { pipe, flow } from '@railway-ts/pipelines/composition';
import { validate, object, required } from '@railway-ts/pipelines/schema';
```

## Core Concept: Result

A `Result<T, E>` is either `Ok` holding a value or `Err` holding an error. Use it instead of try-catch.

```typescript
import { pipe } from '@railway-ts/pipelines/composition';
import { ok, err, isOk, isErr, mapWith, flatMapWith, match } from '@railway-ts/pipelines/result';

// Create Results
const good = ok(42); // Result<number, never>
const bad = err('oops'); // Result<never, string>

// Type narrowing with guards
if (isOk(good)) {
  console.log(good.value); // TypeScript knows .value exists
}
if (isErr(bad)) {
  console.log(bad.error); // TypeScript knows .error exists
}
```

Build a pipeline with `map` and `flatMap`:

```typescript
const divide = (a: number, b: number) => (b === 0 ? err('division by zero') : ok(a / b));

const result = pipe(
  divide(10, 2),
  mapWith((x) => x * 3), // Ok(5) -> Ok(15)
  flatMapWith((x) => divide(x, 3)), // Ok(15) -> Ok(5)
);

match(result, {
  ok: (value) => console.log(value), // 5
  err: (error) => console.error(error),
});
```

**Key insight:** Once a step returns `Err`, all subsequent `map`/`flatMap` calls are skipped. Write happy-path code; handle errors once at the end with `match`.

## Core Concept: Option

An `Option<T>` is either `Some` holding a value or `None`. Use it instead of `null`/`undefined` checks.

```typescript
import { pipe } from '@railway-ts/pipelines/composition';
import {
  some,
  none,
  fromNullable,
  isSome,
  isNone,
  mapWith,
  flatMapWith,
  filterWith,
  match,
} from '@railway-ts/pipelines/option';

// Create Options
const present = some('Alice'); // Option<string>
const absent = none<string>(); // Option<string>
const maybe = fromNullable(users.get(id)); // Option<User>

// Type narrowing
if (isSome(present)) {
  console.log(present.value); // TypeScript knows .value exists
}
```

Transform and branch:

```typescript
type Users = Map<string, { name: string; role: string }>;
const users: Users = new Map([['1', { name: 'Alice', role: 'admin' }]]);

const getUpperName = (id: string) =>
  pipe(
    fromNullable(users.get(id)),
    filterWith((u) => u.role === 'admin'),
    mapWith((u) => u.name.toUpperCase()),
  );

match(getUpperName('1'), {
  some: (name) => console.log(name), // "ALICE"
  none: () => console.log('Not found'),
});

match(getUpperName('999'), {
  some: (name) => console.log(name),
  none: () => console.log('Not found'), // "Not found"
});
```

**Same pattern as Result:** `map`/`flatMap` skip on `None`, you branch once with `match`.

## Converting Legacy Code

Wrap existing code that throws, rejects, or returns `null` into `Result`/`Option` values.

### Wrapping Try-Catch

```typescript
import { fromTry, fromTryWithError } from '@railway-ts/pipelines/result';

// fromTry: error becomes a string message
const config = fromTry(() => JSON.parse(rawText));
// Result<any, string>

// fromTryWithError: error stays as an Error object (preserves stack trace)
const config2 = fromTryWithError(() => JSON.parse(rawText));
// Result<any, Error>
```

### Wrapping Promises

```typescript
import { fromPromise, fromPromiseWithError } from '@railway-ts/pipelines/result';

// fromPromise: rejection becomes a string
const user = await fromPromise(fetch('/api/user').then((r) => r.json()));
// Result<User, string>

// fromPromiseWithError: transform the rejection into a typed error
const user2 = await fromPromiseWithError(
  fetch('/api/user').then((r) => r.json()),
  (err) => ({ code: 'FETCH_FAILED', cause: err }),
);
// Result<User, { code: string; cause: unknown }>
```

### Wrapping Nullable Returns

```typescript
import { fromNullable } from '@railway-ts/pipelines/option';

const findUser = (id: string): User | null => {
  /* ... */
};

const user = fromNullable(findUser('123'));
// Option<User>
```

## Core Concept: Composition

Build pipelines by chaining functions instead of nesting them.

```typescript
import { pipe, flow, pipeAsync, flowAsync } from '@railway-ts/pipelines/composition';

// pipe: execute immediately, left to right
const result = pipe(
  5,
  (x) => x * 2,
  (x) => x + 1,
);
// 11

// flow: create a reusable pipeline
const double = flow(
  (x: number) => x * 2,
  (x) => x + 1,
);
double(5); // 11

// pipeAsync: like pipe, but awaits each step
const data = await pipeAsync(
  userId,
  fetchUser, // async
  validateUser, // sync or async
  enrichProfile, // async
);

// flowAsync: reusable async pipeline
const processOrder = flowAsync(validateOrder, chargePayment, createShipment);
await processOrder(orderInput);
```

`pipeAsync`/`flowAsync` accept any mix of sync and async functions. Each step's return value is awaited before passing to the next.

## Core Concept: Schema Validation

Validators are functions that take untrusted input and return `Result<T, ValidationError[]>`. Compose them to build schemas.

### Primitives and Chains

```typescript
import { string, parseNumber, min, max, chain } from '@railway-ts/pipelines/schema';

// Single validator
const str = string(); // Validator<unknown, string>

// Chain validators: each feeds into the next
const positiveInt = chain(parseNumber(), min(0));
// Validator<unknown, number> -- parses string to number, then checks >= 0
```

### Object Schemas

```typescript
import { object, required, optional, type InferSchemaType } from '@railway-ts/pipelines/schema';

const userSchema = object({
  name: required(string()),
  age: required(chain(parseNumber(), min(18), max(120))),
  email: optional(string()),
});

type User = InferSchemaType<typeof userSchema>;
// { name: string; age: number; email?: string }
```

### Running Validation

```typescript
import { validate, validateAndFormatResult, formatErrors } from '@railway-ts/pipelines/schema';
import { match } from '@railway-ts/pipelines/result';

// validate: returns Result<T, ValidationError[]>
const result = validate(input, userSchema);

match(result, {
  ok: (user) => console.log(user),
  err: (errors) => console.error(errors),
  // errors: [{ path: ['age'], message: 'Must be at least 18' }, ...]
});

// validateAndFormatResult: validates and returns a simple { valid, data?, errors? } object
const output = validateAndFormatResult(input, userSchema);
// { valid: true, data: User } or { valid: false, errors: { age: 'Must be at least 18' } }
```

`formatErrors` converts `ValidationError[]` into a flat `Record<string, string>` keyed by dot-path -- useful for wiring to form UIs.

## Your First Pipeline

Now that you know the pieces, here's how they combine. Validate input, transform it, handle errors:

```typescript
import { pipeAsync } from '@railway-ts/pipelines/composition';
import { ok, match, flatMapWith } from '@railway-ts/pipelines/result';
import {
  validate,
  object,
  required,
  chain,
  parseNumber,
  min,
  formatErrors,
  type ValidationError,
  type ValidationResult,
} from '@railway-ts/pipelines/schema';

const schema = object({
  x: required(chain(parseNumber(), min(0))),
  y: required(chain(parseNumber(), min(1))),
});

async function compute(input: unknown): Promise<ValidationResult<number>> {
  const result = await pipeAsync(
    validate(input, schema),
    flatMapWith(({ x, y }) => ok(x / y)),
  );

  return match<number, ValidationError[], ValidationResult<number>>(result, {
    ok: (value) => ({ valid: true, data: value }),
    err: (errors) => ({ valid: false, errors: formatErrors(errors) }),
  });
}

await compute({ x: '10', y: '2' }).then(console.log);
// { valid: true, data: 5 }

await compute({ x: '-5', y: '0' }).then(console.log);
// { valid: false, errors: { x: 'Must be at least 0', y: 'Must be at least 1' } }
```

**The pattern:** validate at boundaries with schema, chain with `pipeAsync` + `flatMapWith`, branch once at the end with `match`.

## Running Examples

```bash
git clone https://github.com/sakobu/railway-ts-pipelines.git
cd railway-ts-pipelines
bun install

# Run all examples
bun run examples/index.ts

# Or run specific examples
bun run examples/complete-pipelines/async-launch.ts
```

**Start with:** `examples/complete-pipelines/async-launch.ts` -- shows the full pattern.

**Example categories:**

- `option/` - Handling nullable values
- `result/` - Error handling patterns
- `schema/` - Validation (basic, union, tuple)
- `composition/` - Function composition patterns
- `complete-pipelines/` - Full pipelines with validation + async + logic

## Next Steps

-> **[Recipes](docs/RECIPES.md)** - Patterns: point-free composition, error recovery, async pipelines, testing
-> **[Advanced](docs/ADVANCED.md)** - Symbol branding, type inference, implementation details
-> **[API Reference](README.md)** - Full function catalog

## Questions

- Bugs: [GitHub Issues](https://github.com/sakobu/railway-ts-pipelines/issues)
- Features: [GitHub Issues](https://github.com/sakobu/railway-ts-pipelines/issues)
- Questions: [GitHub Discussions](https://github.com/sakobu/railway-ts-pipelines/discussions)
