# @railway-ts/pipelines

[![npm version](https://img.shields.io/npm/v/@railway-ts/pipelines.svg)](https://www.npmjs.com/package/@railway-ts/pipelines) [![Build Status](https://github.com/sakobu/railway-ts-pipelines/workflows/CI/badge.svg)](https://github.com/sakobu/railway-ts-pipelines/actions) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![Bundle Size](https://img.shields.io/bundlephobia/minzip/@railway-ts/pipelines)](https://bundlephobia.com/package/@railway-ts/pipelines) [![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/) [![Coverage](https://img.shields.io/codecov/c/github/sakobu/railway-ts-pipelines)](https://codecov.io/gh/sakobu/railway-ts-pipelines)

Railway-oriented programming for TypeScript. `Option<T>` for nullable values, `Result<T, E>` for operations that can fail, schema validators that parse untrusted data into typed values, and composition utilities for building pipelines.

```bash
bun add @railway-ts/pipelines
```

## Quick Example

```typescript
import { pipe } from '@railway-ts/pipelines/composition';
import { ok, match, andThen } from '@railway-ts/pipelines/result';
import { validate, object, required, chain, parseNumber, min } from '@railway-ts/pipelines/schema';

const schema = object({
  x: required(chain(parseNumber(), min(0))),
  y: required(chain(parseNumber(), min(1))),
});

async function compute(input: unknown) {
  const result = await pipe(validate(input, schema), (r) => andThen(r, ({ x, y }) => ok(x / y)));

  return match(result, {
    ok: (value) => ({ success: true, value }),
    err: (errors) => ({ success: false, errors }),
  });
}
```

## Core Types

### Option<T>

Handle nullable values explicitly.

```typescript
import { some, none, map, unwrapOr } from '@railway-ts/pipelines/option';

const value = some(42);
const empty = none<number>();

map(value, (x) => x * 2); // some(84)
map(empty, (x) => x * 2); // none()

unwrapOr(value, 0); // 42
unwrapOr(empty, 0); // 0
```

**Functions:** `some`, `none`, `isSome`, `isNone`, `map`, `flatMap`, `filter`, `unwrap`, `unwrapOr`, `unwrapOrElse`, `combine`, `match`, `tap`, `fromNullable`, `mapToResult`

### Result<T, E>

Explicit error handling without exceptions.

```typescript
import { ok, err, map, flatMap, match } from '@railway-ts/pipelines/result';

const divide = (a: number, b: number) => (b === 0 ? err('div by zero') : ok(a / b));

const result = pipe(divide(10, 2), (r) => map(r, (x) => x * 3)); // ok(15)

match(result, {
  ok: (value) => console.log(value),
  err: (error) => console.error(error),
});
```

**Functions:** `ok`, `err`, `isOk`, `isErr`, `map`, `mapErr`, `flatMap`, `filter`, `unwrap`, `unwrapOr`, `unwrapOrElse`, `combine`, `combineAll`, `match`, `tap`, `tapErr`, `fromTry`, `fromPromise`, `toPromise`, `andThen`, `mapToOption`

### Schema Validation

Parse untrusted data into typed values.

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

**Validators:** `string`, `number`, `boolean`, `date`, `parseNumber`, `parseInt`, `parseFloat`, `parseJSON`, `object`, `array`, `tuple`, `tupleOf`, `union`, `discriminatedUnion`, `required`, `optional`, `nullable`, `chain`, `min`, `max`, `minLength`, `maxLength`, `pattern`, `email`, `url`, `stringEnum`, `numberEnum`

### Composition

Build pipelines with `pipe` and `flow`.

```typescript
import { pipe, flow, curry } from '@railway-ts/pipelines/composition';

// Immediate execution
const result = pipe(
  5,
  (x) => x * 2,
  (x) => x + 1,
); // 11

// Build reusable pipeline
const process = flow(
  (x: number) => x * 2,
  (x) => x + 1,
);

process(5); // 11
```

**Functions:** `pipe`, `flow`, `curry`, `uncurry`, `tupled`, `untupled`

## Import Strategy

Use subpath imports for tree-shaking:

```typescript
import { some, none, map } from '@railway-ts/pipelines/option';
import { ok, err, flatMap } from '@railway-ts/pipelines/result';
import { pipe, flow } from '@railway-ts/pipelines/composition';
import { string, number, validate } from '@railway-ts/pipelines/schema';
```

Or import from root (functions get type suffixes):

```typescript
import { mapOption, mapResult, pipe, ok, validate } from '@railway-ts/pipelines';
```

## Documentation

- [Getting Started](GETTING_STARTED.md) - Installation and first pipeline
- [Recipes](docs/RECIPES.md) - Common patterns and techniques
- [Advanced](docs/ADVANCED.md) - Implementation details
- [Examples](examples/) - Working code examples

## Examples

```bash
git clone https://github.com/sakobu/railway-ts-pipelines.git
cd railway-ts-pipelines
bun install
bun run examples/index.ts
```

**Categories:**

- `examples/option/` - Safe nullable handling
- `examples/result/` - Error handling patterns
- `examples/schema/` - Validation examples
- `examples/composition/` - Function composition
- `examples/complete-pipelines/` - Real-world pipelines

## API Reference

Full docs in source files:

- Option: [`src/option/option.ts`](src/option/option.ts)
- Result: [`src/result/result.ts`](src/result/result.ts)
- Schema: [`src/schema/`](src/schema/)
- Composition: [`src/composition/`](src/composition/)

## License

MIT © Sarkis Melkonian
