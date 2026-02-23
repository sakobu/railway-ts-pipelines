# Getting Started

A guided walkthrough. Each section introduces one concept, building to a complete pipeline by the end.

---

## Step 1: Result -- Success or Failure

Every function that can fail returns a `Result` -- either `Ok` with a value, or `Err` with an error. No exceptions, no special return conventions, just data.

```typescript
import { ok, err, isOk, isErr } from '@railway-ts/pipelines/result';

const divide = (a: number, b: number) => (b === 0 ? err('Cannot divide by zero') : ok(a / b));

const result = divide(10, 2);

if (isOk(result)) {
  console.log(result.value); // 5
}

if (isErr(result)) {
  console.error(result.error);
}
```

This is the fundamental building block. Functions don't throw -- they return a value that tells you what happened.

---

## Step 2: map and flatMap -- Transform Without Unwrapping

```typescript
const result = divide(10, 2);
if (isOk(result)) {
  const doubled = result.value * 2;
  // ... now what? wrap it again?
}
```

`map` transforms the value inside an `Ok` without unwrapping it. If the `Result` is an `Err`, the transformation is skipped entirely:

```typescript
import { ok, err, map } from '@railway-ts/pipelines/result';

const doubled = map(ok(5), (x) => x * 2);
// Ok(10)

const failed = map(err('nope'), (x) => x * 2);
// Err('nope') -- transformation skipped, error passed through
```

`flatMap` is similar, but for transformations that themselves return a `Result`. This is how you chain operations where each step can fail:

```typescript
import { ok, err, flatMap } from '@railway-ts/pipelines/result';

const divide = (a: number, b: number) => (b === 0 ? err('div by zero') : ok(a / b));

const result = flatMap(ok(10), (x) => divide(x, 2));
// Ok(5)

const result2 = flatMap(ok(10), (x) => divide(x, 0));
// Err('div by zero')
```

The error propagates automatically. No if-checks, no try-catch.

---

## Step 3: pipe -- Build a Pipeline

Nesting `map` and `flatMap` calls gets awkward fast:

```typescript
// This gets hard to read
const result = map(
  flatMap(
    map(ok(10), (x) => x + 1),
    (x) => divide(x, 3),
  ),
  (x) => x * 2,
);
```

`pipe` lets you write the same thing as a top-to-bottom flow. Each step receives the output of the previous step:

```typescript
import { pipe } from '@railway-ts/pipelines/composition';
import { ok, mapWith, flatMapWith } from '@railway-ts/pipelines/result';

const divide = (a: number, b: number) => (b === 0 ? err('div by zero') : ok(a / b));

const result = pipe(
  ok(10),
  mapWith((x) => x + 1), // Ok(11)
  flatMapWith((x) => divide(x, 3)), // Ok(3.666...)
  mapWith((x) => x * 2), // Ok(7.333...)
);
```

The `With` suffix (`mapWith`, `flatMapWith`) means "curried" -- the function takes the transformation first and returns a function that takes the `Result`. This is what makes them composable inside `pipe`.

If any step produces an `Err`, everything after it is skipped:

```typescript
const result = pipe(
  ok(10),
  mapWith((x) => x + 1), // Ok(11)
  flatMapWith((x) => divide(x, 0)), // Err('div by zero')
  mapWith((x) => x * 2), // skipped
  mapWith((x) => x + 100), // skipped
);
// Err('div by zero')
```

> The `With` suffix pattern you've been using is called **point-free composition** -- see [Recipes: Point-Free Composition](RECIPES.md#point-free-composition) for more advanced uses like `flow` + point-free pipelines.

---

## Step 4: match -- Handle Both Cases

At the end of a pipeline, you need to do something with the result. `match` forces you to handle both `Ok` and `Err` -- TypeScript won't let you forget a branch:

```typescript
import { pipe } from '@railway-ts/pipelines/composition';
import { ok, mapWith, flatMapWith, match } from '@railway-ts/pipelines/result';

const result = pipe(
  ok(10),
  mapWith((x) => x + 1),
  flatMapWith((x) => divide(x, 3)),
);

match(result, {
  ok: (value) => console.log(`Result: ${value}`),
  err: (error) => console.error(`Error: ${error}`),
});
```

That's the core pattern: build a pipeline with `pipe`, transform with `map`/`flatMap`, branch once at the end with `match`.

---

## Step 5: Option -- Handle Missing Values

`Result` handles success vs. failure. `Option` handles presence vs. absence -- a value that may or may not exist. `Some` holds a value, `None` means nothing is there. The same `map`/`pipe`/`match` patterns you already know apply here.

The most common entry point is `fromNullable`, which wraps a value that might be `null` or `undefined`:

