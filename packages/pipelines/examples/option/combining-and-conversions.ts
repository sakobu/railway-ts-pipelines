import { combine, mapToResult, none, some } from '@/option';

// === combine: Collect Options ===
console.log('=== combine: Collect Options ===');

const allSome = combine([some(1), some('two'), some(true)]);
console.log('combine all some:', allSome); // { some: true, value: [1, "two", true] }

const hasNone = combine([some(1), none(), some(3)]);
console.log('combine with none:', hasNone); // { some: false }

const empty = combine([]);
console.log('combine empty:', empty); // { some: true, value: [] }

// === mapToResult: Option to Result ===
console.log('\n=== mapToResult: Option to Result ===');

const okResult = mapToResult(some(42), 'missing');
console.log('mapToResult some:', okResult); // { ok: true, value: 42 }

const errResult = mapToResult(none(), 'missing');
console.log('mapToResult none:', errResult); // { ok: false, error: "missing" }
