# Recipes

Patterns and techniques. Each recipe is self-contained.

---

## Point-Free Composition

Eliminate wrapper lambdas in pipelines with curried helpers. Exported from both `result` and `option` modules.

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
import { mapWith, flatMapWith, filterWith, tapWith, mapToResultWith } from '@railway-ts/pipelines/option';
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

## Async Pipelines

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

### Parallel Execution in Object Schemas

When an `object()` schema contains async validators, all fields are validated concurrently using `Promise.all`. This means three async field validators that each take 50ms finish in ~50ms total, not 150ms:

```typescript
import { object, required, chainAsync, string, refineAsync, validate } from '@railway-ts/pipelines/schema';

const signupSchema = object({
  email: required(
    chainAsync(
      string(),
      refineAsync(async (email) => {
        return !(await isEmailTaken(email)); // ~50ms
      }, 'Email already in use'),
    ),
  ),
  username: required(
    chainAsync(
      string(),
      refineAsync(async (name) => {
        return !(await isUsernameTaken(name)); // ~50ms
      }, 'Username taken'),
    ),
  ),
  invite: required(
    chainAsync(
      string(),
      refineAsync(async (code) => {
        return await isValidInvite(code); // ~50ms
      }, 'Invalid invite code'),
    ),
  ),
});

// All three checks run in parallel: ~50ms total, not ~150ms
const result = await validate(input, signupSchema);
```

This applies to `object()`, `tuple()`, and `tupleOf()`. If all validators in the schema are synchronous, the return type stays synchronous -- you don't pay for async when you don't use it.

### Mixing Sync and Async

`pipeAsync` awaits each step, so you can freely mix sync and async functions:

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

### Async Side Effects

`tapWith` accepts async functions. Side effects run without altering the Result:

```typescript
import { tapWith, tapErrWith } from '@railway-ts/pipelines/result';

const processAndAudit = async (input: unknown) =>
  await pipeAsync(
    validate(input, schema),
    flatMapWith(processPayment),
    tapWith(async (payment) => {
      await auditLog.write({ event: 'payment_processed', payment });
    }),
    tapErrWith(async (errors) => {
      await auditLog.write({ event: 'payment_failed', errors });
    }),
  );
```

### Reusable Async Pipelines

Use `flowAsync` to define an async pipeline as a reusable function:

```typescript
import { flowAsync } from '@railway-ts/pipelines/composition';
import { mapWith, flatMapWith, tapWith } from '@railway-ts/pipelines/result';

const processOrder = flowAsync(
  (input: unknown) => validate(input, orderSchema),
  flatMapWith(validateInventory),
  flatMapWith(chargePayment),
  tapWith(async (order) => {
    await sendConfirmationEmail(order);
  }),
  flatMapWith(createShipment),
);

// Use it
const result = await processOrder(rawInput);
```

---

## Validation Patterns

### Multi-Step Validation

```typescript
import { flow } from '@railway-ts/pipelines/composition';
import { mapWith, flatMapWith, tapWith, tapErrWith } from '@railway-ts/pipelines/result';

const validateAndTransform = flow(
  (input: unknown) => validate(input, inputSchema),
  flatMapWith(validateBusinessRules),
  flatMapWith(checkAgainstDatabase),
  mapWith(transformForStorage),
);
```

### Cross-Field Validation

Use `refineAt` after `object()` to validate relationships between fields. Errors are attached to a specific path:

```typescript
import { object, required, string, chain, refineAt } from '@railway-ts/pipelines/schema';

const signupSchema = chain(
  object({
    password: required(string()),
    confirmPassword: required(string()),
  }),
  refineAt('confirmPassword', (data) => data.password === data.confirmPassword, 'Passwords must match'),
);

const result = validate({ password: 'abc', confirmPassword: 'xyz' }, signupSchema);
// Err([{ path: ['confirmPassword'], message: 'Passwords must match' }])
```

### Formatting Errors for UI

`formatErrors` flattens `ValidationError[]` into `Record<string, string>` keyed by dot-path. `ROOT_ERROR_KEY` (`"_root"`) is used for errors without a field path:

