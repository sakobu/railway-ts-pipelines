import {
  combine,
  combineAll,
  err,
  fromPromise,
  fromPromiseWithError,
  fromTry,
  fromTryWithError,
  isErr,
  mapToOption,
  ok,
  toPromise,
} from '@/result';

// === combine: Collect Results, Stop at First Error ===
console.log('=== combine: Collect Results, Stop at First Error ===');

const allOk = combine([ok(1), ok('two'), ok(true)]);
console.log('combine all ok:', allOk); // { ok: true, value: [1, "two", true] }

const firstFails = combine([ok(1), err('bad'), ok(3)]);
console.log('combine with error:', firstFails); // { ok: false, error: "bad" }

const empty = combine([]);
console.log('combine empty:', empty); // { ok: true, value: [] }

// === combineAll: Collect Results, Gather All Errors ===
console.log('\n=== combineAll: Collect Results, Gather All Errors ===');

const allGood = combineAll([ok(10), ok(20), ok(30)]);
console.log('combineAll all ok:', allGood); // { ok: true, value: [10, 20, 30] }

const multipleErrors = combineAll([ok(1), err('err-a'), ok(3), err('err-b')]);
console.log('combineAll gathers errors:', multipleErrors); // { ok: false, error: ["err-a", "err-b"] }

// === fromTry: Capture Exceptions as Results ===
console.log('\n=== fromTry: Capture Exceptions ===');

const parsed = fromTry(() => JSON.parse('{"name":"Alice"}'));
console.log('fromTry valid JSON:', parsed); // { ok: true, value: { name: "Alice" } }

const parseFailed = fromTry(() => JSON.parse('not json'));
console.log('fromTry invalid JSON:', parseFailed); // { ok: false, error: "Unexpected token..." }

// === fromTryWithError: Preserve Full Error Object ===
console.log('\n=== fromTryWithError: Preserve Full Error ===');

const fullError = fromTryWithError(() => JSON.parse('nope'));
if (isErr(fullError)) {
  console.log('fromTryWithError error type:', fullError.error.constructor.name); // "SyntaxError"
  console.log('fromTryWithError has stack:', typeof fullError.error.stack === 'string'); // true
}

// === fromPromise: Wrap Promises (String Errors) ===
console.log('\n=== fromPromise: Wrap Promises ===');

const successPromise = fromPromise(Promise.resolve(42));
console.log('fromPromise resolved:', await successPromise); // { ok: true, value: 42 }

const failedPromise = fromPromise(Promise.reject(new Error('network timeout')));
console.log('fromPromise rejected:', await failedPromise); // { ok: false, error: "network timeout" }

// === fromPromiseWithError: Wrap Promises (Custom Error Type) ===
console.log('\n=== fromPromiseWithError: Custom Error Type ===');

type ApiError = { status: number; message: string };

const apiCall = fromPromiseWithError<number, ApiError>(Promise.reject(new Error('Not Found')), (error) => ({
  status: 404,
  message: error instanceof Error ? error.message : String(error),
}));
console.log('fromPromiseWithError:', await apiCall);
// { ok: false, error: { status: 404, message: "Not Found" } }

// Without error transformer — preserves raw error
const rawError = fromPromiseWithError(Promise.reject(new Error('raw')));
const rawResult = await rawError;
if (isErr(rawResult)) {
  console.log('fromPromiseWithError raw:', rawResult.error instanceof Error); // true
}

// === toPromise: Result to Promise ===
console.log('\n=== toPromise: Result to Promise ===');

const resolved = await toPromise(ok(100));
console.log('toPromise ok:', resolved); // 100

try {
  await toPromise(err('something broke'));
} catch (error) {
  console.log('toPromise err rejects:', error); // "something broke"
}

// === mapToOption: Result to Option ===
console.log('\n=== mapToOption: Result to Option ===');

const someVal = mapToOption(ok(42));
console.log('mapToOption ok:', someVal); // { some: true, value: 42 }

const noneVal = mapToOption(err('irrelevant'));
console.log('mapToOption err:', noneVal); // { some: false }
