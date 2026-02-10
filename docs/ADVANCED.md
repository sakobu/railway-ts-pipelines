# Advanced Implementation Details

Most users won't need this. But if you're curious how the library achieves its type safety and ergonomics, here's what's going on under the hood.

---

## Symbol Branding

Both `Option` and `Result` use symbol branding to prevent structural typing issues.

```typescript
const OPTION_BRAND = Symbol('OPTION_BRAND');
const RESULT_BRAND = Symbol('RESULT_BRAND');

type Option<T> =
  | { readonly some: true; readonly value: T; readonly [OPTION_BRAND]: 'some' }
  | { readonly some: false; readonly [OPTION_BRAND]: 'none' };
```

### Why Symbol Branding?

Prevents accidental duck typing where plain objects might be mistakenly treated as `Option` or `Result` types:

```typescript
// BAD: Without branding
const fakeOption = { some: true, value: 42 };
// Could be accidentally treated as Option<number> due to structural typing

// GOOD: With branding
const fakeOption = { some: true, value: 42 };
// Type error: missing [OPTION_BRAND] symbol
// Only way to create valid Options is through some() or none()
```

This ensures that only values created through the library's constructors (`some`, `none`, `ok`, `err`) can be used as `Option` or `Result` types. Prevents subtle bugs from structural compatibility.

---

## Tuple-Preserving Combinators

Both `combine()` functions use 10 overloads to preserve exact tuple types instead of widening to arrays.

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

### Benefits

Type-safe destructuring where TypeScript knows the exact type at each position:

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
  err: (errors) => {
    // errors is ValidationError[]
  },
});
```

### Implementation

Uses 10 overloads to handle up to 10 items. For arrays longer than 10, falls back to array types. This covers 99% of real-world use cases without infinite overloads.

---

## Type Inference

The schema system uses conditional types, mapped types, and type composition to infer output types from validators.

```typescript
type InferSchemaType<V> = ProcessType<InferType<V>>;

const userSchema = object({
  name: required(string()),
  age: required(parseNumber()),
  email: optional(string()),
});

type User = InferSchemaType<typeof userSchema>;
// { name: string; age: number; email?: string }
```

This happens at compile time with zero runtime overhead. The types are purely for TypeScript's benefit.

---

## `this: void` for Referential Transparency

The composition functions (`pipe`, `flow`, `pipeAsync`, `flowAsync`) annotate their callback parameters with `this: void` to ensure they don't depend on `this` context:

```typescript
export function pipe<A, B>(a: A, ab: (this: void, a: A) => B): B;
export function pipe<A, B, C>(a: A, ab: (this: void, a: A) => B, bc: (this: void, b: B) => C): C;
```

### Why?

Prevents bugs from lost context when composing functions:

```typescript
// Without this: void
const obj = { transform: (x: number) => x * 2 };
pipe(5, obj.transform); // Might break if transform uses 'this'

// With this: void
// TypeScript catches methods that depend on 'this' context
// Forces all composed functions to be pure and context-free
```

Makes all composed functions referentially transparent — they behave the same regardless of how they're called.

---

## Discriminated Unions

`Result` and `Option` use discriminated unions for exhaustive pattern matching:

```typescript
type Result<T, E> =
  | { readonly ok: true; readonly value: T; readonly [RESULT_BRAND]: 'ok' }
  | { readonly ok: false; readonly error: E; readonly [RESULT_BRAND]: 'error' };
```

TypeScript's control flow analysis narrows types with the type guards:

```typescript
import { isOk, isErr } from '@railway-ts/pipelines/result';

if (isOk(result)) {
  // TypeScript knows result.value exists
  console.log(result.value);
}

if (isErr(result)) {
  // TypeScript knows result.error exists
  console.log(result.error);
}
```

The `match` function enforces exhaustiveness at compile time:

```typescript
// Compile error if you forget a branch
match(result, {
  ok: (value) => console.log(value),
  // Error: Property 'err' is missing
});
```

---

## Design Philosophy

These features support the core design:

1. **Type Safety** - Symbol branding prevents structural typing issues
2. **Ergonomics** - Tuple preservation and type inference make the library pleasant
3. **Predictability** - `this: void` ensures referential transparency
4. **Compile-Time Correctness** - Discriminated unions and exhaustiveness checking catch errors at compile time

The library prioritizes **zero runtime surprises** by pushing as much validation and checking into TypeScript's type system as possible.

---

## Next Steps

-> **[Recipes](RECIPES.md)** - Patterns: point-free composition, error recovery, async pipelines
-> **[API Reference](../README.md)** - Full function catalog
