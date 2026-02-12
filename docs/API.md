# API Reference

Complete reference for every export in `@railway-ts/pipelines`.

---

## Result

```typescript
import { ... } from '@railway-ts/pipelines/result';
```

Typed success/failure. No exceptions, no try-catch pyramids.

> **Implementation note: Symbol branding.** `Result` uses a unique symbol brand (`RESULT_BRAND`) to prevent structural typing issues. Plain objects like `{ ok: true, value: 42 }` won't satisfy the `Result` type — only values created through `ok()` and `err()` are valid. This prevents subtle bugs from accidental duck typing.

### Constructors

#### `ok`

```typescript
function ok<T, E = never>(value: T): Result<T, E>
```

Create a Result containing a success value.

#### `err`

```typescript
function err<E>(error: E): Result<never, E>
```

Create a Result containing an error.

### Type Guards

#### `isOk`

```typescript
function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T }
```

Check if a Result is an Ok variant. Narrows the type so `result.value` is accessible.

#### `isErr`

```typescript
function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E }
```

Check if a Result is an Err variant. Narrows the type so `result.error` is accessible.

### Transformations

#### `map`

```typescript
function map<T, E, U>(result: Result<T, E>, fn: (value: T) => U): Result<U, E>
```

Transform the Ok value. Err passes through unchanged.

#### `flatMap`

```typescript
function flatMap<T, E, U>(result: Result<T, E>, fn: (value: T) => Result<U, E>): Result<U, E>
```

Transform the Ok value with a function that returns a Result. Useful for chaining operations that can fail.

#### `mapErr`

```typescript
function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F>
```

Transform the Err value. Ok passes through unchanged.

#### `bimap`

```typescript
function bimap<T, E, U, F>(
  result: Result<T, E>,
  okFn: (value: T) => U,
  errFn: (error: E) => F,
): Result<U, F>
```

Transform both Ok and Err branches in one call.

#### `filter`

```typescript
function filter<T, E>(
  result: Result<T, E>,
  predicate: (value: T) => boolean,
  error: E,
): Result<T, E>
```

Keep the Ok value if the predicate passes, otherwise return the provided error.

### Side Effects

#### `tap`

```typescript
function tap<T, E>(result: Result<T, E>, fn: (value: T) => void): Result<T, E>
```

Execute a side effect on the Ok value without changing the Result. Useful for logging.

#### `tapErr`

```typescript
function tapErr<T, E>(result: Result<T, E>, fn: (error: E) => void): Result<T, E>
```

Execute a side effect on the Err value without changing the Result.

### Recovery

#### `orElse`

```typescript
function orElse<T, E>(
  result: Result<T, E>,
  fn: (error: E) => Result<T, E>,
): Result<T, E>
```

Recover from an Err by applying `fn` to the error. Ok passes through unchanged.

### Pattern Matching

#### `match`

```typescript
function match<T, E, R>(
  result: Result<T, E>,
  patterns: { ok: (value: T) => R; err: (error: E) => R },
): R
```

Handle both Ok and Err cases, returning a single value.

```typescript
const message = match(result, {
  ok: (value) => `Got ${value}`,
  err: (error) => `Failed: ${error}`,
});
```

### Unwrap

#### `unwrap`

```typescript
function unwrap<T, E>(result: Result<T, E>, errorMsg?: string): T
```

Extract the Ok value, throwing if Err. **Prototyping only** — prefer `match` or `unwrapOr`.

#### `unwrapOr`

```typescript
function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T
```

Extract the Ok value, or return a default if Err.

#### `unwrapOrElse`

```typescript
function unwrapOrElse<T, E>(result: Result<T, E>, defaultFn: () => T): T
```

Extract the Ok value, or compute a default lazily if Err.

### Combining

#### `combine`

```typescript
function combine<T, E>(results: readonly Result<T, E>[]): Result<T[], E>
```

Combine an array of Results into a single Result. Short-circuits on the first Err. Preserves tuple types for up to 10 elements.

```typescript
combine([ok(1), ok(2), ok(3)]);       // ok([1, 2, 3])
combine([ok(1), err('fail'), ok(3)]); // err('fail')
```

#### `combineAll`

