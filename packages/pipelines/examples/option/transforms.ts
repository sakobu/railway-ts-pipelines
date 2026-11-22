import { bimap, filter, flatMap, fromNullable, map, none, some, tap, type Option } from '@/option';

// === map: Transform Some Values ===
console.log('=== map: Transform Some Values ===');

const doubled = map(some(3), (n) => n * 2);
const mapNone = map(none<number>(), (n) => n * 2);

console.log('map some(3) *2:', doubled); // { some: true, value: 6 }
console.log('map none skips:', mapNone); // { some: false }

// === flatMap: Chain Optional Lookups ===
console.log('\n=== flatMap: Chain Optional Lookups ===');

type User = { name: string; address?: { city?: string } };

const userWithCity: User = { name: 'Alice', address: { city: 'Paris' } };
const userNoCity: User = { name: 'Bob', address: {} };
const userNoAddress: User = { name: 'Charlie' };

const getCity = (user: User): Option<string> => flatMap(fromNullable(user.address), (addr) => fromNullable(addr.city));

console.log('flatMap with city:', getCity(userWithCity)); // { some: true, value: "Paris" }
console.log('flatMap no city:', getCity(userNoCity)); // { some: false }
console.log('flatMap no address:', getCity(userNoAddress)); // { some: false }

// === bimap: Handle Both Branches ===
console.log('\n=== bimap: Handle Both Branches ===');

const formatSome = (n: number) => some(`value is ${n}`);
const formatNone = () => some('was empty, using fallback');

const bimapSome = bimap(some(42), formatSome, formatNone);
const bimapNone = bimap(none(), formatSome, formatNone);

console.log('bimap some:', bimapSome); // { some: true, value: "value is 42" }
console.log('bimap none:', bimapNone); // { some: true, value: "was empty, using fallback" }

// === filter: Conditional Narrowing ===
console.log('\n=== filter: Conditional Narrowing ===');

const adult = filter(some(25), (n) => n >= 18);
const minor = filter(some(12), (n) => n >= 18);
const filterNone = filter(none(), (n) => n >= 18);

console.log('filter 25 >= 18:', adult); // { some: true, value: 25 }
console.log('filter 12 >= 18:', minor); // { some: false }
console.log('filter none:', filterNone); // { some: false }

// === tap: Side Effects on Some ===
console.log('\n=== tap: Side Effects on Some ===');

const tapped = tap(some(42), (v) => console.log(`  [tap] value is ${v}`));
const skipped = tap(none(), (v) => console.log(`  [tap] value is ${v}`));

console.log('tap some returns original:', tapped); // { some: true, value: 42 }
console.log('tap none skips callback:', skipped); // { some: false }
