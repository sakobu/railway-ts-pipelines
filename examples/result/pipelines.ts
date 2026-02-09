import { pipe } from '@/composition';
import {
  err,
  filterWith,
  flatMapWith,
  mapErrWith,
  mapWith,
  match,
  ok,
  orElseWith,
  tapErrWith,
  tapWith,
  type Result,
} from '@/result';

// === Sync Pipeline: Temperature Converter ===
console.log('=== Sync Pipeline: Temperature Converter ===');

const parseCelsius = (input: string) => {
  const n = Number(input);
  return Number.isNaN(n) ? err('not a number') : ok(n);
};

// filterWith guards against invalid values after a successful parse
const convertTemp = (input: string) =>
  pipe(
    parseCelsius(input),
    flatMapWith((c: number) => (c >= -273.15 ? ok(c) : err('below absolute zero'))),
    tapWith((c) => console.log(`  [log] converting ${c}C`)),
    mapWith((c) => c * 1.8 + 32),
    mapWith((f) => `${f.toFixed(1)}F`),
    mapErrWith((e) => `Invalid temperature: ${e}`),
  );

console.log('100C:', match(convertTemp('100'), { ok: (v) => v, err: (e) => e })); // "212.0F"

console.log('-300C:', match(convertTemp('-300'), { ok: (v) => v, err: (e) => e })); // "Invalid temperature: below absolute zero"

console.log('abc:', match(convertTemp('abc'), { ok: (v) => v, err: (e) => e })); // "Invalid temperature: not a number"

// === filterWith: Standalone Validation ===
console.log('\n=== filterWith: Standalone Validation ===');

// filterWith is ideal when applied to a known-Ok pipeline step
const ensurePositive = filterWith<number, string>((n) => n > 0, 'must be positive');

console.log('filterWith ok(5):', ensurePositive(ok(5))); // { ok: true, value: 5 }
console.log('filterWith ok(-1):', ensurePositive(ok(-1))); // { ok: false, error: "must be positive" }

// === orElseWith: Recovery in Pipelines ===
console.log('\n=== orElseWith: Recovery in Pipelines ===');

const parseStrict = (input: string): Result<number, string> => {
  const n = Number(input);
  return Number.isNaN(n) ? err(input) : ok(n);
};

const extractDigits = (raw: string) => {
  const digits = raw.replaceAll(/\D/g, '');
  return digits.length > 0 ? ok(Number(digits)) : err('no digits found');
};

const parseWithFallback = (input: string) =>
  pipe(
    parseStrict(input),
    orElseWith(extractDigits),
    mapWith((n) => n * 2),
  );

console.log('clean "5":', parseWithFallback('5')); // { ok: true, value: 10 }
console.log('messy "$42":', parseWithFallback('$42')); // { ok: true, value: 84 }
console.log('no digits "abc":', parseWithFallback('abc')); // { ok: false, error: "no digits found" }

// === tapErrWith: Logging Errors in Pipelines ===
console.log('\n=== tapErrWith: Logging Errors in Pipelines ===');

const errors: string[] = [];

const validateAge = (input: string) =>
  pipe(
    parseStrict(input),
    flatMapWith((n: number) => (Number.isInteger(n) ? ok(n) : err('age must be a whole number'))),
    flatMapWith((n: number) => (n >= 0 && n <= 150 ? ok(n) : err('age out of range'))),
    tapErrWith((e) => errors.push(e)),
    mapWith((age) => ({ age, category: age >= 18 ? 'adult' : 'minor' })),
  );

console.log('valid:', validateAge('25')); // { ok: true, value: { age: 25, category: "adult" } }
console.log('invalid:', validateAge('3.5')); // { ok: false, error: "age must be a whole number" }
console.log('out of range:', validateAge('200')); // { ok: false, error: "age out of range" }
console.log('collected errors:', errors); // ["age must be a whole number", "age out of range"]