```typescript
function combineAll<T, E>(results: readonly Result<T, E>[]): Result<T[], E[]>
```

Like `combine`, but collects **all** errors instead of short-circuiting.

```typescript
combineAll([ok(1), err('a'), err('b')]); // err(['a', 'b'])
```

> **Implementation note: Tuple preservation.** Both `combine` and `combineAll` use 10 overloads to preserve exact tuple types instead of widening to arrays. `combine([ok(42), ok('hello')])` returns `Result<[number, string], E>`, not `Result<(number | string)[], E>`. This gives you type-safe destructuring at each position. Arrays longer than 10 elements fall back to union array types.

### Conversions

#### `mapToOption`

```typescript
function mapToOption<T, E>(result: Result<T, E>): Option<T>
```

Convert to Option. Ok becomes Some, Err becomes None.

#### `fromTry`

```typescript
function fromTry<T>(f: () => T): Result<T, string>
```

Execute a function that might throw. Returns Ok on success, Err with the error message on throw.

#### `fromTryWithError`

```typescript
function fromTryWithError<T>(f: () => T): Result<T, Error>
```

Like `fromTry`, but preserves the full Error object (stack trace, custom properties).

#### `fromPromise`

```typescript
function fromPromise<T>(promise: Promise<T>): Promise<Result<T, string>>
```

Convert a Promise to a Result. Rejects become Err with the error message as a string.

#### `fromPromiseWithError`

```typescript
function fromPromiseWithError<T, E = unknown>(
  promise: Promise<T>,
  errorFn?: (error: unknown) => E,
): Promise<Result<T, E>>
```

Like `fromPromise`, but lets you transform the error with a custom function.

#### `toPromise`

```typescript
function toPromise<T, E>(result: Result<T, E>): Promise<T>
```

Convert a Result to a Promise. Ok resolves, Err rejects.

### Curried Variants (Point-Free)

These return functions suitable for use in `pipe` and `flow`.

#### `mapWith`

```typescript
function mapWith<T, U>(fn: (value: T) => U): <E>(result: Result<T, E>) => Result<U, E>
```

#### `flatMapWith`

```typescript
function flatMapWith<T, U, E>(fn: (value: T) => Result<U, E>): (result: Result<T, E>) => Result<U, E>
function flatMapWith<T, U, E>(fn: (value: T) => Promise<Result<U, E>>): (result: Result<T, E>) => Promise<Result<U, E>>
```

Supports both sync and async step functions.

#### `mapErrWith`

```typescript
function mapErrWith<E, F>(fn: (error: E) => F): <T>(result: Result<T, E>) => Result<T, F>
```

#### `filterWith`

```typescript
function filterWith<T, E>(predicate: (value: T) => boolean, error: E): (result: Result<T, E>) => Result<T, E>
```

#### `tapWith`

```typescript
function tapWith<T, E>(fn: (value: T) => void): (result: Result<T, E>) => Result<T, E>
function tapWith<T, E>(fn: (value: T) => Promise<void>): (result: Result<T, E>) => Promise<Result<T, E>>
```

Supports both sync and async side effects.

#### `tapErrWith`

```typescript
function tapErrWith<E>(fn: (error: E) => void): <T>(result: Result<T, E>) => Result<T, E>
function tapErrWith<E>(fn: (error: E) => Promise<void>): <T>(result: Result<T, E>) => Promise<Result<T, E>>
```

#### `orElseWith`

```typescript
function orElseWith<T, E>(fn: (error: E) => Result<T, E>): (result: Result<T, E>) => Result<T, E>
```

---

## Option

```typescript
import { ... } from '@railway-ts/pipelines/option';
```

Nullable handling without null checks.

> **Implementation note: Symbol branding.** Like `Result`, `Option` uses a unique symbol brand (`OPTION_BRAND`). Only values created through `some()` and `none()` satisfy the `Option` type.

### Constructors

#### `some`

```typescript
function some<T>(value: T): Option<T>
```

Create an Option containing a value.

#### `none`

```typescript
function none<T = never>(): Option<T>
```

Create an Option containing nothing.

### Type Guards

#### `isSome`

```typescript
function isSome<T>(option: Option<T>): option is { some: true; value: T }
```