```typescript
import { validate, formatErrors, ROOT_ERROR_KEY } from '@railway-ts/pipelines/schema';
import { match } from '@railway-ts/pipelines/result';

const result = validate(input, schema);

match(result, {
  ok: (data) => submitForm(data),
  err: (errors) => {
    const formatted = formatErrors(errors);
    // { name: 'Required', 'address.zip': 'Must be 5 digits', _root: 'Form invalid' }

    // Wire to form state
    for (const [field, message] of Object.entries(formatted)) {
      if (field === ROOT_ERROR_KEY) {
        showBanner(message);
      } else {
        setFieldError(field, message);
      }
    }
  },
});
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
  tapWith((data) => logger.info('Validated:', data)),
  tapErrWith((errors) => logger.error('Failed:', errors)),
);
```

---

## Combining Results

### `combine` -- Fail on First Error

Use when you need all results to succeed. Returns the first error encountered:

```typescript
import { combine } from '@railway-ts/pipelines/result';

const fetchUserData = async (userId: string) => {
  const [profile, settings, preferences] = await Promise.all([
    fetchProfile(userId),
    fetchSettings(userId),
    fetchPreferences(userId),
  ]);

  return combine([profile, settings, preferences]);
  // Result<[Profile, Settings, Preferences], Error>
};

match(await fetchUserData('123'), {
  ok: ([profile, settings, preferences]) => {
    // All three succeeded, full type safety
    return { profile, settings, preferences };
  },
  err: (error) => handleError(error),
});
```

### `combineAll` -- Collect All Errors

Use for form validation where you want to show every error at once:

```typescript
import { combineAll } from '@railway-ts/pipelines/result';

const validateForm = (data: { name: unknown; email: unknown; age: unknown }) => {
  const name = validate(data.name, nameSchema);
  const email = validate(data.email, emailSchema);
  const age = validate(data.age, ageSchema);

  return combineAll([name, email, age]);
  // Result<[string, string, number], ValidationError[][]>
};

match(validateForm(input), {
  ok: ([name, email, age]) => createUser({ name, email, age }),
  err: (errorGroups) => displayAllErrors(errorGroups.flat()),
});
```

### `partition` -- Keep Both Sides

When you need both successes and failures from a batch operation:

```typescript
import { ok, err, partition } from '@railway-ts/pipelines/result';

const results = users.map((user) => validateUser(user));
const { successes, failures } = partition(results);

console.log(`${successes.length} valid, ${failures.length} invalid`);
// Process valid users
saveUsers(successes);
// Report invalid ones
reportErrors(failures);
```

### When to Use Which

|                | `combine`                              | `combineAll`                     | `partition`                         |
| -------------- | -------------------------------------- | -------------------------------- | ----------------------------------- |
| **Stops at**   | First error                            | Collects all                     | Collects all                        |
| **Returns**    | `Result<T[], E>`                       | `Result<T[], E[]>`               | `{ successes: T[]; failures: E[] }` |
| **Error type** | `E` (single)                           | `E[]` (array of all)             | `E[]` (array of all)                |
| **Use case**   | Parallel fetches, dependent operations | Form validation (all-or-nothing) | Batch processing (partial success)  |

---

## Error Recovery

### `orElse` -- Fallback on Error

Recover from an `Err` by providing an alternative `Result`:

```typescript
import { ok, err, orElse } from '@railway-ts/pipelines/result';

const primary = err('primary failed');
const recovered = orElse(primary, (error) => ok('fallback value'));
// Ok('fallback value')
```

### `orElseWith` -- Curried for Pipelines

```typescript
import { pipe } from '@railway-ts/pipelines/composition';
import { orElseWith, flatMapWith, mapWith } from '@railway-ts/pipelines/result';

const fetchWithFallback = (id: string) =>
  pipe(
    fetchFromCache(id),
    orElseWith(() => fetchFromDatabase(id)),
    orElseWith(() => fetchFromBackupService(id)),
    mapWith(normalize),
  );
```

### `bimap` -- Transform Both Branches

Apply different transformations to `Ok` and `Err` in one step:

```typescript
import { bimap } from '@railway-ts/pipelines/result';

const result = bimap(
  fetchUser(id),
  (user) => user.displayName, // transform Ok
  (error) => `Failed: ${error.code}`, // transform Err
);
// Result<string, string>
```

---

## Discriminated Unions and Enums

### Discriminated Unions

