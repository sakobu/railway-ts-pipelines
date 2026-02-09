import { pipe, tupled } from '@/composition';

// === tupled: Tuple-Based Composition ===
console.log('=== tupled: Tuple-Based Composition ===');

const calculateTotal = (price: number, tax: number, discount: number) => price * (1 + tax) - discount;

const result = pipe(
  [100, 0.1, 10],
  tupled(calculateTotal), // 100 * 1.1 - 10 = 100
);

console.log(result); // 100

// === tupled: Combining with Tuple Operations ===
console.log('\n=== tupled: Combining with Tuple Operations ===');

const applyDiscount = (total: number): [number, number, number] => [total, 0.1, 5];

const result2 = pipe(
  50,
  applyDiscount,
  tupled(calculateTotal), // 50 * 1.1 - 5 = 50
);

console.log(result2); // 50