Check if an Option is a Some variant.

#### `isNone`

```typescript
function isNone<T>(option: Option<T>): option is { some: false }
```

Check if an Option is a None variant.

### Transformations

#### `map`

```typescript
function map<T, U>(option: Option<T>, fn: (value: T) => U): Option<U>
```

Transform the Some value. None passes through.

#### `flatMap`

```typescript
function flatMap<T, U>(option: Option<T>, fn: (value: T) => Option<U>): Option<U>
```

Transform the Some value with a function that returns an Option.

#### `bimap`

```typescript
function bimap<T, U>(
  option: Option<T>,
  someFn: (value: T) => Option<U>,
  noneFn: () => Option<U>,
): Option<U>
```

Handle both Some and None branches, each returning a new Option.

#### `filter`

```typescript
function filter<T>(option: Option<T>, predicate: (value: T) => boolean): Option<T>
```

Keep the Some value if the predicate passes, otherwise return None.

### Side Effects

#### `tap`

```typescript
function tap<T>(option: Option<T>, fn: (value: T) => void): Option<T>
```

Execute a side effect on the Some value without changing the Option.

### Pattern Matching

#### `match`

```typescript
function match<T, R>(
  option: Option<T>,
  patterns: { some: (value: T) => R; none: () => R },
): R
```

Handle both Some and None cases, returning a single value.

### Unwrap

#### `unwrap`

```typescript
function unwrap<T>(option: Option<T>, errorMsg?: string): T
```

Extract the Some value, throwing if None. **Prototyping only** — prefer `match` or `unwrapOr`.

#### `unwrapOr`

```typescript
function unwrapOr<T>(option: Option<T>, defaultValue: T): T
```

Extract the Some value, or return a default if None.

#### `unwrapOrElse`

```typescript
function unwrapOrElse<T>(option: Option<T>, defaultFn: () => T): T
```

Extract the Some value, or compute a default lazily if None.

### Combining

#### `combine`

```typescript
function combine<T>(options: readonly Option<T>[]): Option<T[]>
```

Combine an array of Options into a single Option. Returns None if any element is None. Preserves tuple types for up to 10 elements.

> **Implementation note: Tuple preservation.** Like Result's `combine`, uses 10 overloads to preserve exact tuple types. `combine([some(1), some('a')])` returns `Option<[number, string]>`, not `Option<(number | string)[]>`.

### Conversions

#### `fromNullable`

```typescript
function fromNullable<T>(value: T | null | undefined): Option<T>
```

Create an Option from a nullable value. `null`/`undefined` become None, everything else becomes Some.

#### `mapToResult`

```typescript
function mapToResult<T, E>(option: Option<T>, error: E): Result<T, E>
```

Convert to Result. Some becomes Ok, None becomes Err with the provided error.

### Curried Variants (Point-Free)

#### `mapWith`

```typescript
function mapWith<T, U>(fn: (value: T) => U): (option: Option<T>) => Option<U>
```

#### `flatMapWith`

```typescript
function flatMapWith<T, U>(fn: (value: T) => Option<U>): (option: Option<T>) => Option<U>
function flatMapWith<T, U>(fn: (value: T) => Promise<Option<U>>): (option: Option<T>) => Promise<Option<U>>
```

Supports both sync and async step functions.

#### `filterWith`

```typescript
function filterWith<T>(predicate: (value: T) => boolean): (option: Option<T>) => Option<T>
```

#### `tapWith`

```typescript
function tapWith<T>(fn: (value: T) => void): (option: Option<T>) => Option<T>
function tapWith<T>(fn: (value: T) => Promise<void>): (option: Option<T>) => Promise<Option<T>>
```

Supports both sync and async side effects.

---

## Schema

```typescript
import { ... } from '@railway-ts/pipelines/schema';
```

Parse untrusted data into typed values. Accumulates all validation errors.

### Core Types

#### `Validator<I, O>`

```typescript
type Validator<I, O = I> = (value: I, path?: string[]) => Result<O, ValidationError[]>
```

A synchronous validator function.

#### `AsyncValidator<I, O>`

```typescript
type AsyncValidator<I, O = I> = (value: I, path?: string[]) => Promise<Result<O, ValidationError[]>>
```

