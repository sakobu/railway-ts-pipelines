# Advanced Implementation Details

This document covers advanced implementation details of `@railway-ts/pipelines`. Most users won't need to understand these internals, but they're documented here for those interested in how the library achieves its type safety and ergonomics.

---

## Symbol Branding

Both `Option` and `Result` use **symbol branding** to prevent structural typing issues:

```typescript
const OPTION_BRAND = Symbol('OPTION_BRAND');
const RESULT_BRAND = Symbol('RESULT_BRAND');

type Option<T> =
  | { readonly some: true; readonly value: T; readonly [OPTION_BRAND]: 'some' }
  | { readonly some: false; readonly [OPTION_BRAND]: 'none' };
```

### Why Symbol Branding?

Symbol branding prevents accidental duck typing where plain objects might be mistakenly treated as `Option` or `Result` types:

```typescript
// BAD: Without branding
const fakeOption = { some: true, value: 42 };
// Could be accidentally treated as Option<number> due to structural typing

// GOOD: With branding
const fakeOption = { some: true, value: 42 };
// Type error: missing [OPTION_BRAND] symbol
// Only way to create valid Options is through some() or none()
```

This ensures that only values created through the library's constructors (`some`, `none`, `ok`, `err`) can be used as `Option` or `Result` types, preventing subtle bugs from structural compatibility.

---

## Tuple-Preserving Combinators

Both `combine()` functions use **10 overloads** to preserve exact tuple types instead of widening to arrays:

```typescript
// Without tuple preservation
const result = combine([ok(42), ok('hello'), ok(true)]);
// Type would be: Result<(number | string | boolean)[], E>
// Information about order and exact types is lost

// With tuple preservation
const result = combine([ok(42), ok('hello'), ok(true)]);
// Type is: Result<[number, string, boolean], E1 | E2 | E3>
// Exact tuple type preserved!
```

### Benefits of Tuple Preservation

This enables type-safe destructuring where TypeScript knows the exact type at each position:

```typescript
const results = combine([
  validateName(input.name), // Result<Name, ValidationError>
  validateEmail(input.email), // Result<Email, ValidationError>
  validateAge(input.age), // Result<Age, ValidationError>
]);

match(results, {
  ok: ([name, email, age]) => {
    // TypeScript knows:
    // - name is Name
    // - email is Email
    // - age is Age
    // No type casts needed!
  },
  err: (error) => {
    // error is ValidationError (union of all error types)
  },
});
```

### Implementation

The library provides overloads for up to 10 elements:

```typescript
function combine<T1, E1>(results: [Result<T1, E1>]): Result<[T1], E1>;
function combine<T1, E1, T2, E2>(results: [Result<T1, E1>, Result<T2, E2>]): Result<[T1, T2], E1 | E2>;
function combine<T1, E1, T2, E2, T3, E3>(
  results: [Result<T1, E1>, Result<T2, E2>, Result<T3, E3>],
): Result<[T1, T2, T3], E1 | E2 | E3>;
// ... up to 10 elements
```

For arrays with more than 10 elements, the function falls back to a general array type.

---

## Discriminated Unions

The library makes perfect use of TypeScript's discriminated unions with type guards:

```typescript
import { isOk, isErr } from '@railway-ts/pipelines/result';

function example(result: Result<number, string>) {
  if (isOk(result)) {
    result.value; // OK: TypeScript knows this exists (type: number)
    result.error; // ERROR: TypeScript error: doesn't exist on ok branch
  } else {
    result.error; // OK: TypeScript knows this exists (type: string)
    result.value; // ERROR: TypeScript error: doesn't exist on error branch
  }
}

// Or with isErr
function example2(result: Result<number, string>) {
  if (isErr(result)) {
    result.error; // OK: TypeScript knows this exists (type: string)
  } else {
    result.value; // OK: TypeScript knows this exists (type: number)
  }
}
```

### How It Works

The discriminant fields (`ok` for Result, `some` for Option) are literal boolean types:

```typescript
type Result<T, E> =
  | { readonly ok: true; readonly value: T } // ok is literally 'true'
  | { readonly ok: false; readonly error: E }; // ok is literally 'false'
```

When you check `result.ok`, TypeScript uses control flow analysis to narrow the type to the appropriate branch.

---

## Type Predicate Narrowing

Type guards return proper type predicates that work with TypeScript's control flow analysis:

```typescript
function isOk<T, E>(
  result: Result<T, E>,
): result is {
  readonly ok: true;
  readonly value: T;
  readonly [RESULT_BRAND]: 'ok';
};

function isErr<T, E>(
  result: Result<T, E>,
): result is {
  readonly ok: false;
  readonly error: E;
  readonly [RESULT_BRAND]: 'err';
};
```

The `result is Type` syntax is a **type predicate** that tells TypeScript's type checker:

- "If this function returns true, narrow the type to this specific variant"
- Works across function boundaries and complex control flow

