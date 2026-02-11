# @railway-ts/pipelines

[![npm version](https://img.shields.io/npm/v/@railway-ts/pipelines.svg)](https://www.npmjs.com/package/@railway-ts/pipelines) [![Build Status](https://github.com/sakobu/railway-ts-pipelines/workflows/CI/badge.svg)](https://github.com/sakobu/railway-ts-pipelines/actions) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/) [![Coverage](https://img.shields.io/codecov/c/github/sakobu/railway-ts-pipelines)](https://codecov.io/gh/sakobu/railway-ts-pipelines)

Railway-oriented programming for TypeScript. Result and Option types that don't suck.

Small, focused API surface. Errors propagate automatically, you handle them once at the end.

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

async function compute(input: unknown) {
  const result = await pipeAsync(
    validate(input, schema),
    mapWith(({ x, y }) => x / y),
  );

  return match<number, ValidationError[], ValidationResult<number>>(result, {
    ok: (value) => ({ valid: true, data: value }),
    err: (errors) => ({ valid: false, errors: formatErrors(errors) }),
  });
}

await compute({ x: '10', y: '2' }).then(console.log); // { valid: true, data: 5 }
```

Validate at boundaries, chain operations, branch once at the end. Errors propagate automatically.

## Documentation

- **[Getting Started](docs/GETTING_STARTED.md)** — Guided walkthrough from first principles to full pipelines
- **[Recipes](docs/RECIPES.md)** — Point-free composition, error recovery, async pipelines, validation patterns
- **[Advanced](docs/ADVANCED.md)** — Symbol branding, type inference, implementation details
- **[Examples](examples/)** — Working code you can run

For a complete real-world pipeline, see the [Launch Decision Pipeline](docs/RECIPES.md#full-example-launch-decision-pipeline) -- validates input, fetches weather data, and makes a GO/NO-GO decision.

## What's Included

- **Result\<T, E\>** -- typed success/failure with map, flatMap, match, and recovery
- **Option\<T\>** -- nullable handling without null checks
- **Schema validation** -- parse unknown data, accumulate all errors, infer TypeScript types
- **Composition** -- `pipe`, `flow`, `pipeAsync`, `flowAsync`, `curry`
- **Async** -- sync-preserving overloads, parallel field validation, seamless sync/async mixing
- **Standard Schema v1** -- `toStandardSchema()` for tRPC, TanStack Form, React Hook Form, and other consumers

## API Reference

### Option

Handle nullable values without `if (x !== null)` everywhere.

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

| Category | Functions |
|----------|-----------|
| **Core** | `some`, `none`, `isSome`, `isNone` |
| **Transform** | `map`, `flatMap`, `bimap`, `filter`, `tap` |
| **Curried** | `mapWith`, `flatMapWith`, `filterWith`, `tapWith` |
| **Unwrap** | `unwrap`, `unwrapOr`, `unwrapOrElse` |
| **Combine** | `combine` |
| **Convert** | `fromNullable`, `mapToResult` |
| **Branch** | `match` |

### Result

Explicit error handling. No exceptions, no try-catch pyramids.

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

| Category | Functions |
|----------|-----------|
| **Core** | `ok`, `err`, `isOk`, `isErr` |
| **Transform** | `map`, `mapErr`, `flatMap`, `bimap`, `filter`, `tap`, `tapErr` |
| **Curried** | `mapWith`, `flatMapWith`, `mapErrWith`, `filterWith`, `tapWith`, `tapErrWith` |
| **Recovery** | `orElse`, `orElseWith` |
| **Unwrap** | `unwrap`, `unwrapOr`, `unwrapOrElse` |
| **Combine** | `combine`, `combineAll` |
| **Convert** | `fromTry`, `fromTryWithError`, `fromPromise`, `fromPromiseWithError`, `toPromise`, `mapToOption` |
| **Branch** | `match` |

### Schema

Parse untrusted data into typed values. Accumulates all validation errors.

> **Standard Schema v1 compliant** — use `toStandardSchema()` for interop with tRPC, TanStack Form, React Hook Form, and other Standard Schema consumers. See [Recipes → Standard Schema Interop](docs/RECIPES.md#standard-schema-interop).

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

| Category | Functions |
|----------|-----------|
| **Primitives** | `string`, `number`, `boolean`, `date`, `bigint` |
| **Parsers** | `parseNumber`, `parseString`, `parseBool`, `parseBigInt`, `parseDate`, `parseISODate`, `parseJSON`, `parseURL`, `parseEnum` |
| **Structures** | `object`, `array`, `tuple`, `tupleOf` |
| **Unions** | `union`, `discriminatedUnion`, `literal` |
| **Modifiers** | `required`, `optional`, `nullable`, `emptyAsOptional` |
| **String Constraints** | `minLength`, `maxLength`, `pattern`, `nonEmpty`, `email`, `phoneNumber` |
| **Number Constraints** | `min`, `max`, `integer`, `finite`, `between`, `positive`, `negative`, `nonZero`, `divisibleBy`, `precision` |
| **Date Constraints** | `dateRange`, `pastDate`, `futureDate`, `todayOrFuture` |
| **Enums** | `stringEnum`, `enumValue`, `oneOf` |
| **Boolean Constraints** | `matches` |
| **Array Constraints** | `minItems`, `maxItems`, `notEmpty`, `unique` |
| **Combinators** | `chain`, `transform`, `refine` |
| **Cross-field** | `refineAt`, `refineAtAsync` |
| **Async** | `chainAsync`, `refineAsync`, `refineAtAsync` |
| **Utilities** | `validate`, `validateAndFormatResult`, `formatErrors`, `toStandardSchema`, `ROOT_ERROR_KEY` |
| **Types** | `Validator`, `AsyncValidator`, `MaybeAsyncValidator`, `Schema`, `SyncSchema`, `InferSchemaType`, `ValidatorMapOutput`, `ValidationError`, `ValidationResult`, `StandardSchemaV1` |

### Composition

Build pipelines. No nested function calls.

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

| Category | Functions |
|----------|-----------|
| **Sync** | `pipe`, `flow`, `curry`, `uncurry`, `tupled`, `untupled` |
| **Async** | `pipeAsync`, `flowAsync` |
| **Types** | `MaybeAsync` |

## Examples

Clone and run:

```bash
git clone https://github.com/sakobu/railway-ts-pipelines.git
cd railway-ts-pipelines
bun install
bun run examples/index.ts
```

**What's in there:**

- `option/` - Nullable handling patterns, curried helpers
- `result/` - Error handling patterns, curried helpers, recovery
- `schema/` - Validation (basic, unions, tuples, async validation)
- `composition/` - Function composition (sync and async)
- `complete-pipelines/` - Full examples with validation + async + logic

Start with `examples/complete-pipelines/async-launch.ts` for a real-world pattern.

## Contributing

[CONTRIBUTING.md](CONTRIBUTING.md)

## License

MIT © Sarkis Melkonian
