# Common Patterns

## Point-Free Composition

**This is why you're reading this document.**

Eliminate wrapper lambdas in pipelines with curried helpers. These are exported from both the `result` and `option` modules.

### The Problem

```typescript
// Ugly: repetitive wrapper lambdas
const result = pipe(
  ok(5),
  (r) => map(r, (x) => x * 2),
  (r) => map(r, (x) => x + 1),
  (r) => flatMap(r, (x) => divide(x, 3)),
);
```

### The Solution

```typescript
// Clean: point-free composition
const result = pipe(
  ok(5),
  mapWith((x) => x * 2),
  mapWith((x) => x + 1),
  flatMapWith((x) => divide(x, 3)),
);
```

### Result Helpers

```typescript
import { mapWith, flatMapWith, mapErrWith, filterWith, tapWith, tapErrWith } from '@railway-ts/pipelines/result';
```

### Option Helpers

```typescript
import { mapWith, flatMapWith, filterWith, tapWith } from '@railway-ts/pipelines/option';
```

### Usage

```typescript
import { flow } from '@railway-ts/pipelines/composition';
import { mapWith, flatMapWith, tapWith } from '@railway-ts/pipelines/result';
import { validate } from '@railway-ts/pipelines/schema';

const processData = flow(
  (input: unknown) => validate(input, schema),
  mapWith(transformData),
  flatMapWith(validateBusinessRules),
  tapWith((data) => console.log('Processing:', data)),
  mapWith(enrichData),
);
```

---

## Error Accumulation

Collect all validation errors instead of failing on the first one.

```typescript
import { combineAll } from '@railway-ts/pipelines/result';
import { validate, type ValidationError } from '@railway-ts/pipelines/schema';

const validateFields = (data: unknown) => {
  const name = validate(data.name, nameSchema);
  const email = validate(data.email, emailSchema);
  const age = validate(data.age, ageSchema);

  return combineAll([name, email, age]);
  // Result<[string, string, number], ValidationError[]>
};

match(validateFields(input), {
  ok: ([name, email, age]) => createUser({ name, email, age }),
  err: (errors) => displayAllErrors(errors),
});
```

---

## Async Patterns

### Sequential Steps

```typescript
import { flatMapWith } from '@railway-ts/pipelines/result';
import { pipeAsync } from '@railway-ts/pipelines/composition';

const processOrder = async (input: unknown) => {
  const result = await pipeAsync(
    validate(input, orderSchema),
    flatMapWith(validateInventory),
    flatMapWith(chargePayment),
    flatMapWith(createShipment),
  );

  return match(result, {
    ok: (order) => ({ success: true, order }),
    err: (error) => ({ success: false, error }),
  });
};
```

### Mixing Sync and Async

```typescript
const process = async (input: unknown) =>
  await pipeAsync(
    validate(input, schema), // sync
    mapWith(enrichData), // sync
    flatMapWith(fetchDB), // async
    mapWith(transform), // sync
    flatMapWith(saveDB), // async
  );
```

---

## Converting Legacy Code

### Wrapping Try-Catch

```typescript
import { fromTry } from '@railway-ts/pipelines/result';

// Legacy code that throws
const parseConfig = (text: string) => JSON.parse(text);

// Wrapped
const safeParseConfig = (text: string) => fromTry(() => parseConfig(text));

const config = safeParseConfig(input);
// Result<any, string>
```

### Wrapping Promises

```typescript
import { fromPromise } from '@railway-ts/pipelines/result';

// Legacy async code
const fetchUser = async (id: string) => {
  const response = await fetch(`/api/users/${id}`);
  return response.json();
};

// Wrapped
const safeFetchUser = async (id: string) => fromPromise(fetchUser(id));

const user = await safeFetchUser('123');
// Result<User, string>
```

### Wrapping Nullable Returns