This enables proper narrowing in conditional checks throughout your codebase.

---

## Schema Type Inference

Complex type-level programming extracts output types from validators:

```typescript
type InferType<V> = V extends Validator<unknown, infer O> ? O : never;
export type InferSchemaType<V> = ProcessType<InferType<V>>;

const schema = object({
  name: required(string()),
  age: optional(chain(parseNumber(), min(18))),
  email: nullable(chain(string(), email())),
});

type User = InferSchemaType<typeof schema>;
// Result: { name: string; age?: number; email: string | null }
```

### What ProcessType Does

The `ProcessType` helper cleans up the inferred type:

1. **Handles optional fields**: Extracts `| undefined` into `?` optional property syntax
2. **Handles nullable fields**: Preserves `| null` in the type union
3. **Flattens nested object types**: Ensures clean, readable output types
4. **Preserves literal types**: Keeps string/number/boolean literals from enums

### Type Tracking Through Transformations

The type system tracks transformations through validator chains:

```typescript
const validator = chain(
  parseNumber(), // Validator<unknown, number>
  min(18), // Validator<number, number>
  max(120), // Validator<number, number>
);
// Final type: Validator<unknown, number>
// Input: unknown, Output: number
```

Each validator in the chain has:

- **Input type**: What it accepts
- **Output type**: What it produces (if validation succeeds)

The `chain()` function composes these by ensuring the output of step N matches the input of step N+1.

### Array and Nested Inference

The type system handles nested structures:

```typescript
const addressSchema = object({
  street: required(string()),
  city: required(string()),
  zipCode: required(chain(string(), pattern(/^\d{5}$/))),
});

const userSchema = object({
  name: required(string()),
  addresses: required(array(addressSchema)),
});

type User = InferSchemaType<typeof userSchema>;
// {
//   name: string;
//   addresses: Array<{
//     street: string;
//     city: string;
//     zipCode: string;
//   }>;
// }
```

The inference system recursively processes nested `object()` and `array()` validators.

---

## Composition Function Constraints

All composition functions (`pipe`, `flow`, `curry`, etc.) use `this: void` to ensure referential transparency:

```typescript
export function pipe<A, B, C>(this: void, a: A, ab: (this: void, a: A) => B, bc: (this: void, b: B) => C): C {
  return bc(ab(a));
}
```

### Why `this: void`?

The `this: void` parameter enforces that functions cannot depend on context binding:

```typescript
// BAD: This won't compile
const obj = {
  value: 42,
  method: function () {
    return this.value;
  },
};

pipe(10, obj.method); // Error: 'this' context of type 'void' is not assignable

// GOOD: This works
const getConstant = () => 42;
pipe(10, getConstant);
```

This constraint ensures:

1. **Referential transparency**: Function output depends only on input, not context
2. **Composability**: Functions can be safely composed without worrying about `this` binding
3. **Predictability**: No hidden dependencies on object state

---

## Error Type Unions in combine()

The `combine()` function creates a union of all error types:

```typescript
const result1: Result<string, Error> = validateName(input);
const result2: Result<number, ValidationError> = validateAge(input);
const result3: Result<Email, ParseError> = validateEmail(input);

const combined = combine([result1, result2, result3]);
// Type: Result<[string, number, Email], Error | ValidationError | ParseError>
```

### Why Union Types?

Since `combine()` short-circuits on the first error, you'll only ever see **one** error. The union type `E1 | E2 | E3` represents "it could be any of these error types."

This is different from `combineAll()`, which collects all errors:

```typescript
const combinedAll = combineAll([result1, result2, result3]);
// Type: Result<[string, number, Email], Array<Error | ValidationError | ParseError>>
```

---

## Pattern Matching Exhaustiveness

The `match()` function requires exhaustive pattern matching:

```typescript
match(result, {
  ok: (value) => handleSuccess(value),
  err: (error) => handleError(error),
});
```

If you omit either branch, TypeScript will produce a compile error:

```typescript
match(result, {
  ok: (value) => handleSuccess(value),
  // ERROR: Property 'err' is missing
});
```

This is achieved through the type signature:

```typescript
export function match<T, E, R>(
  result: Result<T, E>,
  handlers: {
    readonly ok: (value: T) => R;
    readonly err: (error: E) => R;
  },
): R;
```

Both handlers must return the same type `R`, ensuring consistent handling of both cases.

---

## Design Philosophy

These advanced features support the library's core design philosophy:

1. **Type Safety**: Symbol branding prevents structural typing issues
2. **Ergonomics**: Tuple preservation and type inference make the library pleasant to use
3. **Predictability**: `this: void` ensures referential transparency
4. **Compile-Time Correctness**: Discriminated unions and exhaustiveness checking catch errors at compile time

The library prioritizes **zero runtime surprises** by pushing as much validation and checking into TypeScript's type system as possible.