```typescript
import { pipe } from '@railway-ts/pipelines/composition';
import { fromNullable, mapWith, filterWith, match } from '@railway-ts/pipelines/option';

const users = {
  u1: { name: 'Alice', age: 30 },
  u2: { name: 'Bob', age: 17 },
};

const greetAdult = (id: string) => {
  const result = pipe(
    fromNullable(users[id]), // Option<{ name, age }>
    filterWith((u) => u.age >= 18), // None if under 18
    mapWith((u) => `Hello, ${u.name}!`),
  );

  return match(result, {
    some: (greeting) => greeting,
    none: () => 'User not found or not an adult',
  });
};

greetAdult('u1'); // "Hello, Alice!"
greetAdult('u2'); // "User not found or not an adult"
greetAdult('u3'); // "User not found or not an adult"
```

`Option` connects to `Result` through `mapToResult` -- it converts `None` into a typed error so you can continue in a Result pipeline:

```typescript
import { mapToResult, fromNullable } from '@railway-ts/pipelines/option';
import { match } from '@railway-ts/pipelines/result';

const option = fromNullable(users['u3']); // None
const result = mapToResult(option, 'User not found');
// Err('User not found')

match(result, {
  ok: (user) => console.log(user.name),
  err: (error) => console.error(error), // "User not found"
});
```

---

## Step 6: validate -- Parse Untrusted Data

So far we've been starting pipelines with `ok(10)` -- a known good value. In the real world, data comes from users, APIs, and databases. It's `unknown` until you check it.

The schema system validates untrusted data and returns a `Result`:

```typescript
import { validate, object, required, chain, string, parseNumber, min } from '@railway-ts/pipelines/schema';
import { match } from '@railway-ts/pipelines/result';

const userSchema = object({
  name: required(string()),
  age: required(chain(parseNumber(), min(18))),
});

const result = validate({ name: 'Alice', age: '25' }, userSchema);

match(result, {
  ok: (user) => console.log(user),
  // { name: 'Alice', age: 25 } -- age was parsed from string to number
  err: (errors) => console.error(errors),
  // every validation error, with field paths
});
```

Validators compose with `chain` -- each step feeds into the next. `parseNumber()` converts a string to a number, then `min(18)` checks the range. If any step fails, the error includes the field path so you know exactly where the problem is.

All errors are collected, not just the first one:

```typescript
const result = validate({ name: 123, age: 'not a number' }, userSchema);

match(result, {
  ok: (user) => console.log(user),
  err: (errors) => {
    // [
    //   { path: ['name'], message: 'Must be a string' },
    //   { path: ['age'], message: 'Must be a valid number' },
    // ]
  },
});
```

> **Tip:** If you only need the first error (for performance or UX), pass `{ abortEarly: true }`:
>
> ```typescript
> const result = validate(input, userSchema, { abortEarly: true });
> // stops at the first failing field
> ```
>
> See [Recipes: Abort Early](RECIPES.md#abort-early) for details.

---

## Step 7: Putting It All Together

Now you have all the pieces. Here's a complete pipeline that validates input, transforms it, and handles the result. This example uses `fromPromiseWithError` to safely convert Promises that can reject into `Result` values:

```typescript
import { pipeAsync } from '@railway-ts/pipelines/composition';
import { flatMapWith, mapWith, match, fromPromiseWithError } from '@railway-ts/pipelines/result';
import {
  validate,
  object,
  required,
  chain,
  string,
  parseNumber,
  min,
  email,
  formatErrors,
} from '@railway-ts/pipelines/schema';

// 1. Define the shape of valid input
const orderSchema = object({
  email: required(chain(string(), email())),
  quantity: required(chain(parseNumber(), min(1))),
  item: required(string()),
});

// 2. Business logic as plain functions that return Results
const checkInventory = (order: { item: string; quantity: number }) =>
  // fromPromiseWithError wraps a Promise into a Result,
  // mapping rejection through your error function
  fromPromiseWithError(
    fetch(`/api/inventory/${order.item}`).then((r) => r.json()),
    () => [{ path: ['item'], message: 'Inventory check failed' }],
  );

// 3. The pipeline
const processOrder = async (input: unknown) => {
  const result = await pipeAsync(
    validate(input, orderSchema),
    flatMapWith(checkInventory),
    mapWith((inv) => ({
      confirmed: true,
      available: inv.inStock,
    })),
  );

  return match(result, {
    ok: (order) => ({ success: true, data: order }),
    err: (errors) => ({ success: false, errors: formatErrors(errors) }),
  });
};
```

---

## What's Next

You now understand the core: `Result`, `Option`, `map`, `flatMap`, `pipe`, `match`, `validate`.

- **[Recipes](RECIPES.md)** -- Patterns for real work: async pipelines, error recovery, validation, Standard Schema
- **[API Reference](API.md)** -- Every function signature and description
