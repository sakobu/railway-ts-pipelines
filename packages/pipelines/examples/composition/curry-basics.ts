import { pipe, curry } from '@/composition';

// === curry: Making Multi-Arg Functions Pipeable ===
console.log('=== curry: Making Multi-Arg Functions Pipeable ===');

const add = (a: number, b: number) => a + b;
const multiply = (a: number, b: number) => a * b;

const result = pipe(
  10,
  curry(add)(5), // 10 + 5 = 15
  curry(multiply)(2), // 15 * 2 = 30
);

console.log(result); // 30

// === curry: Partial Application ===
console.log('\n=== curry: Partial Application ===');

const add5 = curry(add)(5);
const double = curry(multiply)(2);

const result2 = pipe(10, add5, double);
console.log(result2); // 30
