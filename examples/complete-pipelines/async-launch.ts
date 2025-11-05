import { pipe } from '@/composition';
import { err, fromPromise, match, ok, andThen, type Result } from '@/result';
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
} from '@/schema';

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

// Coordinate for a windy region so the launch will fail
const gabrielleTest = await evaluateLaunch({
  vehicleType: 'atlas5', // or "falcon9" - both will fail
  payload: 5000,
  latitude: 27.2,
  longitude: -60.0,
  windowStart: new Date('2025-09-21'),
});

console.log(gabrielleTest);
