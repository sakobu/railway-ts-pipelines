import { pipe, curry } from '@/composition';

// Multi-arg functions don't compose
const add = (a: number, b: number) => a + b;
const multiply = (a: number, b: number) => a * b;

// Problem: Can't pipe multi-arg functions
// pipe(10, add(5), multiply(2)); // Type error

// Solution: Curry for composition
const result = pipe(
  10,
  curry(add)(5), // 10 + 5 = 15
  curry(multiply)(2), // 15 * 2 = 30
);

console.log(result); // 30

// Curry also enables partial application
const add5 = curry(add)(5);
const double = curry(multiply)(2);

const result2 = pipe(10, add5, double);
console.log(result2); // 30
