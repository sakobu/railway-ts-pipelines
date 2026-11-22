import { bimap, err, filter, flatMap, map, mapErr, match, ok, orElse, tap, tapErr, type Result } from '@/result';

// === map: Transform Ok Values ===
console.log('=== map: Transform Ok Values ===');

const parsed = ok(3);
const doubled = map(parsed, (n) => n * 2);
const errResult = err('parse error');
const doubledErr = map(errResult, (n) => n * 2);

console.log('map ok(3) *2:', doubled); // { ok: true, value: 6 }
console.log('map err skips:', doubledErr); // { ok: false, error: "parse error" }

// === flatMap: Chain Fallible Operations ===
console.log('\n=== flatMap: Chain Fallible Operations ===');

const safeSqrt = (x: number) => (x < 0 ? err('cannot sqrt negative') : ok(Math.sqrt(x)));

const sqrtOf16 = flatMap(ok(16), safeSqrt);
const sqrtOfNeg = flatMap(ok(-4), safeSqrt);
const sqrtOfErr = flatMap(err('upstream error'), safeSqrt);

console.log('flatMap ok(16):', sqrtOf16); // { ok: true, value: 4 }
console.log('flatMap ok(-4):', sqrtOfNeg); // { ok: false, error: "cannot sqrt negative" }
console.log('flatMap err:', sqrtOfErr); // { ok: false, error: "upstream error" }

// === mapErr: Transform Errors ===
console.log('\n=== mapErr: Transform Errors ===');

type AppError = { code: string; message: string };

const raw = err('invalid format');
const structured = mapErr(raw, (msg) => ({ code: 'VALIDATION', message: msg }) satisfies AppError);
const okThrough = mapErr(ok(42), (msg) => ({ code: 'VALIDATION', message: msg }));

console.log('mapErr err:', structured); // { ok: false, error: { code: "VALIDATION", message: "invalid format" } }
console.log('mapErr ok passes through:', okThrough); // { ok: true, value: 42 }

// === bimap: Transform Both Sides ===
console.log('\n=== bimap: Transform Both Sides ===');

const formatOk = (n: number) => `$${n.toFixed(2)}`;
const formatErr = (e: string) => ({ kind: 'error' as const, detail: e });

const price = ok(9.99);
const invalid = err('missing price');

console.log('bimap ok:', bimap(price, formatOk, formatErr)); // { ok: true, value: "$9.99" }
console.log('bimap err:', bimap(invalid, formatOk, formatErr)); // { ok: false, error: { kind: "error", detail: "missing price" } }

// === filter: Conditional Pass/Fail ===
console.log('\n=== filter: Conditional Pass/Fail ===');

const age = ok(25);
const tooYoung = ok(12);

const isAdult = (result: Result<number, string>) => filter(result, (a) => a >= 18, 'must be 18 or older');

console.log('filter 25:', isAdult(age)); // { ok: true, value: 25 }
console.log('filter 12:', isAdult(tooYoung)); // { ok: false, error: "must be 18 or older" }
console.log('filter err:', isAdult(err('no age'))); // { ok: false, error: "no age" }

// === tap: Side Effects on Ok ===
console.log('\n=== tap: Side Effects on Ok ===');

const logged = tap(ok(42), (v) => console.log(`  [tap] value is ${v}`));
const skipped = tap(err('nope'), (v) => console.log(`  [tap] value is ${v}`));

console.log('tap ok returns original:', logged); // { ok: true, value: 42 }
console.log('tap err skips callback:', skipped); // { ok: false, error: "nope" }

// === tapErr: Side Effects on Err ===
console.log('\n=== tapErr: Side Effects on Err ===');

const loggedErr = tapErr(err('timeout'), (e) => console.log(`  [tapErr] error: ${e}`));
const skippedOk = tapErr(ok(42), (e) => console.log(`  [tapErr] error: ${e}`));

console.log('tapErr err returns original:', loggedErr); // { ok: false, error: "timeout" }
console.log('tapErr ok skips callback:', skippedOk); // { ok: true, value: 42 }

// === orElse: Error Recovery ===
console.log('\n=== orElse: Error Recovery ===');

const fetchLocal = () => err('local cache miss');
const fetchRemote = (e: string) => ok(`recovered from "${e}" via remote`);

const recovered = orElse(fetchLocal(), fetchRemote);
console.log('orElse recovers:', recovered); // { ok: true, value: "recovered from \"local cache miss\" via remote" }

const alreadyOk = ok('cached value');
const untouched = orElse(alreadyOk, fetchRemote);
console.log('orElse ok passes through:', untouched); // { ok: true, value: "cached value" }

// Recovery can also fail — returning another Err
const failedRecovery = orElse(err('db down'), () => err('remote also down'));
console.log(
  'orElse failed recovery:',
  match(failedRecovery, {
    ok: (v) => v,
    err: (e) => `still errored: ${e}`,
  }),
); // "still errored: remote also down"
