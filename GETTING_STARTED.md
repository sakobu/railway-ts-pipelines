# Getting Started

## Installation

```bash
bun add @railway-ts/pipelines
```

Requires TypeScript 5.0+ and Node.js 18+.

## First Pipeline

Build a pipeline that validates input, transforms it, and handles errors.

```typescript
import { pipe } from '@railway-ts/pipelines/composition';
import { ok, match, andThen } from '@railway-ts/pipelines/result';
import { validate, object, required, chain, parseNumber, min } from '@railway-ts/pipelines/schema';

// 1. Define schema
const schema = object({
  x: required(chain(parseNumber(), min(0))),
  y: required(chain(parseNumber(), min(1))),
});

// 2. Build pipeline
async function compute(input: unknown) {
  const result = await pipe(validate(input, schema), (r) => andThen(r, ({ x, y }) => ok(x / y)));

  return match(result, {
    ok: (value) => ({ valid: true, data: value }),
    err: (errors) => ({ valid: false, errors }),
  });
}

// 3. Use it
await compute({ x: '10', y: '2' });
// { valid: true, data: 5 }

await compute({ x: '-5', y: '0' });
// { valid: false, errors: [...] }
```

**Key point:** After validation, you never check for errors again. The pipeline propagates them automatically.

## Running Examples

The library includes examples for each module.

```bash
git clone https://github.com/sakobu/railway-ts-pipelines.git
cd railway-ts-pipelines
bun install

# Run all examples
bun run examples/index.ts

# Or run specific examples
bun run examples/option/option-examples.ts
bun run examples/result/result-examples.ts
bun run examples/schema/basic.ts
bun run examples/complete-pipelines/async.ts
```

**Example categories:**

- `option/` - Handling nullable values
- `result/` - Error handling patterns
- `schema/` - Validation examples (basic, union, tuple)
- `composition/` - Function composition patterns
- `complete-pipelines/` - Full pipelines with validation + async + logic

**Start here:** `examples/complete-pipelines/async.ts` shows the full pattern.

## Complete Example: Launch Decision System

Real-world example: validate launch parameters, fetch weather data, make GO/NO-GO decision.

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
  type InferSchemaType,
  type ValidationError,
} from '@railway-ts/pipelines/schema';

// Define schema
const launchSchema = object({
  vehicleType: required(stringEnum(['falcon9', 'atlas5'] as const)),
  payload: required(chain(parseNumber(), min(1000), max(25_000))),
  latitude: required(chain(parseNumber(), min(-90), max(90))),
  longitude: required(chain(parseNumber(), min(-180), max(180))),
});

type LaunchParams = InferSchemaType<typeof launchSchema>;

// Fetch weather data
const fetchWeather = async (params: LaunchParams): Promise<Result<any, ValidationError[]>> => {
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

// Make launch decision
const assessLaunch = async (context: any): Promise<Result<any, ValidationError[]>> => {
  const limits = { falcon9: 15, atlas5: 12 };
  const maxWind = limits[context.params.vehicleType];
  const actual = Math.max(context.weather.wind_speed_10m, context.weather.wind_gusts_10m);

  return ok({
    recommendation: actual <= maxWind ? 'GO' : 'NO GO',
    reason: actual <= maxWind ? `Wind ${actual} m/s within limits` : `Wind ${actual} m/s exceeds ${maxWind} m/s`,
  });
};

// Build pipeline
const launchDecision = async (input: unknown) => {
  const result = await pipe(
    validate(input, launchSchema),
    (r) => andThen(r, fetchWeather),
    (r) => andThen(r, assessLaunch),
  );

  return match(result, {
    ok: (decision) => decision,
    err: (errors) => ({ recommendation: 'SCRUB', reason: 'Validation failed', errors }),
  });
};

// Usage
const decision = await launchDecision({
  vehicleType: 'falcon9',
  payload: 15000,
  latitude: 28.5721,
  longitude: -80.649,
});

console.log(decision);
// { recommendation: 'GO', reason: 'Wind 8.2 m/s within limits' }
```

**Pattern:**

1. Validate at boundary with schema
2. Chain async operations with `andThen`
3. Pure business logic functions
4. Branch once at the end with `match`

## Next Steps

- [Recipes](docs/RECIPES.md) - Common patterns like point-free composition
- [Advanced](docs/ADVANCED.md) - Symbol branding, type inference details
- [API Reference](README.md) - Full function catalog
- [Examples](examples/) - Browse working examples

## Questions

- Bug reports: [GitHub Issues](https://github.com/sakobu/railway-ts-pipelines/issues)
- Feature requests: [GitHub Issues](https://github.com/sakobu/railway-ts-pipelines/issues)
- Questions: [GitHub Discussions](https://github.com/sakobu/railway-ts-pipelines/discussions)