An asynchronous validator that always returns a Promise.

#### `MaybeAsyncValidator<I, O>`

```typescript
type MaybeAsyncValidator<I, O = I> = (
  value: I,
  path?: string[],
) => Result<O, ValidationError[]> | Promise<Result<O, ValidationError[]>>
```

A validator that may return either sync or async. Used when mixing sync and async field validators.

#### `Schema<T>`

```typescript
type Schema<T> = { [K in keyof T]: MaybeAsyncValidator<unknown, T[K]> }
```

A validation schema where keys map to validators. Accepts both sync and async validators.

#### `SyncSchema<T>`

```typescript
type SyncSchema<T> = { [K in keyof T]: Validator<unknown, T[K]> }
```

A schema where all validators are synchronous. Preserves sync return types.

#### `ValidationError`

```typescript
type ValidationError = { path: string[]; message: string }
```

A validation error with path information and a message.

#### `ValidationResult<T>`

```typescript
type ValidationResult<T> =
  | { valid: true; data: T }
  | { valid: false; errors: Record<string, string> }
```

The result of a validation-and-format operation.

#### `InferSchemaType<V>`

```typescript
type InferSchemaType<V> = ProcessType<InferType<V>>
```

Infer the output TypeScript type from a validator or schema.

```typescript
const schema = object({ name: required(string()), age: required(number()) });
type User = InferSchemaType<typeof schema>; // { name: string; age: number }
```

#### `ValidatorMapOutput<M>`

```typescript
type ValidatorMapOutput<M extends Record<string, MaybeAsyncValidator<unknown, unknown>>>
```

Extract the union of output types from a validator map. Used by `discriminatedUnion`.

### Structures

#### `object`

```typescript
function object<T>(schema: SyncSchema<T>, options?: { strict?: boolean }): Validator<unknown, T>
function object<T>(schema: Schema<T>, options?: { strict?: boolean }): MaybeAsyncValidator<unknown, T>
```

Validate objects against a schema. Each key maps to a validator. Strict mode (default) rejects extra properties. Fields are validated in parallel when async.

```typescript
const userSchema = object({
  name: required(string()),
  age: required(chain(parseNumber(), min(18))),
});
```

#### `array`

```typescript
function array<I, O>(itemValidator: Validator<I, O>): Validator<unknown, O[]>
function array<I, O>(itemValidator: MaybeAsyncValidator<I, O>): MaybeAsyncValidator<unknown, O[]>
```

Validate arrays where each item is validated by the provided validator.

#### `tuple`

```typescript
function tuple<V extends ReadonlyArray<Validator<unknown, unknown>>>(
  validators: V,
): Validator<unknown, TupleType<V>>
```

Validate a heterogeneous tuple where each position has its own validator.

```typescript
const validate = tuple([string(), number(), boolean()]);
validate(['a', 1, true]); // ok(["a", 1, true])
```

#### `tupleOf`

```typescript
function tupleOf<T>(elementValidator: Validator<unknown, T>, length: number): Validator<unknown, T[]>
```

Validate a homogeneous tuple with a fixed length. All elements share the same type.

```typescript
const point3D = tupleOf(number(), 3); // [number, number, number]
```

### Field Modifiers

#### `required`

```typescript
function required<I, O>(validator: Validator<I, O>, message?: string): Validator<I | undefined | null, O>
```

Require a value to be defined (not null or undefined).

#### `optional`

```typescript
function optional<I, O>(validator: Validator<I, O>): Validator<I | undefined | null, O | undefined>
```

Allow null/undefined values. Returns `undefined` for missing values, otherwise applies the validator.

#### `nullable`

```typescript
function nullable(message?: string): Validator<unknown, null>
```

Accept only `null` values.

#### `emptyAsOptional`

```typescript
function emptyAsOptional<I, O>(validator: Validator<I, O>): Validator<I | undefined | null, O | undefined>
```

Treat empty strings, empty arrays, and empty objects as optional (returns `undefined`).

#### `literal`

```typescript
function literal<T>(expectedValue: T, message?: string): Validator<unknown, T>
```

Accept only an exact value match.