```typescript
import { discriminatedUnion, literal, object, required, number } from '@railway-ts/pipelines/schema';

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

### Enum Validation

Three ways to validate enums, each for a different use case:

**`stringEnum`** -- String union types (most common):

```typescript
import { stringEnum } from '@railway-ts/pipelines/schema';

const roleValidator = stringEnum(['admin', 'editor', 'viewer'] as const);
// Validator<unknown, 'admin' | 'editor' | 'viewer'>

validate('admin', roleValidator); // Ok('admin')
validate('hacker', roleValidator); // Err(...)
```

**`enumValue`** -- TypeScript `enum` keyword:

```typescript
import { enumValue } from '@railway-ts/pipelines/schema';

enum Status {
  Active = 'active',
  Inactive = 'inactive',
}

const statusValidator = enumValue(Status);
// Validator<unknown, Status>

validate('active', statusValidator); // Ok(Status.Active)
```

**`oneOf`** -- Any fixed set of values:

```typescript
import { oneOf } from '@railway-ts/pipelines/schema';

const priorityValidator = oneOf([1, 2, 3] as const);
// Validator<unknown, 1 | 2 | 3>

validate(2, priorityValidator); // Ok(2)
validate(5, priorityValidator); // Err(...)
```

|                 | `stringEnum`        | `enumValue`      | `oneOf`              |
| --------------- | ------------------- | ---------------- | -------------------- |
| **Input**       | `readonly string[]` | TS `enum` object | `readonly T[]`       |
| **Output type** | String union        | Enum type        | Union of values      |
| **Use when**    | String literals     | TS enums         | Numbers, mixed types |

---

## Type Interop: Option, Result, Promise

Convert between `Option`, `Result`, and `Promise` when crossing module boundaries.

### Option -> Result

When an optional lookup needs to participate in a Result pipeline:

```typescript
import { fromNullable, mapToResult } from '@railway-ts/pipelines/option';

const users = new Map([['1', 'Alice']]);

const userResult = mapToResult(fromNullable(users.get('999')), 'User not found');
// Result<string, string> -- Err('User not found')
```

### Result -> Option

When you care about the value but not the specific error:

```typescript
import { fromTry, mapToOption } from '@railway-ts/pipelines/result';

const parsed = mapToOption(fromTry(() => JSON.parse(text)));
// Option<any> -- Some if parsed, None if threw
```

### Result -> Promise

Bridge into async code that expects thrown errors:

```typescript
import { err, ok, toPromise } from '@railway-ts/pipelines/result';

const value = await toPromise(ok(42));
// 42

await toPromise(err('boom'));
// throws 'boom'
```

### Mixed Workflow

```typescript
import { pipe } from '@railway-ts/pipelines/composition';
import { fromNullable, mapToResult } from '@railway-ts/pipelines/option';
import { err, flatMapWith, match, ok } from '@railway-ts/pipelines/result';

const getApiKey = () => fromNullable(process.env.API_KEY);

const callApi = (key: string) => (key === 'valid' ? ok('response data') : err('Invalid API key'));

const result = pipe(mapToResult(getApiKey(), 'API key not configured'), flatMapWith(callApi));

match(result, {
  ok: (data) => console.log(data),
  err: (error) => console.error(error),
});
```

---

## Specialized Validators

### Number Validators

```typescript
import { chain, parseNumber, positive, precision, min, max, integer, between } from '@railway-ts/pipelines/schema';

// Currency: positive, 2 decimal places
const currency = chain(parseNumber(), positive(), precision(2));

// Age: integer between 0 and 150
const age = chain(parseNumber(), integer(), between(0, 150));

// Temperature: any number in range
const temperature = chain(parseNumber(), min(-273.15), max(1_000_000));
```

### Date Validators

```typescript
import { chain, parseDate, parseISODate, todayOrFuture, pastDate, dateRange } from '@railway-ts/pipelines/schema';

// Booking date: must be in the future
const bookingDate = chain(parseDate(), todayOrFuture());

// Birth date: must be in the past
const birthDate = chain(parseDate(), pastDate());

// Event window: within a specific range
const eventDate = chain(parseISODate(), dateRange(new Date('2025-01-01'), new Date('2025-12-31')));
```

### Empty-String Handling

`emptyAsOptional` treats empty strings (and `null`/`undefined`) as `undefined` instead of failing validation. Useful for HTML forms where blank fields submit as `""`:

```typescript
import { object, required, optional, string, emptyAsOptional, chain, parseNumber } from '@railway-ts/pipelines/schema';

