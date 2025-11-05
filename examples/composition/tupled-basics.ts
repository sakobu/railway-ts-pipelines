import { pipe, tupled } from '@/composition';

// Functions expecting multiple args
const calculateTotal = (price: number, tax: number, discount: number) => price * (1 + tax) - discount;

// Problem: Can't pipe multi-arg functions
// pipe(100, calculateTotal(0.1, 10)); // Type error

// Solution: Tupled for tuple-based composition
const result = pipe(
  [100, 0.1, 10],
  tupled(calculateTotal), // 100 * 1.1 - 10 = 100
);

console.log(result); // 100

// Combine with other tuple operations
const applyDiscount = (total: number): [number, number, number] => [total, 0.1, 5];

const result2 = pipe(
  50,
  applyDiscount,
  tupled(calculateTotal), // 50 * 1.1 - 5 = 50
);

console.log(result2); // 50
