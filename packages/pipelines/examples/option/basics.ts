import { fromNullable, isNone, isSome, match, none, some, unwrapOr, unwrapOrElse, type Option } from '@/option';

// === some / none: Creating Options ===
console.log('=== some / none: Creating Options ===');

const hasValue = some(42);
const empty = none();

console.log('some(42):', hasValue); // { some: true, value: 42 }
console.log('none():', empty); // { some: false }

// === fromNullable: Wrapping Nullable Values ===
console.log('\n=== fromNullable: Wrapping Nullable Values ===');

const fromString = fromNullable('hello');
const fromNull = fromNullable(null);
const fromUndefined = fromNullable(undefined);

console.log('fromNullable("hello"):', fromString); // { some: true, value: "hello" }
console.log('fromNullable(null):', fromNull); // { some: false }
console.log('fromNullable(undefined):', fromUndefined); // { some: false }

// === isSome / isNone: Type Guards ===
console.log('\n=== isSome / isNone: Type Guards ===');

console.log('isSome some(42):', isSome(hasValue)); // true
console.log('isNone some(42):', isNone(hasValue)); // false
console.log('isSome none():', isSome(empty)); // false
console.log('isNone none():', isNone(empty)); // true

// Type narrowing
function describeOption(option: Option<number>): string {
  if (isSome(option)) {
    // TypeScript narrows: option.value is accessible
    return `Got value: ${option.value}`;
  }
  // TypeScript narrows: no .value available
  return 'Got nothing';
}

console.log('Narrowing some:', describeOption(hasValue)); // "Got value: 42"
console.log('Narrowing none:', describeOption(empty)); // "Got nothing"

// === match: Pattern Matching ===
console.log('\n=== match: Pattern Matching ===');

const label = match(hasValue, {
  some: (value) => `Score: ${value} points`,
  none: () => 'No score available',
});
console.log('match some:', label); // "Score: 42 points"

const emptyLabel = match(empty, {
  some: (value) => `Score: ${value} points`,
  none: () => 'No score available',
});
console.log('match none:', emptyLabel); // "No score available"

// === unwrapOr: Extract with Default ===
console.log('\n=== unwrapOr: Extract with Default ===');

const a = unwrapOr(some(10), 0);
const b = unwrapOr(none(), 0);

console.log('unwrapOr some(10):', a); // 10
console.log('unwrapOr none:', b); // 0

// === unwrapOrElse: Extract with Lazy Default ===
console.log('\n=== unwrapOrElse: Extract with Lazy Default ===');

// The default function only runs when the Option is None
const c = unwrapOrElse(some(10), () => {
  console.log('This never runs');
  return 0;
});
console.log('unwrapOrElse some(10):', c); // 10

const d = unwrapOrElse(none(), () => {
  console.log('Computing fallback...');
  return 99;
});
console.log('unwrapOrElse none:', d); // 99