const formSchema = object({
  name: required(string()),
  nickname: optional(emptyAsOptional(string())), // "" -> undefined
  age: optional(emptyAsOptional(chain(parseNumber()))), // "" -> undefined, "25" -> 25
});

validate({ name: 'Alice', nickname: '', age: '' }, formSchema);
// Ok({ name: 'Alice' }) -- nickname and age are undefined, not errors
```

### Reusable Validators

```typescript
import { chain, object, optional, pattern, required, string } from '@railway-ts/pipelines/schema';

const email = () => chain(string(), pattern(/^[^@]+@[^@]+\.[^@]+$/));
const phoneUS = () => chain(string(), pattern(/^\d{3}-\d{3}-\d{4}$/));
const zipCode = () => chain(string(), pattern(/^\d{5}$/));

const contactSchema = object({
  email: required(email()),
  phone: optional(phoneUS()),
  zip: required(zipCode()),
});
```

---

## Standard Schema Interop

`toStandardSchema` wraps any validator as a [Standard Schema v1](https://github.com/standard-schema/standard-schema) object, making it compatible with tRPC, TanStack Form, React Hook Form, and other tools that accept Standard Schema.

```typescript
import { toStandardSchema, type StandardSchemaV1 } from '@railway-ts/pipelines/schema';

const userSchema = object({
  name: required(string()),
  age: required(chain(parseNumber(), min(18))),
});

const standardUser = toStandardSchema(userSchema);
// StandardSchemaV1<unknown, { name: string; age: number }>
```

Works with both sync and async validators:

```typescript
const asyncSchema = chainAsync(
  object({ email: required(string()) }),
  refineAtAsync(
    'email',
    async (data) => {
      const exists = await checkEmailExists(data.email);
      return !exists;
    },
    'Email already in use',
  ),
);

const standardAsync = toStandardSchema(asyncSchema);
// Can be passed to any Standard Schema consumer
```

---

## Composition Utilities

### `curry` / `uncurry` -- Partial Application

Convert multi-argument functions to chains of single-argument functions and back:

```typescript
import { curry, uncurry } from '@railway-ts/pipelines/composition';

const add = (a: number, b: number) => a + b;

const curriedAdd = curry(add);
const add5 = curriedAdd(5);
add5(3); // 8

// Reverse it
const originalAdd = uncurry(curriedAdd);
originalAdd(5, 3); // 8
```

### `tupled` / `untupled` -- Tuple Conversion

Convert between multi-argument and tuple-accepting functions. Pairs naturally with `combine`:

```typescript
import { tupled, untupled } from '@railway-ts/pipelines/composition';
import { combine, mapWith, match } from '@railway-ts/pipelines/result';
import { pipe } from '@railway-ts/pipelines/composition';

const createUser = (name: string, age: number) => ({ name, age });

const tupledCreate = tupled(createUser);
// ([string, number]) => { name: string; age: number }

// Combine validated fields, then pass the tuple directly
const result = pipe(combine([validateName(input.name), validateAge(input.age)]), mapWith(tupledCreate));
// Result<{ name: string; age: number }, ValidationError>

// Reverse it
const originalCreate = untupled(tupledCreate);
originalCreate('Alice', 30); // { name: 'Alice', age: 30 }
```

---

## Testing Pipelines

### Sync Pipelines

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

### Async Pipelines

```typescript
test('processes order end-to-end', async () => {
  const result = await processOrder({ item: 'widget', quantity: 5 });

  expect(isOk(result)).toBe(true);
  if (isOk(result)) {
    expect(result.value.status).toBe('shipped');
  }
});

test('rejects invalid quantity', async () => {
  const result = await processOrder({ item: 'widget', quantity: -1 });

  expect(isErr(result)).toBe(true);
});
```

---

## Full Example: Launch Decision Pipeline

Full pipeline: validate launch parameters, fetch weather data, make GO/NO-GO decision.

```typescript
import { pipeAsync } from '@railway-ts/pipelines/composition';
import { err, flatMapWith, fromPromise, match, ok, type Result } from '@railway-ts/pipelines/result';
import {
  formatErrors,
  object,
  required,
  chain,
  parseNumber,
  min,
  max,
  stringEnum,
  parseDate,
  validate,
  type ValidationError,
  type ValidationResult,
  type InferSchemaType,
} from '@railway-ts/pipelines/schema';