```typescript
const validate = literal('active');
validate('active');    // ok("active")
validate('completed'); // err(...)
```

### Primitives

#### `string`

```typescript
function string(message?: string): Validator<unknown, string>
```

Ensure the value is a string.

#### `number`

```typescript
function number(message?: string): Validator<unknown, number>
```

Ensure the value is a number (not NaN).

#### `boolean`

```typescript
function boolean(message?: string): Validator<unknown, boolean>
```

Ensure the value is a boolean.

#### `date`

```typescript
function date(message?: string): Validator<unknown, Date>
```

Ensure the value is a valid Date object.

#### `bigint`

```typescript
function bigint(message?: string): Validator<unknown, bigint>
```

Ensure the value is a bigint.

### Parsers

Coerce untrusted input into typed values.

#### `parseNumber`

```typescript
function parseNumber(message?: string): Validator<unknown, number>
```

Parse strings and numbers into numbers. `'25'` becomes `25`.

#### `parseString`

```typescript
function parseString(message?: string): Validator<unknown, string>
```

Coerce non-null/undefined values to strings. `12345` becomes `'12345'`.

#### `parseBool`

```typescript
function parseBool(message?: string): Validator<unknown, boolean>
```

Parse booleans, `0`/`1`, and strings like `'true'`/`'false'`, `'yes'`/`'no'`.

#### `parseBigInt`

```typescript
function parseBigInt(message?: string): Validator<unknown, bigint>
```

Parse BigInt values, strings, and integer numbers into bigints.

#### `parseDate`

```typescript
function parseDate(message?: string): Validator<unknown, Date>
```

Parse Date objects, date strings, and numeric timestamps into Date objects.

#### `parseISODate`

```typescript
function parseISODate(message?: string): Validator<unknown, Date>
```

Parse strict ISO date strings (`YYYY-MM-DD`) into Date objects. Validates calendar correctness.

#### `parseJSON`

```typescript
function parseJSON(message?: string): Validator<unknown, unknown>
```

Parse JSON strings into objects. Already-parsed objects pass through.

#### `parseURL`

```typescript
function parseURL(message?: string): Validator<unknown, URL>
```

Parse string URLs into URL objects.

#### `parseEnum`

```typescript
function parseEnum<T extends Record<string, string | number>>(
  enumObject: T,
  message?: string,
): Validator<unknown, T[keyof T]>
```

Parse input into TypeScript enum values. Supports case-insensitive key matching.

```typescript
enum Status { Pending = 'PENDING', Approved = 'APPROVED' }
const validate = parseEnum(Status);
validate('pending'); // ok("PENDING")
```

### String Constraints

#### `minLength`

```typescript
function minLength(min: number, message?: string): Validator<string>
```

Ensure a string has at least `min` characters.

#### `maxLength`

```typescript
function maxLength(max: number, message?: string): Validator<string>
```

Ensure a string has at most `max` characters.

#### `pattern`

```typescript
function pattern(regex: RegExp, message?: string): Validator<string>
```

Ensure a string matches a regular expression.

#### `nonEmpty`

```typescript
function nonEmpty(message?: string): Validator<string>
```

Ensure a string is not empty after trimming whitespace.

#### `email`

```typescript
function email(message?: string): Validator<string>
```

Ensure a string is a valid email address.

#### `phoneNumber`

```typescript
function phoneNumber(message?: string): Validator<string>
```

Ensure a string is a valid phone number. Accepts international formats with `+`, spaces, dashes, and parentheses.

### Number Constraints

#### `min`

```typescript
function min(value: number, message?: string): Validator<number>
```

Ensure a number is at least `value` (inclusive).

#### `max`

```typescript
function max(value: number, message?: string): Validator<number>
```

Ensure a number is at most `value` (inclusive).

#### `between`

```typescript
function between(min: number, max: number, message?: string): Validator<number>
```

Ensure a number is between `min` and `max` (inclusive).

#### `integer`

```typescript
function integer(message?: string): Validator<number>
```

Ensure a number is an integer.

#### `positive`

```typescript
function positive(message?: string): Validator<number>
```

Ensure a number is greater than zero.

#### `negative`

```typescript
function negative(message?: string): Validator<number>
```

Ensure a number is less than zero.

