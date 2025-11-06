# @railway-ts/pipelines

[![npm version](https://img.shields.io/npm/v/@railway-ts/pipelines.svg)](https://www.npmjs.com/package/@railway-ts/pipelines) [![Build Status](https://github.com/sakobu/railway-ts-pipelines/workflows/CI/badge.svg)](https://github.com/sakobu/railway-ts-pipelines/actions) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![Bundle Size](https://img.shields.io/bundlephobia/minzip/@railway-ts/pipelines)](https://bundlephobia.com/package/@railway-ts/pipelines) [![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/) [![Coverage](https://img.shields.io/codecov/c/github/sakobu/railway-ts-pipelines)](https://codecov.io/gh/sakobu/railway-ts-pipelines)

**Make failure boring. Make data flow.**

A type-safe toolkit for TypeScript implementing railway-oriented programming. Build robust data pipelines with zero classes, zero exceptions, and zero `any`. Model uncertainty with `Option` and `Result`, validate once at boundaries, and let errors flow naturally through your code.

---

## Table of Contents

### Getting Started

- [The Problem: Error Handling is Messy](#the-problem-error-handling-is-messy)
- [The Solution: Railway-Oriented Programming](#the-solution-railway-oriented-programming)
- [Installation](#installation)
- [Running the Examples](#running-the-examples)

### Core Concepts

- [The Building Blocks](#the-building-blocks)
  - [Option: Handle Absence as Data](#option-handle-absence-as-data)
  - [Result: Railway-Oriented Error Handling](#result-railway-oriented-error-handling)
  - [Schema: Parse, Don't Validate](#schema-parse-dont-validate)
  - [Composition: Build Complex Pipelines](#composition-build-complex-pipelines)

### Practical Guides

- [Import Strategy](#import-strategy)
- [Quick Reference](#quick-reference)

### Decision Guides

- [Is This Right For You?](#is-this-right-for-you)

### Reference

- [Next Steps](#next-steps)
- [Further Reading](#further-reading)

---

## The Problem: Error Handling is Messy

Most TypeScript codebases struggle with error handling. Sound familiar?

```typescript
// Traditional approach: nested try/catch, type assertions, repeated checks
function processOrder(raw: unknown) {
  try {
    if (!raw || typeof raw !== 'object') throw new Error('Invalid input');
    const amount = (raw as any).amount;
    if (typeof amount !== 'number' || amount <= 0) throw new Error('Invalid amount');
    const result = await chargeCard(amount);
    if (!result.success) throw new Error(result.error);
    return { success: true, data: result };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
```

**Problems:**

- Exception-based control flow escapes your types
- Type assertions (`as any`) break type safety
- Repeated validation adds ceremony
- Nested conditionals obscure the happy path

**What if there was a better way?**

```typescript
// Railway-oriented: validate once, compose pure functions, branch at edges
const orderSchema = object({
  amount: required(chain(number(), min(0.01))),
});

const processOrder = flow(
  (input: unknown) => validate(input, orderSchema),
  (r) => andThen(r, ({ amount }) => chargeCard(amount)),
);
// Errors automatically stay on the error track. No nested conditionals.
```

---

## The Solution: Railway-Oriented Programming

**Railway-oriented programming** treats your code like a railway track with two parallel rails:

```
Input --> validate --> transform --> compute --> Output
            |                                     |
            | (validation error)                  |
            +-------> Error Track ----------------+
                      (auto-propagates)
```

### How It Works

1. **Valid data** stays on the success track
2. **Errors** automatically switch to the error track
3. **No manual checking** - transformations skip when already on error track
4. **Branch once** at the very end with pattern matching

### Core Philosophy

This library brings this pattern to TypeScript with three principles:

1. **Errors and Absence are Values** - Not exceptions. Use `Result<T, E>` for operations that can fail, `Option<T>` for optional values
2. **Parse, Don't Validate** - Don't just check data; transform it into guaranteed-valid types
3. **Compose Everything** - Build complex workflows by piping simple functions

### The Pipeline Mental Model

```
unknown input -> validate -> Result<T, E> -> transform -> compute -> Result<U, E>
                 |                           |            |
             boundary                    type-safe   stays on rails
```

- **Boundary**: Untrusted data enters as `unknown`
- **Validate**: Convert to `Result<T, E>` using schema validators
- **Type-Safe Core**: Transform validated data with pure functions
- **Stay On Rails**: Errors propagate automatically through `map`/`flatMap`
- **Branch Once**: Use `match()` at the edges to handle both paths

---

## Installation

```bash
bun add @railway-ts/pipelines
# or npm install @railway-ts/pipelines
```

**New to the library?** Check out the **[Getting Started Guide](GETTING_STARTED.md)** for a step-by-step tutorial with complete examples.

---

## Running the Examples

The library includes 12+ runnable examples covering Option, Result, Schema validation, Composition patterns, and complete real-world pipelines.

```bash
# Clone and explore
git clone https://github.com/sakobu/railway-ts-pipelines.git
cd railway-ts-pipelines
bun install

# Run all examples
bun run examples/index.ts

# Or run specific categories
bun run examples/complete-pipelines/async-launch.ts  # Rocket launch decision system
```

**See the full guide**: **[Running the Examples ->](GETTING_STARTED.md#running-the-examples)** with all commands and what each demonstrates.

---

## The Building Blocks

### Option: Handle Absence as Data

Replace `null`, `undefined`, and nullable types with explicit `Option<T>`.

#### Core Type

```typescript
type Option<T> = { readonly some: true; readonly value: T } | { readonly some: false };
```

#### When to Use

Use `Option` when **absence is expected and normal**: finding items in collections, optional configuration, nullable database fields. Don't use it when you need to carry error information (use `Result` instead).

#### Basic Usage

```typescript
import { some, none, fromNullable, map, unwrapOr, match } from '@railway-ts/pipelines/option';

// Create Options
const hasValue = some(42);
const noValue = none<number>();

// Convert from nullable
const user: { email?: string } = getUser();
const email = pipe(
  fromNullable(user.email),
  (opt) => map(opt, (e) => e.toLowerCase()),
  (opt) => unwrapOr(opt, 'no-email@example.com'),
);

// Pattern matching
match(fromNullable(user.email), {
  some: (email) => sendWelcome(email),
  none: () => console.log('No email provided'),
});
```

#### API Overview

| Category      | Functions                                                                 |
| ------------- | ------------------------------------------------------------------------- |
| **Create**    | `some(value)`, `none()`                                                   |
| **Check**     | `isSome(option)`, `isNone(option)`                                        |
| **Transform** | `map(option, fn)`, `flatMap(option, fn)`, `filter(option, pred)`          |
| **Extract**   | `unwrap(option)`, `unwrapOr(option, default)`, `unwrapOrElse(option, fn)` |
| **Combine**   | `combine(options)` - tuple-preserving, returns `none` if any is `none`    |
| **Convert**   | `fromNullable(value)`, `mapToResult(option, error)`                       |
| **Match**     | `match(option, { some, none })`                                           |

**See full documentation**: [`src/option/option.ts`](src/option/option.ts) (21 functions)
**See examples**: [`examples/option/option-examples.ts`](examples/option/option-examples.ts)

---

### Result: Railway-Oriented Error Handling

Model success and failure explicitly. Compose operations without exceptions.

#### Core Type

```typescript
type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };
```

#### When to Use

Use `Result` when **operations can fail and you need error context**: parsing data, I/O operations, business logic validations. You need to explain _why_ something failed, not just that it did.

#### Basic Usage

```typescript
import { ok, err, map, flatMap, match, fromTry } from '@railway-ts/pipelines/result';
import { pipe } from '@railway-ts/pipelines/composition';

// Operations that can fail return Result
const safeDivide = (a: number, b: number): Result<number, string> => (b === 0 ? err('Division by zero') : ok(a / b));

// Chain operations on the happy path
const process = (input: string) =>
  pipe(
    fromTry(() => JSON.parse(input)),
    (r) => flatMap(r, (data) => safeDivide(data.value, 2)),
    (r) => map(r, Math.round),
  );

// Branch once at the end
match(process('{"value":42}'), {
  ok: (n) => console.log('Result', n),
  err: (e) => console.error('Failed', e),
});
```

#### API Overview

| Category         | Functions                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| **Create**       | `ok(value)`, `err(error)`                                                                         |
| **Check**        | `isOk(result)`, `isErr(result)`                                                                   |
| **Transform**    | `map(result, fn)`, `mapErr(result, fn)`, `flatMap(result, fn)`                                    |
| **Extract**      | `unwrap(result)`, `unwrapOr(result, default)`, `unwrapOrElse(result, fn)`                         |
| **Side Effects** | `tap(result, fn)`, `tapErr(result, fn)`                                                           |
| **Combine**      | `combine(results)` - short-circuits on first error<br>`combineAll(results)` - collects all errors |
| **Async**        | `fromPromise(promise)`, `toPromise(result)`, `andThen(result, asyncFn)`                           |
| **Convert**      | `fromTry(fn)`, `mapToOption(result)`                                                              |
| **Match**        | `match(result, { ok, err })`                                                                      |

**Critical for async pipelines**: Use `andThen(result, asyncFn)` to chain async operations while keeping them on the railway.

**See full documentation**: [`src/result/result.ts`](src/result/result.ts) (27 functions)
**See examples**: [`examples/result/result-examples.ts`](examples/result/result-examples.ts)

---

### Schema: Parse, Don't Validate

Transform untrusted data into guaranteed-valid types. Validate once at boundaries, then work with confidence.

#### Philosophy: Validation as Transformation

Traditional validation checks data but leaves it as `unknown` or `any`. Railway-ts validators **parse and transform**:

```typescript
// BAD: Traditional validation without transformation
function process(input: any) {
  if (!input.age || typeof input.age !== 'number') throw new Error();
  if (input.age < 18) throw new Error();
  return doSomething(input.age); // input is still 'any'
}

// GOOD: Railway-ts parse into guaranteed-valid types
const ageValidator = chain(parseNumber(), min(18));
// Validator<unknown, number> - transforms unknown -> number

const result = validate(input.age, ageValidator);
// result: Result<number, ValidationError[]>
// If ok, TypeScript knows it's a number >= 18
```

#### Core Types

```typescript
type Validator<Input, Output = Input> = (value: Input, path?: string[]) => Result<Output, ValidationError[]>;

type ValidationError = {
  path: string[]; // e.g., ['user', 'address', 'zipCode']
  message: string;
};

// Extract output type from validator
type InferSchemaType<V> = V extends Validator<unknown, infer O> ? ProcessType<O> : never;
```

#### Basic Validators

```typescript
import {
  validate,
  string,
  number,
  boolean,
  date,
  object,
  required,
  optional,
  nullable,
  chain,
  type InferSchemaType,
} from '@railway-ts/pipelines/schema';

// Primitive validators
const name = string(); // unknown -> Result<string, Error[]>
const age = number(); // unknown -> Result<number, Error[]>
const active = boolean(); // unknown -> Result<boolean, Error[]>

// Object schema
const userSchema = object({
  name: required(string()), // must exist
  email: optional(string()), // may be undefined
  age: nullable(number()), // may be null
});

type User = InferSchemaType<typeof userSchema>;
// { name: string; email?: string; age: number | null }
```

#### Chaining Validators

Use `chain()` to build validation pipelines:

```typescript
import { chain, parseNumber, min, max, integer } from '@railway-ts/pipelines/schema';

// Sequential validation + transformation
const adultAge = chain(
  parseNumber(), // unknown -> number (or error)
  integer(), // number -> number (or error if not integer)
  min(18), // number -> number (or error if < 18)
  max(120), // number -> number (or error if > 120)
);

validate('25', adultAge); // ok(25) - parsed and validated
validate('15', adultAge); // err([{ path: [], message: "Must be at least 18" }])
```

#### String, Number, Array Validators

```typescript
import {
  string,
  minLength,
  maxLength,
  pattern,
  nonEmpty,
  email,
  number,
  min,
  max,
  between,
  integer,
  positive,
  array,
  minItems,
  maxItems,
  unique,
  stringEnum,
} from '@railway-ts/pipelines/schema';

// String validation
const username = chain(
  string(),
  nonEmpty('Username required'),
  minLength(3, 'Too short'),
  pattern(/^[a-zA-Z0-9_]+$/, 'Alphanumeric only'),
);

// Number validation
const price = chain(number(), positive('Price must be positive'), precision(2, 'Max 2 decimal places'));

// Array validation
const tags = chain(
  array(string()),
  minItems(1, 'At least one tag required'),
  maxItems(10, 'Max 10 tags'),
  unique('Duplicate tags not allowed'),
);

// Enum validation
const status = stringEnum(['pending', 'approved', 'rejected'] as const);
// Returns: Validator<unknown, 'pending' | 'approved' | 'rejected'>
```

#### Parsing Validators (Type Transformations)

These validators transform types during validation:

```typescript
import {
  parseNumber, // string -> number
  parseDate, // string -> Date
  parseJSON, // string -> unknown
  parseEnum, // string -> EnumValue
} from '@railway-ts/pipelines/schema';

// Convert string to number in validation pipeline
const ageFromString = chain(parseNumber('Invalid number'), min(18, 'Must be adult'));

validate('25', ageFromString); // ok(25) - note: number, not string

// Parse JSON and validate structure
const jsonUserSchema = chain(
  parseJSON(),
  object({
    name: required(string()),
    age: required(number()),
  }),
);

validate('{"name":"Alice","age":30}', jsonUserSchema);
// ok({ name: "Alice", age: 30 })
```

#### Union Types

```typescript
import { union, discriminatedUnion, literal } from '@railway-ts/pipelines/schema';

// Try validators in order (first success wins)
const stringOrNumber = union([string(), parseNumber()]);

// Discriminated unions (more efficient)
const shapeSchema = discriminatedUnion('type', {
  circle: object({
    type: required(literal('circle')),
    radius: required(number()),
  }),
  rectangle: object({
    type: required(literal('rectangle')),
    width: required(number()),
    height: required(number()),
  }),
});

type Shape = InferSchemaType<typeof shapeSchema>;
// { type: 'circle', radius: number } | { type: 'rectangle', width: number, height: number }
```

#### Tuple Validators

Validate fixed-length arrays with type-safe element validation.

```typescript
import { tuple, tupleOf, chain, number, string, boolean, min, max, integer } from '@railway-ts/pipelines/schema';

// Heterogeneous tuple - different types per position
const userRecord = tuple([
  string(),                        // position 0: string
  chain(number(), integer(), min(0)), // position 1: non-negative integer
  boolean(),                       // position 2: boolean
]);

type UserRecord = InferSchemaType<typeof userRecord>;
// [string, number, boolean]

validate(['user123', 25, true], userRecord);  // ok(['user123', 25, true])
validate(['user123', -5, true], userRecord);  // err - age must be >= 0

// Homogeneous tuple - same type repeated N times
const vector3 = tupleOf(number(), 3);  // exactly 3 numbers

type Vector3 = InferSchemaType<typeof vector3>;
// [number, number, number]

validate([1.5, 2.3, 3.7], vector3);  // ok([1.5, 2.3, 3.7])
validate([1, 2], vector3);           // err - expected length 3, got 2

// With constraints
const rgbColor = tupleOf(
  chain(number(), integer(), min(0), max(255)),
  3
);

validate([255, 128, 64], rgbColor);  // ok([255, 128, 64])
validate([255, 300, 0], rgbColor);   // err - 300 exceeds max of 255

// Geographic coordinates [latitude, longitude]
const coordinate = tuple([
  chain(number(), min(-90), max(90)),    // latitude
  chain(number(), min(-180), max(180)),  // longitude
]);

validate([37.7749, -122.4194], coordinate);  // ok - San Francisco
```

**Use cases:** Coordinates, RGB colors, version numbers, matrix rows, vectors, any fixed-length structured data.

#### Complete Schema Example

```typescript
import {
  validate,
  object,
  required,
  optional,
  chain,
  string,
  minLength,
  maxLength,
  email,
  parseNumber,
  integer,
  min,
  max,
  array,
  minItems,
  maxItems,
  stringEnum,
  formatErrors,
  type InferSchemaType,
} from '@railway-ts/pipelines/schema';

const createUserSchema = object({
  username: required(chain(string(), minLength(3), maxLength(20))),
  email: required(chain(string(), email())),
  bio: optional(string()),
  age: required(chain(parseNumber(), integer(), min(13), max(120))),
  interests: required(chain(array(string()), minItems(1), maxItems(10))),
  role: required(stringEnum(['user', 'admin', 'moderator'] as const)),
});

type CreateUserInput = InferSchemaType<typeof createUserSchema>;
// {
//   username: string;
//   email: string;
//   bio?: string;
//   age: number;
//   interests: string[];
//   role: 'user' | 'admin' | 'moderator';
// }

function createUser(input: unknown): Result<User, Record<string, string>> {
  const validated = validate(input, createUserSchema);

  return match(validated, {
    ok: (data) => saveToDatabase(data), // data is CreateUserInput
    err: (errors) => err(formatErrors(errors)),
  });
}
```

**See full validator catalog**: [`src/schema/`](src/schema/) (50+ validators)
**See examples**: [`examples/schema/`](examples/schema/)

---

### Composition: Build Complex Pipelines

Functional composition utilities for building data pipelines.

#### pipe() - Immediate Composition

Left-to-right data flow with immediate execution:

```typescript
import { pipe } from '@railway-ts/pipelines/composition';

const result = pipe(
  5,
  (x) => x * 2, // 10
  (x) => x + 1, // 11
  (x) => String(x), // "11"
);
// "11"
```

Supports up to 10 steps with full type inference at each stage.

#### flow() - Deferred Composition

Build reusable function pipelines:

```typescript
import { flow } from '@railway-ts/pipelines/composition';

const processNumber = flow(
  (x: number) => x * 2,
  (x) => x + 1,
  (x) => String(x),
);

processNumber(5); // "11"
processNumber(10); // "21"
```

First function can accept multiple arguments:

```typescript
const processSum = flow(
  (a: number, b: number) => a + b,
  (x) => x * 2,
  String,
);

processSum(3, 4); // "14"
```

#### curry() / tupled()

Convert between different function forms:

```typescript
import { curry, tupled } from '@railway-ts/pipelines/composition';

const add = (a: number, b: number) => a + b;

// Currying for partial application
const curriedAdd = curry(add);
curriedAdd(5)(3); // 8

pipe(5, curry(add)(10)); // 15

// Tupled for array destructuring
const tupledAdd = tupled(add);
tupledAdd([5, 3]); // 8
```

**See full API**: [`src/composition/`](src/composition/)
**See examples**: [`examples/composition/`](examples/composition/)

---

## Quick Reference

### When to Use What

| Scenario                    | Use               | Why                                   |
| --------------------------- | ----------------- | ------------------------------------- |
| Value might be absent       | `Option<T>`       | Absence is normal, not exceptional    |
| Operation can fail          | `Result<T, E>`    | Need to communicate why it failed     |
| Validating untrusted input  | Schema validators | Parse into guaranteed-valid types     |
| Building data flows         | `pipe`, `flow`    | Compose transformations left-to-right |
| Multi-step async operations | `andThen`         | Chain async Results without nesting   |

### Common Patterns

**Boundary Validation**

```typescript
// unknown -> Result<T, E>
const result = validate(untrustedInput, schema);
```

**Transform on Success Path**

```typescript
// Stay on the rails
const transformed = andThen(result, (data) => processData(data));
```

**Branch at the End**

```typescript
// Handle both paths once
match(result, {
  ok: (data) => handleSuccess(data),
  err: (errors) => handleErrors(errors),
});
```

**Compose Reusable Pipelines**

```typescript
// Build function pipelines
const process = flow(
  (input) => validate(input, schema),
  (r) => andThen(r, fetchData),
  (r) => andThen(r, transform),
);
```

**Combine Multiple Values**

```typescript
// All-or-nothing with Option
const combined = combineOption([some(1), some(2), some(3)]); // Some([1,2,3])

// Fail-fast with Result
const results = combineResult([ok(1), ok(2), ok(3)]); // Ok([1,2,3])
```

---

## Import Strategy

The library provides **tree-shakable subpath imports**:

### Recommended: Subpath Imports

```typescript
import { some, none, map } from '@railway-ts/pipelines/option';
import { ok, err, flatMap } from '@railway-ts/pipelines/result';
import { pipe, flow } from '@railway-ts/pipelines/composition';
import { string, number, validate } from '@railway-ts/pipelines/schema';
```

**Benefits:**

- Optimal tree-shaking
- Natural function names (both Option and Result have `map`, no conflicts)
- Import only what you need

### Alternative: Root Import

```typescript
import {
  mapOption, // Option's map
  mapResult, // Result's map
  pipe,
  ok,
  validate,
} from '@railway-ts/pipelines';
```

**When to use:** Convenience when you need functions from multiple modules and don't mind renamed functions.

**Module structure:**

| Import Path                         | Module               | Key Types         |
| ----------------------------------- | -------------------- | ----------------- |
| `@railway-ts/pipelines/option`      | Optional values      | `Option<T>`       |
| `@railway-ts/pipelines/result`      | Fallible operations  | `Result<T, E>`    |
| `@railway-ts/pipelines/schema`      | Validation           | `Validator<I, O>` |
| `@railway-ts/pipelines/composition` | Function composition | `pipe`, `flow`    |

---

## Is This Right For You?

### When to Use railway-ts/pipelines

**Choose railway-ts/pipelines when:**

- Building data transformation pipelines
- You want validation + error handling + composition in one integrated system
- You prefer functional composition over method chaining
- You need explicit error propagation through multi-step workflows
- You want a gentler FP learning curve than fp-ts or Effect-TS

### When to Choose Something Else

**Choose an alternative when:**

- You only need validation (Zod is simpler for just validation)
- You need a full effect system with DI and resource management (Effect-TS)
- You want comprehensive category theory abstractions (fp-ts)
- You prefer OOP or method chaining style

### Quick Comparison

| Library        | Scope                        | Philosophy                      | Best For                     |
| -------------- | ---------------------------- | ------------------------------- | ---------------------------- |
| **railway-ts** | Railway pattern + validation | Railway-oriented programming    | Data pipelines, pragmatic FP |
| **Zod**        | Validation only              | Declarative schemas             | Drop-in validation           |
| **fp-ts**      | Complete FP toolkit          | Category theory                 | FP purists, complex apps     |
| **Effect-TS**  | Full effect system           | Effect/Fiber/Layer architecture | Large apps, microservices    |

---

## Next Steps

### API Reference

Full API documentation with types and examples:

- **Option**: [`src/option/option.ts`](src/option/option.ts) - 21 functions
- **Result**: [`src/result/result.ts`](src/result/result.ts) - 27 functions
- **Composition**: [`src/composition/`](src/composition/) - 6 utilities
- **Schema**: [`src/schema/`](src/schema/) - 50+ validators

### Examples

Working examples organized by category:

- **Option**: [`examples/option/option-examples.ts`](examples/option/option-examples.ts)
- **Result**: [`examples/result/result-examples.ts`](examples/result/result-examples.ts)
- **Schema**: [`examples/schema/`](examples/schema/)
  - [`basic.ts`](examples/schema/basic.ts) - Basic validators
  - [`union.ts`](examples/schema/union.ts) - Union types
  - [`tuple.ts`](examples/schema/tuple.ts) - Tuple validation
- **Composition**: [`examples/composition/`](examples/composition/)
  - [`advanced-composition.ts`](examples/composition/advanced-composition.ts)
  - [`curry-basics.ts`](examples/composition/curry-basics.ts)
  - [`tupled-basics.ts`](examples/composition/tupled-basics.ts)
- **Complete Pipelines**: [`examples/complete-pipelines/`](examples/complete-pipelines/)
  - [`async.ts`](examples/complete-pipelines/async.ts) - Basic async pipeline
  - [`async-launch.ts`](examples/complete-pipelines/async-launch.ts) - Rocket launch decision
  - [`hohmann-transfer.ts`](examples/complete-pipelines/hohmann-transfer.ts) - Orbital mechanics
  - [`hill-clohessy-wiltshire.ts`](examples/complete-pipelines/hill-clohessy-wiltshire.ts) - Spacecraft rendezvous
- **Interop**: [`examples/interop/interop-examples.ts`](examples/interop/interop-examples.ts)

### Advanced Topics

For advanced implementation details:

- **Symbol Branding**: How types are protected from structural typing
- **Tuple-Preserving Combinators**: Type-level magic for `combine()`
- **Type Inference**: How schema types are extracted

See [`docs/ADVANCED.md`](docs/ADVANCED.md)

### Contributing

Interested in contributing? See [`CONTRIBUTING.md`](CONTRIBUTING.md) for:

- Development setup and commands
- Project structure
- Code style guidelines
- Testing patterns
- Pull request process

---

## Further Reading

- [Railway-Oriented Programming](https://fsharpforfunandprofit.com/rop/) - Original concept by Scott Wlaschin
- [Parse, Don't Validate](https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/) - Type-driven validation
- [Making Illegal States Unrepresentable](https://ybogomolov.me/making-illegal-states-unrepresentable) - Type-level constraints

---

## License

MIT © Sarkis Melkonian

---

**Build robust pipelines. Make errors boring. Let data flow.**