// Schema
const launchSchema = object({
  vehicleType: required(stringEnum(['falcon9', 'atlas5'] as const)),
  payload: required(chain(parseNumber(), min(1000), max(25_000))),
  latitude: required(chain(parseNumber(), min(-90), max(90))),
  longitude: required(chain(parseNumber(), min(-180), max(180))),
  windowStart: required(parseDate()),
});

type LaunchParams = InferSchemaType<typeof launchSchema>;
type VehicleType = LaunchParams['vehicleType'];

// Weather API types
type WeatherData = {
  wind_speed_10m: number;
  wind_direction_10m: number;
  wind_gusts_10m: number;
};

type LaunchContext = {
  params: LaunchParams;
  weather: WeatherData;
};

// Helper for API responses
const toJsonIfOk = (res: Response) => (res.ok ? res.json() : Promise.reject(`HTTP ${res.status}`));

// Fetch daily forecast for the launch window date
const fetchWeatherWithParams = async (params: LaunchParams): Promise<Result<LaunchContext, ValidationError[]>> => {
  const date = params.windowStart.toISOString().split('T')[0]!;
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.append('latitude', params.latitude.toString());
  url.searchParams.append('longitude', params.longitude.toString());
  url.searchParams.append('daily', 'wind_speed_10m_max,wind_direction_10m_dominant,wind_gusts_10m_max');
  url.searchParams.append('wind_speed_unit', 'ms');
  url.searchParams.append('start_date', date);
  url.searchParams.append('end_date', date);

  const result = await fromPromise(fetch(url.toString()).then(toJsonIfOk));

  return match(result, {
    ok: (data) =>
      ok({
        params,
        weather: {
          wind_speed_10m: data.daily.wind_speed_10m_max[0],
          wind_direction_10m: data.daily.wind_direction_10m_dominant[0],
          wind_gusts_10m: data.daily.wind_gusts_10m_max[0],
        },
      }),
    err: (msg) => err([{ path: ['weather_api'], message: String(msg) }]),
  });
};

type LaunchDecision = {
  windSpeed: number;
  windGusts: number;
  maxAllowed: number;
};

// Business rule check — can fail, so flatMapWith
const assessLaunchConditions = (context: LaunchContext): Result<LaunchDecision, ValidationError[]> => {
  const windLimits: Record<VehicleType, number> = {
    falcon9: 15,
    atlas5: 12,
  };

  const maxWind = windLimits[context.params.vehicleType];
  const actualMaxWind = Math.max(context.weather.wind_speed_10m, context.weather.wind_gusts_10m);

  if (actualMaxWind > maxWind) {
    return err([{ path: ['weather'], message: `Wind ${actualMaxWind} m/s exceeds ${maxWind} m/s limit` }]);
  }

  return ok({
    windSpeed: context.weather.wind_speed_10m,
    windGusts: context.weather.wind_gusts_10m,
    maxAllowed: maxWind,
  });
};

// Main pipeline
const evaluateLaunch = async (input: unknown): Promise<ValidationResult<LaunchDecision>> => {
  const validationResult = validate(input, launchSchema);

  const result = await pipeAsync(
    validationResult,
    flatMapWith(fetchWeatherWithParams),
    flatMapWith(assessLaunchConditions),
  );

  return match(result, {
    ok: (decision) => ({ valid: true as const, data: decision }),
    err: (errors) => ({ valid: false as const, errors: formatErrors(errors) }),
  });
};

// Usage
const result = await evaluateLaunch({
  vehicleType: 'falcon9',
  payload: 1000,
  latitude: 28.5721,
  longitude: -80.648,
  windowStart: new Date(),
});

console.log(result);
```

**The pattern:**

1. Validate at boundary with schema
2. Chain async operations with `pipeAsync` + `flatMapWith`
3. Pure business logic as sync functions that return `Result` (can fail via `Err`)
4. Branch once at the end with `match`

---

## Next Steps

- **[API Reference](API.md)** — Every function signature and description
