import { err, isErr, isOk, match, ok, unwrapOr, unwrapOrElse, type Result } from '@/result';

// === ok / err: Creating Results ===
console.log('=== ok / err: Creating Results ===');

const success = ok(42);
const failure = err('not found');

console.log('ok(42):', success); // { ok: true, value: 42 }
console.log('err("not found"):', failure); // { ok: false, error: "not found" }

// === isOk / isErr: Type Guards ===
console.log('\n=== isOk / isErr: Type Guards ===');

function describeResult(result: Result<number, string>): string {
  if (isOk(result)) {
    // TypeScript narrows: result.value is accessible
    return `Got value: ${result.value}`;
  }
  // TypeScript narrows: result.error is accessible
  return `Got error: ${result.error}`;
}

console.log('isOk ok(42):', isOk(success)); // true
console.log('isErr ok(42):', isErr(success)); // false
console.log('Narrowing ok:', describeResult(success)); // "Got value: 42"
console.log('Narrowing err:', describeResult(failure)); // "Got error: not found"

// === match: Pattern Matching ===
console.log('\n=== match: Pattern Matching ===');

// match returns a value — great for deriving display strings, formatted output, etc.
const label = match(success, {
  ok: (value) => `Score: ${value} points`,
  err: (error) => `Failed: ${error}`,
});
console.log('match ok:', label); // "Score: 42 points"

const errorLabel = match(failure, {
  ok: (value) => `Score: ${value} points`,
  err: (error) => `Failed: ${error}`,
});
console.log('match err:', errorLabel); // "Failed: not found"

// === unwrapOr: Extract with Default ===
console.log('\n=== unwrapOr: Extract with Default ===');

const a = unwrapOr(ok(10), 0);
const b = unwrapOr(err('missing'), 0);

console.log('unwrapOr ok(10):', a); // 10
console.log('unwrapOr err:', b); // 0

// === unwrapOrElse: Extract with Lazy Default ===
console.log('\n=== unwrapOrElse: Extract with Lazy Default ===');

// The default function only runs when the Result is an Err
const c = unwrapOrElse(ok(10), () => {
  console.log('This never runs');
  return 0;
});
console.log('unwrapOrElse ok(10):', c); // 10

const d = unwrapOrElse(err('config missing'), () => {
  console.log('Computing fallback...');
  return 99;
});
console.log('unwrapOrElse err:', d); // 99