#### `nonZero`

```typescript
function nonZero(message?: string): Validator<number>
```

Ensure a number is not zero.

#### `divisibleBy`

```typescript
function divisibleBy(divisor: number, message?: string): Validator<number>
```

Ensure a number is divisible by `divisor`.

#### `precision`

```typescript
function precision(maxDecimalPlaces: number, message?: string): Validator<number>
```

Ensure a number has at most `maxDecimalPlaces` decimal places.

#### `finite`

```typescript
function finite(message?: string): Validator<number>
```

Ensure a number is finite (not `Infinity` or `-Infinity`).

### Date Constraints

#### `dateRange`

```typescript
function dateRange(min: Date, max: Date, message?: string): Validator<Date>
```

Ensure a Date is within a range (inclusive).

#### `pastDate`

```typescript
function pastDate(message?: string): Validator<Date>
```

Ensure a Date is in the past.

#### `futureDate`

```typescript
function futureDate(message?: string): Validator<Date>
```

Ensure a Date is in the future.

#### `todayOrFuture`

```typescript
function todayOrFuture(message?: string): Validator<Date>
```

Ensure a Date is today or in the future (calendar date comparison).

### Boolean Constraints

#### `matches`

```typescript
function matches(expected: boolean, message?: string): Validator<boolean>
```

Ensure a boolean matches the expected value.

### Array Constraints

#### `minItems`

```typescript
function minItems<T>(min: number, message?: string): Validator<T[], T[]>
```

Ensure an array has at least `min` items.

#### `maxItems`

```typescript
function maxItems<T>(max: number, message?: string): Validator<T[], T[]>
```

Ensure an array has at most `max` items.

#### `notEmpty`

```typescript
function notEmpty<T>(message?: string): Validator<T[], T[]>
```

Ensure an array is not empty.

#### `unique`

```typescript
function unique<T>(message?: string, keyExtractor?: (item: T) => unknown): Validator<T[], T[]>
```

Ensure all array elements are unique. Optional `keyExtractor` for comparing objects.

```typescript
unique<{ id: number }>('Duplicate ID', (item) => item.id)
```

### Enums

#### `stringEnum`

```typescript
function stringEnum<T extends string>(
  allowedValues: T[],
  message?: string,
): Validator<unknown, T>
```

Validate that a value is a string and one of the allowed values. Combines `string()` + membership check.

#### `enumValue`

```typescript
function enumValue<T extends Record<string, string | number>>(
  enumObject: T,
  message?: string,
  excludedValues?: T[keyof T][],
): Validator<unknown, T[keyof T]>
```

Validate against a TypeScript enum. Supports excluding specific values.

#### `oneOf`

```typescript
function oneOf<T>(allowedValues: T[], message?: string): Validator<T>
```

Ensure a value is one of the allowed values.

### Unions

#### `union`

```typescript
function union<I, O1, O2>(
  validators: [Validator<I, O1>, Validator<I, O2>],
  options?: { collectAllErrors?: boolean; errorPrefix?: string },
): Validator<I, O1 | O2>
```

Try validators in order. Returns the first success, or all errors if none match. Supports up to 5 typed variants, plus a generic fallback. Async-aware.

```typescript
const validate = union([string(), number()]);
validate('hello'); // ok("hello")
validate(42);      // ok(42)
```

#### `discriminatedUnion`

```typescript
function discriminatedUnion<M extends Record<string, Validator<unknown, unknown>>>(
  discriminantField: string,
  validatorMap: M,
  fallbackMessage?: string,
): Validator<unknown, ValidatorMapOutput<M>>
```

Select a validator based on a discriminant field's value. More efficient than `union` for tagged objects.

```typescript
const validate = discriminatedUnion('type', {
  text: object({ type: required(literal('text')), content: required(string()) }),
  image: object({ type: required(literal('image')), url: required(string()) }),
});
```

### Combinators

#### `chain`

```typescript
function chain<A, B>(v1: Validator<A, B>): Validator<A, B>
function chain<A, B, C>(v1: Validator<A, B>, v2: Validator<B, C>): Validator<A, C>
// ... up to 10 validators
```

Compose validators in sequence. Each output feeds into the next. Short-circuits on first error.

