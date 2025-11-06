# Getting Started with @railway-ts/pipelines

Welcome! This guide will help you get up and running with railway-oriented programming in TypeScript.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Your First Pipeline](#your-first-pipeline)
- [Running the Examples](#running-the-examples)
- [Complete Pipeline Example](#complete-pipeline-example)
- [What's Next](#whats-next)

---

## Prerequisites

- Node.js 18+ or Bun
- TypeScript 5.0+
- Basic understanding of TypeScript and functional programming concepts

---

## Installation

```bash
bun add @railway-ts/pipelines
# or npm install @railway-ts/pipelines
# or pnpm add @railway-ts/pipelines
# or yarn add @railway-ts/pipelines
```

---

## Your First Pipeline

Let's build a simple data pipeline that validates input, transforms it, and handles errors gracefully.

```typescript
import { pipe } from '@railway-ts/pipelines/composition';
import { ok, match, andThen } from '@railway-ts/pipelines/result';
import { validate, object, required, chain, parseNumber, min, formatErrors } from '@railway-ts/pipelines/schema';

// 1. Define schema (validates + transforms unknown -> typed data)
const schema = object({
  x: required(chain(parseNumber(), min(0))),
  y: required(chain(parseNumber(), min(1))),
});

// 2. Build pipeline (validate -> transform -> compute)
async function compute(input: unknown) {
  const result = await pipe(
    validate(input, schema), // unknown -> Result<{x: number, y: number}, Error[]>
    (r) => andThen(r, ({ x, y }) => ok(x / y)), // stays on rails
  );

  // 3. Branch once at the end
  return match(result, {
    ok: (value) => ({ valid: true, data: value }),
    err: (errors) => ({ valid: false, errors: formatErrors(errors) }),
  });
}

// Try it out
const goodInput = { x: '10', y: '2' };
const result1 = await compute(goodInput);
// { valid: true, data: 5 }

const badInput = { x: '-5', y: '0' };
const result2 = await compute(badInput);
// { valid: false, errors: { x: "Must be at least 0", y: "Must be at least 1" } }
```

**Key insight**: After validation, you never check for errors again. The railway pattern propagates them automatically.

---

## Running the Examples

The library includes 12+ runnable examples organized by category. Here's how to explore them:

### Quick Setup

```bash
# Clone and setup
git clone https://github.com/sakobu/railway-ts-pipelines.git
cd railway-ts-pipelines
bun install

# Run all examples
bun run examples/index.ts
```

### Run Specific Examples

#### Option & Result

```bash
# Optional values - Safe nullable handling
bun run examples/option/option-examples.ts

# Error handling - Explicit success/failure
bun run examples/result/result-examples.ts

# Converting between types
bun run examples/interop/interop-examples.ts
```

#### Schema Validation

```bash
# Basic validators - strings, numbers, booleans
bun run examples/schema/basic.ts

# Union types & enums - discriminated unions
bun run examples/schema/union.ts

# Tuple validation - fixed-length arrays with type safety
bun run examples/schema/tuple.ts
```

#### Composition Patterns

```bash
# Currying - partial application
bun run examples/composition/curry-basics.ts

# Tuple transformations - working with arrays
bun run examples/composition/tupled-basics.ts

# Advanced patterns - combining techniques
bun run examples/composition/advanced-composition.ts
```

#### Real-World Pipelines

```bash
# API integration - basic async pipeline
bun run examples/complete-pipelines/async.ts

# Rocket launch decision system - validation + API + logic
bun run examples/complete-pipelines/async-launch.ts

# Orbital mechanics - Hohmann transfer calculations
bun run examples/complete-pipelines/hohmann-transfer.ts

# Spacecraft rendezvous - Hill-Clohessy-Wiltshire equations
bun run examples/complete-pipelines/hill-clohessy-wiltshire.ts
```

### What Each Category Demonstrates

| Category               | What You'll Learn                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------ |
| **Option**             | Safe nullable handling, configuration defaults, optional values in arrays            |
| **Result**             | Explicit error handling, JSON parsing safety, operation chaining                     |
| **Schema**             | Validation + transformation, type inference, nested objects, tuples, union types     |
| **Composition**        | Function piping, currying for partial application, data flow patterns                |
| **Complete Pipelines** | End-to-end: validation -> API calls -> computation -> decision making                |

**Pro tip:** Start with `examples/complete-pipelines/async.ts` to see the full pattern in action, then explore the building blocks.

---

## Complete Pipeline Example

Let's build a real-world application: a rocket launch decision system that validates input, fetches weather data, and determines if conditions are safe for launch.

### The Problem

We need to:

1. Validate launch parameters (vehicle type, payload weight, coordinates)
2. Fetch real-time weather data from an API
3. Check if wind conditions are within limits
4. Return a GO/NO GO decision

### The Solution: Railway-Oriented Pipeline

```typescript
import { pipe } from '@railway-ts/pipelines/composition';
import { ok, err, match, andThen, fromPromise, type Result } from '@railway-ts/pipelines/result';
import {
  validate,
  object,
  required,
  chain,
  parseNumber,
  min,
  max,
  stringEnum,
  formatErrors,
  type InferSchemaType,
  type ValidationError,
} from '@railway-ts/pipelines/schema';

// Step 1: Define schema at boundary
const launchSchema = object({
  vehicleType: required(stringEnum(['falcon9', 'atlas5'] as const)),
  payload: required(chain(parseNumber(), min(1000), max(25_000))),
  latitude: required(chain(parseNumber(), min(-90), max(90))),
  longitude: required(chain(parseNumber(), min(-180), max(180))),
});

type LaunchParams = InferSchemaType<typeof launchSchema>;

// Step 2: Pure business logic (works with validated types)
const fetchWeather = async (
  params: LaunchParams,
): Promise<Result<{ params: LaunchParams; weather: any }, ValidationError[]>> => {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.append('latitude', params.latitude.toString());
  url.searchParams.append('longitude', params.longitude.toString());
  url.searchParams.append('current', 'wind_speed_10m,wind_gusts_10m');

  const result = await fromPromise(fetch(url.toString()).then((r) => r.json()));

  return match(result, {
    ok: (data) => ok({ params, weather: data.current }),
    err: (e) => err([{ path: ['weather_api'], message: String(e) }]),
  });
};

const assessLaunch = async (context: {
  params: LaunchParams;
  weather: any;
}): Promise<Result<{ recommendation: 'GO' | 'NO GO'; reason: string }, ValidationError[]>> => {
  const limits = { falcon9: 15, atlas5: 12 };
  const maxWind = limits[context.params.vehicleType];
  const actual = Math.max(context.weather.wind_speed_10m, context.weather.wind_gusts_10m);
  const go = actual <= maxWind;

  return ok({
    recommendation: go ? 'GO' : 'NO GO',
    reason: go ? 'Conditions nominal' : 'Wind exceeds limits',
  });
};

// Step 3: Compose pipeline (validate -> fetch -> assess)
async function evaluateLaunch(input: unknown) {
  const result = await pipe(
    validate(input, launchSchema), // Boundary: unknown -> Result<LaunchParams, Error[]>
    (r) => andThen(r, fetchWeather), // Async: fetch weather data
    (r) => andThen(r, assessLaunch), // Async: assess conditions
  );

  // Step 4: Branch once at the end
  return match(result, {
    ok: (decision) => ({ valid: true, data: decision }),
    err: (errors) => ({ valid: false, errors: formatErrors(errors) }),
  });
}

// Try it out
const launchInput = {
  vehicleType: 'falcon9',
  payload: '22800',
  latitude: '28.5729', // Kennedy Space Center
  longitude: '-80.6490',
};

const decision = await evaluateLaunch(launchInput);
console.log(decision);
// If weather is good: { valid: true, data: { recommendation: 'GO', reason: 'Conditions nominal' } }
// If wind is high: { valid: true, data: { recommendation: 'NO GO', reason: 'Wind exceeds limits' } }
// If input is invalid: { valid: false, errors: { ... } }
```

### What's Happening Here

**1. Validation at the Boundary**

```typescript
validate(input, launchSchema); // unknown -> Result<LaunchParams, Error[]>
```

- Untrusted input enters as `unknown`
- Schema validates AND transforms: `"22800"` becomes `22800` (number)
- If validation fails, we get structured error messages
- If it succeeds, TypeScript knows we have valid data

**2. The Railway Track**

```typescript
(r) => andThen(r, fetchWeather)  // Stay on the rails
(r) => andThen(r, assessLaunch)  // Continue on the rails
```

- `andThen` chains async operations
- If validation failed, `fetchWeather` never runs
- If API call fails, `assessLaunch` never runs
- Errors automatically propagate through the pipeline

**3. Branch Once at the End**

```typescript
match(result, {
  ok: (decision) => ({ valid: true, data: decision }),
  err: (errors) => ({ valid: false, errors: formatErrors(errors) }),
});
```

- No manual error checking in the middle
- Pattern matching forces you to handle both cases
- All error types (validation, network, business logic) are handled uniformly

### Key Benefits

- **No try/catch blocks** - Errors are values
- **No manual checking** - Railway pattern handles propagation
- **Type safety throughout** - TypeScript tracks types at every step
- **Single branching point** - Handle success/failure once at the end
- **Composable** - Easy to add new steps to the pipeline

---

## What's Next?

Now that you've seen the basics, here are your next steps:

### Learn the Building Blocks

Explore each core concept in depth:

- **[Option Type](README.md#option-handle-absence-as-data)** - Handle absence as data instead of null/undefined
- **[Result Type](README.md#result-railway-oriented-error-handling)** - Explicit error handling without exceptions
- **[Schema Validation](README.md#schema-parse-dont-validate)** - Parse and validate data at boundaries
- **[Composition Utilities](README.md#composition-build-complex-pipelines)** - Build complex data flows with pipe and flow

### API Reference

Full documentation for all functions:

- **Option**: [`src/option/option.ts`](src/option/option.ts) - 21 functions
- **Result**: [`src/result/result.ts`](src/result/result.ts) - 27 functions
- **Composition**: [`src/composition/`](src/composition/) - 6 utilities
- **Schema**: [`src/schema/`](src/schema/) - 50+ validators

### Advanced Topics

Deep dive into implementation details:

- **[Advanced Documentation](docs/ADVANCED.md)** - Symbol branding, type inference, tuple-preserving combinators

### Contributing

Want to contribute? Check out:

- **[Contributing Guide](CONTRIBUTING.md)** - Development setup, code style, testing patterns

---

## Questions?

- **Bug reports**: [Open an issue](https://github.com/sakobu/railway-ts-pipelines/issues) with a minimal reproduction
- **Feature requests**: [Open an issue](https://github.com/sakobu/railway-ts-pipelines/issues) describing the use case
- **Questions**: [Start a discussion](https://github.com/sakobu/railway-ts-pipelines/discussions)

---

---

**Happy pipeline building!**
