# Getting Started

## Installation

```bash
bun add @railway-ts/pipelines  # or npm, pnpm, yarn
```

Requires TypeScript 5.0+ and Node.js 18+.

## Import Strategy

Use subpath imports for tree-shaking:

```typescript
import { some, none, map } from '@railway-ts/pipelines/option';
import { ok, err, flatMap } from '@railway-ts/pipelines/result';
import { pipe, flow } from '@railway-ts/pipelines/composition';
import { validate, object, required } from '@railway-ts/pipelines/schema';
```

Or import from root (functions get type suffixes):

```typescript
import { mapOption, mapResult, pipe, ok } from '@railway-ts/pipelines';
```

When importing from root, shared functions like `map` become `mapOption` and `mapResult`. Result-only functions like `mapErr` stay as-is.

## Your First Pipeline

Build a pipeline that validates input, transforms it, and handles errors.

```typescript
import { pipe } from '@railway-ts/pipelines/composition';
import { ok, match, andThen } from '@railway-ts/pipelines/result';
import {
  validate,
  object,
  required,
  chain,
  parseNumber,
  min,
  formatErrors,
  type ValidationError,
  type ValidationResult,
} from '@railway-ts/pipelines/schema';

// 1. Define schema
const schema = object({
  x: required(chain(parseNumber(), min(0))),
  y: required(chain(parseNumber(), min(1))),
});

// 2. Build pipeline
async function compute(input: unknown): Promise<ValidationResult<number>> {
  const result = await pipe(validate(input, schema), (r) => andThen(r, ({ x, y }) => ok(x / y)));

  return match<number, ValidationError[], ValidationResult<number>>(result, {
    ok: (value) => ({ valid: true, data: value }),
    err: (errors) => ({ valid: false, errors: formatErrors(errors) }),
  });
}

// 3. Use it
await compute({ x: '10', y: '2' }).then(console.log);
// { valid: true, data: 5 }

await compute({ x: '-5', y: '0' }).then(console.log);
// { valid: false, errors: [...] }
```

**The key insight:** After validation, you never check for errors again. The pipeline propagates them automatically. Write happy path code, handle errors once at the end.

## Real-World Example: Launch Decision System

Validate launch parameters, fetch weather data, make GO/NO-GO decision.

```typescript
import { pipe } from '@railway-ts/pipelines/composition';
import { err, fromPromise, match, ok, andThen, type Result } from '@railway-ts/pipelines/result';
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

type LaunchDecision = {
  windSpeed: number;
  windGusts: number;
  maxAllowed: number;
  recommendation: 'GO' | 'NO GO';
  reason: string;
};

// Helper for API responses
const toJsonIfOk = (res: Response) => (res.ok ? res.json() : Promise.reject(`HTTP ${res.status}`));

// Fetch weather and combine with params
const fetchWeatherWithParams = async (params: LaunchParams): Promise<Result<LaunchContext, ValidationError[]>> => {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.append('latitude', params.latitude.toString());
  url.searchParams.append('longitude', params.longitude.toString());
  url.searchParams.append('current', 'wind_speed_10m,wind_direction_10m,wind_gusts_10m');
  url.searchParams.append('wind_speed_unit', 'ms');

  const result = await fromPromise(fetch(url.toString()).then(toJsonIfOk));

  return match(result, {
    ok: (data) => ok({ params, weather: data.current }),
    err: (msg) => err([{ path: ['weather_api'], message: String(msg) }]),
  });
};

// Calculate wind loads and decision
const assessLaunchConditions = async (context: LaunchContext): Promise<Result<LaunchDecision, ValidationError[]>> => {
  const windLimits: Record<VehicleType, number> = {
    falcon9: 15,
    atlas5: 12,
  };

  const maxWind = windLimits[context.params.vehicleType];
  const actualMaxWind = Math.max(context.weather.wind_speed_10m, context.weather.wind_gusts_10m);
  const isGo = actualMaxWind <= maxWind;

  const decision: LaunchDecision = {
    windSpeed: context.weather.wind_speed_10m,
    windGusts: context.weather.wind_gusts_10m,
    maxAllowed: maxWind,
    recommendation: isGo ? 'GO' : 'NO GO',
    reason: isGo ? 'Conditions nominal' : 'Wind exceeds limits',
  };

  return ok(decision);
};

// Main pipeline
const evaluateLaunch = async (input: unknown): Promise<ValidationResult<LaunchDecision>> => {
  const validationResult = validate(input, launchSchema);

  const result = await pipe(
    validationResult,
    (r) => andThen(r, fetchWeatherWithParams),
    (r) => andThen(r, assessLaunchConditions),
  );

  return match<LaunchDecision, ValidationError[], ValidationResult<LaunchDecision>>(result, {
    ok: (decision) => ({ valid: true, data: decision }),
    err: (errors) => ({ valid: false, errors: formatErrors(errors) }),
  });
};

// Usage
const result = await evaluateLaunch({
  vehicleType: 'falcon9',
  payload: 1000,
  latitude: 28.5721,
  longitude: -80.648,
  windowStart: new Date('2025-01-01'),
});

console.log(result);
// { valid: true, data: { windSpeed: 7.2, windGusts: 9.1, maxAllowed: 15, recommendation: 'GO', reason: 'Conditions nominal' } }
```

**The pattern:**

1. Validate at boundary with schema
2. Chain async operations with `andThen`
3. Pure business logic functions
4. Branch once at the end with `match`

## Running Examples

```bash
git clone https://github.com/sakobu/railway-ts-pipelines.git
cd railway-ts-pipelines
bun install

# Run all examples
bun run examples/index.ts

# Or run specific examples
bun run examples/complete-pipelines/async-launch.ts
```

**Start with:** `examples/complete-pipelines/async-launch.ts` - shows the full pattern.

**Example categories:**

- `option/` - Handling nullable values
- `result/` - Error handling patterns
- `schema/` - Validation (basic, union, tuple)
- `composition/` - Function composition patterns
- `complete-pipelines/` - Full pipelines with validation + async + logic

## Next Steps

→ **[Recipes](docs/RECIPES.md)** - Common patterns like point-free composition  
→ **[Advanced](docs/ADVANCED.md)** - Symbol branding, type inference details  
→ **[API Reference](README.md)** - Full function catalog

## Questions

- Bugs: [GitHub Issues](https://github.com/sakobu/railway-ts-pipelines/issues)
- Features: [GitHub Issues](https://github.com/sakobu/railway-ts-pipelines/issues)
- Questions: [GitHub Discussions](https://github.com/sakobu/railway-ts-pipelines/discussions)