```typescript
const validate = chain(string(), nonEmpty(), minLength(8));
validate('password123'); // ok("password123")
```

#### `chainAsync`

```typescript
function chainAsync<A, B>(v1: MaybeAsyncValidator<A, B>): AsyncValidator<A, B>
function chainAsync<A, B, C>(
  v1: MaybeAsyncValidator<A, B>,
  v2: MaybeAsyncValidator<B, C>,
): AsyncValidator<A, C>
// ... up to 10 validators
```

Like `chain`, but accepts async validators. Always returns an `AsyncValidator`.

```typescript
const validate = chainAsync(
  string(),
  email(),
  refineAsync(async (e) => !(await db.users.exists({ email: e })), 'Taken'),
);
```

#### `transform`

```typescript
function transform<I, O>(transformer: (value: I) => O): Validator<I, O>
```

Create a validator that transforms a value during validation.

```typescript
const normalize = chain(string(), email(), transform((s) => s.toLowerCase()));
```

#### `refine`

```typescript
function refine<T>(predicate: (value: T) => boolean, message?: string): Validator<T, T>
```

Create a validator with a custom predicate.

```typescript
const isEven = refine<number>((n) => n % 2 === 0, 'Must be even');
```

#### `refineAsync`

```typescript
function refineAsync<T>(
  predicate: (value: T) => Promise<boolean>,
  message?: string,
): AsyncValidator<T, T>
```

Async version of `refine`. Use for database lookups, API checks, etc.

### Cross-Field Validation

#### `refineAt`

```typescript
function refineAt<T>(
  targetPath: string | string[],
  predicate: (value: T) => boolean,
  message: string,
): Validator<T, T>
```

Validate across fields, attaching the error to a specific field path. Receives the entire parent object.

```typescript
const validate = chain(
  object({ password: required(string()), confirm: required(string()) }),
  refineAt('confirm', (d) => d.password === d.confirm, 'Passwords must match'),
);
```

#### `refineAtAsync`

```typescript
function refineAtAsync<T>(
  targetPath: string | string[],
  predicate: (value: T) => Promise<boolean>,
  message: string,
): AsyncValidator<T, T>
```

Async version of `refineAt`.

```typescript
const validate = chainAsync(
  object({ username: required(string()) }),
  refineAtAsync('username', async (d) => !(await db.users.exists({ username: d.username })), 'Taken'),
);
```

### Validation & Formatting

#### `validate`

```typescript
function validate<T>(value: unknown, validator: Validator<unknown, T>): Result<T, ValidationError[]>
function validate<T>(
  value: unknown,
  validator: MaybeAsyncValidator<unknown, T>,
): Result<T, ValidationError[]> | Promise<Result<T, ValidationError[]>>
```

Run a validator against a value. Returns sync when the validator is sync.

#### `validateAndFormatResult`

```typescript
function validateAndFormatResult<T>(
  input: unknown,
  schema: Validator<unknown, T>,
): ValidationResult<T>
function validateAndFormatResult<T>(
  input: unknown,
  schema: MaybeAsyncValidator<unknown, T>,
): ValidationResult<T> | Promise<ValidationResult<T>>
```

Validate and format in one call. Returns `{ valid: true, data }` or `{ valid: false, errors }`.

#### `formatErrors`

```typescript
function formatErrors(errors: ValidationError[]): Record<string, string>
```

Convert validation errors to a flat object. Array paths use bracket notation.

```typescript
formatErrors([
  { path: ['name'], message: 'Required' },
  { path: ['items', '1'], message: 'Invalid' },
]);
// { name: 'Required', 'items[1]': 'Invalid' }
```

#### `ROOT_ERROR_KEY`

```typescript
const ROOT_ERROR_KEY = '_root'
```

The key used in formatted errors for root-level validation errors (empty path).

### Standard Schema

#### `toStandardSchema`

```typescript
function toStandardSchema<O>(validator: Validator<unknown, O>): StandardSchemaV1<unknown, O>
function toStandardSchema<O>(validator: MaybeAsyncValidator<unknown, O>): StandardSchemaV1<unknown, O>
```

Wrap a validator as a Standard Schema v1 object for interop with tRPC, TanStack Form, React Hook Form, and other consumers.

