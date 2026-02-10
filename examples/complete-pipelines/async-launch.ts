import { pipeAsync } from '@/composition';
import { err, flatMapWith, fromPromise, match, ok, type Result } from '@/result';
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

type LaunchDecision = {
  windSpeed: number;
  windGusts: number;
  maxAllowed: number;
};

// Main pipeline
const evaluateLaunch = async (input: unknown): Promise<ValidationResult<LaunchDecision>> => {
  const validationResult = validate(input, launchSchema);

  const result = await pipeAsync(
    validationResult,
    flatMapWith(fetchWeatherWithParams),
    flatMapWith(assessLaunchConditions),
  );

  return match<LaunchDecision, ValidationError[], ValidationResult<LaunchDecision>>(result, {
    ok: (decision) => ({ valid: true, data: decision }),
    err: (errors) => ({ valid: false, errors: formatErrors(errors) }),
  });
};

// === evaluateLaunch: Nominal Conditions ===
console.log('=== evaluateLaunch: Nominal Conditions ===');

const result = await evaluateLaunch({
  vehicleType: 'falcon9',
  payload: 1000,
  latitude: 28.5721,
  longitude: -80.648,
  windowStart: new Date(),
});

console.log(result);

// === evaluateLaunch: Different Location (result depends on live weather) ===
console.log('\n=== evaluateLaunch: Different Location ===');

const openOceanTest = await evaluateLaunch({
  vehicleType: 'atlas5',
  payload: 5000,
  latitude: 27.2,
  longitude: -60.0,
  windowStart: new Date(),
});

console.log(openOceanTest);