```typescript
import { fromNullable } from '@railway-ts/pipelines/option';

// Legacy code that returns null
const findUser = (id: string): User | null => {
  /* ... */
};

// Wrapped
const safeFindUser = (id: string) => fromNullable(findUser(id));

const user = safeFindUser('123');
// Option<User>
```

---

## Validation Patterns

### Multi-Step Validation

```typescript
const validateAndTransform = flow(
  (input: unknown) => validate(input, inputSchema),
  (r) => flatMap(r, (data) => validateBusinessRules(data)),
  (r) => flatMap(r, (data) => checkAgainstDatabase(data)),
  (r) => map(r, (data) => transformForStorage(data)),
);
```

### Conditional Validation

```typescript
const validateConditionally = (input: unknown) => {
  const baseResult = validate(input, baseSchema);

  return flatMap(baseResult, (data) => {
    if (data.type === 'premium') {
      return validate(data, premiumSchema);
    }
    return ok(data);
  });
};
```

### Validation with Side Effects

```typescript
const validateAndLog = flow(
  (input: unknown) => validate(input, schema),
  (r) => tap(r, (data) => logger.info('Validated:', data)),
  (r) => tapErr(r, (errors) => logger.error('Failed:', errors)),
);
```

---

## Type Narrowing

### Custom Type Guards

```typescript
const isPositive = (n: number): Result<number, string> => (n > 0 ? ok(n) : err('Must be positive'));

const isEven = (n: number): Result<number, string> => (n % 2 === 0 ? ok(n) : err('Must be even'));

const validateNumber = flow((n: number) =>
  pipe(
    n,
    (x) => isPositive(x),
    (r) => flatMap(r, isEven),
  ),
);
```

### Discriminated Unions

```typescript
import { discriminatedUnion, literal, object } from '@railway-ts/pipelines/schema';

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

const result = validate(input, shapeSchema);

match(result, {
  ok: (shape) => {
    // TypeScript knows shape.type is 'circle' | 'rectangle'
    if (shape.type === 'circle') {
      return Math.PI * shape.radius ** 2;
    } else {
      return shape.width * shape.height;
    }
  },
  err: (errors) => 0,
});
```

---

## Combining Multiple Data Sources

```typescript
import { combine } from '@railway-ts/pipelines/result';

const fetchUserData = async (userId: string) => {
  const [profile, settings, preferences] = await Promise.all([
    fetchProfile(userId),
    fetchSettings(userId),
    fetchPreferences(userId),
  ]);

  // Combine all results, fail if any failed
  return combine([profile, settings, preferences]);
  // Result<[Profile, Settings, Preferences], Error>
};

const data = await fetchUserData('123');

match(data, {
  ok: ([profile, settings, preferences]) => {
    // All three succeeded, full type safety
    return { profile, settings, preferences };
  },
  err: (error) => {
    // One or more failed
    return null;
  },
});
```

---

## Reusable Validators

```typescript
import { chain, string, pattern } from '@railway-ts/pipelines/schema';

// Reusable validators
const email = () => chain(string(), pattern(/^[^@]+@[^@]+\.[^@]+$/));

const phoneUS = () => chain(string(), pattern(/^\d{3}-\d{3}-\d{4}$/));

const zipCode = () => chain(string(), pattern(/^\d{5}$/));

// Compose into larger schemas
const contactSchema = object({
  email: required(email()),
  phone: optional(phoneUS()),
  zip: required(zipCode()),
});
```

---

## Testing Pipelines

```typescript
import { isOk, isErr } from '@railway-ts/pipelines/result';

test('validates user input', () => {
  const result = validateUser({ name: 'Alice', age: 25 });

  expect(isOk(result)).toBe(true);
  if (isOk(result)) {
    expect(result.value.name).toBe('Alice');
  }
});

test('rejects invalid age', () => {
  const result = validateUser({ name: 'Bob', age: -5 });

  expect(isErr(result)).toBe(true);
  if (isErr(result)) {
    expect(result.error).toContain('age');
  }
});
```