```typescript
const standardSchema = toStandardSchema(
  object({ name: required(string()), email: required(email()) }),
);
```

#### `StandardSchemaV1`

```typescript
interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly '~standard': {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (value: unknown) => Result<Output> | Promise<Result<Output>>;
  };
}
```

The Standard Schema v1 interface type. Re-exported for type annotations.

---

## Composition

```typescript
import { ... } from '@railway-ts/pipelines/composition';
```

Build pipelines. No nested function calls.

> **Implementation note: `this: void`.** All callback parameters in `pipe`, `flow`, `pipeAsync`, and `flowAsync` are annotated with `this: void`. This ensures composed functions don't depend on `this` context — TypeScript will catch methods that rely on `this` being bound, enforcing referential transparency.

### Types

#### `MaybeAsync<T>`

```typescript
type MaybeAsync<T> = T | Promise<T>
```

A value that may or may not be wrapped in a Promise.

### Sync

#### `pipe`

```typescript
function pipe<A>(value: A): A
function pipe<A, B>(value: A, fn1: (a: A) => B): B
function pipe<A, B, C>(value: A, fn1: (a: A) => B, fn2: (b: B) => C): C
// ... up to 20 functions
```

Execute a value through a series of functions. Each output feeds into the next.

```typescript
const result = pipe(5, (x) => x * 2, (x) => x + 1); // 11
```

#### `flow`

```typescript
function flow<A, B>(fn1: (a: A) => B): (a: A) => B
function flow<A, B, C>(fn1: (a: A) => B, fn2: (b: B) => C): (a: A) => C
// ... up to 20 functions
```

Compose functions left-to-right into a reusable pipeline. Like `pipe` but returns a function.

```typescript
const process = flow((x: number) => x * 2, (x) => x + 1);
process(5); // 11
```

#### `curry`

```typescript
function curry<A, B, R>(fn: (a: A, b: B) => R): (a: A) => (b: B) => R
function curry<A, B, C, R>(fn: (a: A, b: B, c: C) => R): (a: A) => (b: B) => (c: C) => R
// ... up to 4 parameters
```

Convert a multi-argument function into a chain of single-argument functions.

#### `uncurry`

```typescript
function uncurry<A, B, R>(fn: (a: A) => (b: B) => R): (a: A, b: B) => R
function uncurry<A, B, C, R>(fn: (a: A) => (b: B) => (c: C) => R): (a: A, b: B, c: C) => R
// ... up to 4 parameters
```

Reverse of `curry`. Convert a curried function back to multi-argument form.

#### `tupled`

```typescript
function tupled<A extends unknown[], R>(fn: (...args: A) => R): (args: A) => R
```

Convert a multi-argument function into one that takes a single tuple argument.

```typescript
const add = (a: number, b: number) => a + b;
const tupledAdd = tupled(add);
tupledAdd([1, 2]); // 3
```

#### `untupled`

```typescript
function untupled<A extends unknown[], R>(fn: (args: A) => R): (...args: A) => R
```

Reverse of `tupled`. Convert a tuple-argument function back to multi-argument form.

### Async

#### `pipeAsync`

```typescript
function pipeAsync<A>(value: MaybeAsync<A>): Promise<A>
function pipeAsync<A, B>(value: MaybeAsync<A>, fn1: (a: A) => MaybeAsync<B>): Promise<B>
// ... up to 20 functions
```

Like `pipe`, but awaits each step. Accepts both sync and async functions.

```typescript
const data = await pipeAsync(userId, fetchUser, validateUser, enrichProfile);
```

#### `flowAsync`

```typescript
function flowAsync<A, B>(fn1: (a: A) => MaybeAsync<B>): (a: A) => Promise<B>
function flowAsync<A, B, C>(
  fn1: (a: A) => MaybeAsync<B>,
  fn2: (b: B) => MaybeAsync<C>,
): (a: A) => Promise<C>
// ... up to 20 functions
```

Like `flow`, but returns an async pipeline. Accepts both sync and async functions.

```typescript
const processOrder = flowAsync(validateOrder, chargePayment, createShipment);
await processOrder(orderInput);
```
