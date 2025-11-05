import { pipe } from '@/composition';
import { ok, err, fromTry, match, flatMap, map, andThen, type Result } from '@/result';

// Example 1: Division by Zero
console.log('=== Division by Zero ===');

// Problem: Division can fail but functions don't show it in types
// function divide(a: number, b: number) {
//   return a / b; // Returns Infinity for division by zero
// }

// Solution: Result makes failure explicit
function safeDivide(a: number, b: number) {
  return b === 0 ? err('Division by zero') : ok(a / b);
}

const result1 = safeDivide(10, 2);
const result2 = safeDivide(10, 0);

match(result1, {
  ok: (value) => console.log(`Result: ${value}`),
  err: (error) => console.log(`Error: ${error}`),
}); // "Result: 5"

match(result2, {
  ok: (value) => console.log(`Result: ${value}`),
  err: (error) => console.log(`Error: ${error}`),
}); // "Error: Division by zero"

// Example 2: JSON Parsing
console.log('\n=== JSON Parsing ===');

// Problem: JSON.parse throws exceptions
// const data = JSON.parse('invalid json'); // Throws!

// Solution: fromTry captures exceptions as Results
const safeParseJson = (s: string) => fromTry(() => JSON.parse(s));

const valid = safeParseJson('{"name": "Alice"}');
const invalid = safeParseJson('invalid json');

match(valid, {
  ok: (data) => console.log(`Parsed: ${data.name}`),
  err: (error) => console.log(`Parse failed: ${error}`),
}); // "Parsed: Alice"

match(invalid, {
  ok: (data) => console.log(`Parsed: ${data.name}`),
  err: (error) => console.log(`Parse failed: ${error}`),
}); // "Parse failed: Unexpected token..."

// Example 3: Chaining Operations
console.log('\n=== Chaining Operations ===');

// Problem: Multiple operations that can fail require nested try/catch
// Solution: flatMapResult chains failing operations cleanly

const hasNumericValue = (u: unknown): u is { value: number } =>
  typeof u === 'object' && u !== null && 'value' in u && typeof (u as { value: unknown }).value === 'number';

const toNumber = (data: unknown): Result<number, string> =>
  hasNumericValue(data) ? ok(data.value) : err('Not a number');

const processNumber = (input: string) =>
  pipe(
    safeParseJson(input),
    (result) => flatMap(result, toNumber),
    (result) => flatMap(result, (num) => safeDivide(num, 2)),
    (result) => map(result, (num) => Math.round(num)),
  );

const success = processNumber('{"value": 42}');
const failure = processNumber('{"value": "not a number"}');

match(success, {
  ok: (value) => console.log(`Final result: ${value}`),
  err: (error) => console.log(`Failed: ${error}`),
}); // "Final result: 21"

match(failure, {
  ok: (value) => console.log(`Final result: ${value}`),
  err: (error) => console.log(`Failed: ${error}`),
}); // "Failed: Not a number"

// Example 4: Async Chaining with andThen
console.log('\n=== Async Chaining ===');

const safeDivideAsync = async (a: number, b: number): Promise<Result<number, string>> =>
  b === 0 ? err('Division by zero') : ok(a / b);

const processNumberAsync = async (input: string) =>
  await pipe(
    safeParseJson(input),
    (r) => andThen(r, toNumber),
    (p) => andThen(p, (n) => safeDivideAsync(n, 2)),
    (p) => andThen(p, (n) => ok(Math.round(n))),
  );

const successAsync = await processNumberAsync('{"value": 42}');
const failureAsync = await processNumberAsync('{"value": "not a number"}');

match(successAsync, {
  ok: (value) => console.log(`Async final result: ${value}`),
  err: (error) => console.log(`Async failed: ${error}`),
}); // "Async final result: 21"

match(failureAsync, {
  ok: (value) => console.log(`Async final result: ${value}`),
  err: (error) => console.log(`Async failed: ${error}`),
}); // "Async failed: Not a number"
