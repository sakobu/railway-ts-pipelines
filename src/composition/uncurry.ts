import type { UnknownFunction } from './types';

/**
 * Uncurries a curried unary function chain back into a multi-argument function.
 * Inverse of `curry`. Useful when calling curried APIs with positional arguments.
 *
 * Note: Expects strictly unary nesting (the shape produced by `curry`).
 *
 * @example
 * // 2-arity
 * const addCurried = (a: number) => (b: number) => a + b;
 * const add = uncurry(addCurried);
 * add(5, 3); // 8
 *
 * @example
 * // 3-arity
 * const multiplyCurried = (a: number) => (b: number) => (c: number) => a * b * c;
 * const multiply = uncurry(multiplyCurried);
 * multiply(2, 3, 4); // 24
 *
 * @example
 * // Round-trip with curry
 * import { curry } from "@railway-ts/pipelines";
 * const divide = (divisor: number, dividend: number) => dividend / divisor;
 * const divideCurried = curry(divide);
 * const divideUncurried = uncurry(divideCurried);
 * divideUncurried(2, 100); // 50
 *
 * @param fn - A curried unary function chain (e.g., a => b => c => r)
 * @returns A multi-argument function equivalent to applying the curried chain in sequence
 */

// Overloads ordered from most specific (5-arity) to least specific (2-arity)
// This ensures TypeScript matches the correct overload

// 5-arity
export function uncurry<A, B, C, D, E, R>(
  fn: (a: A) => (b: B) => (c: C) => (d: D) => (e: E) => R,
): (a: A, b: B, c: C, d: D, e: E) => R;

// 5-arity
export function uncurry<A, B, C, D, E, R>(
  fn: (a: A) => (b: B) => (c: C) => (d: D) => (e: E) => R,
): (a: A, b: B, c: C, d: D, e: E) => R;

// 4-arity
export function uncurry<A, B, C, D, R>(fn: (a: A) => (b: B) => (c: C) => (d: D) => R): (a: A, b: B, c: C, d: D) => R;

// 3-arity
export function uncurry<A, B, C, R>(fn: (a: A) => (b: B) => (c: C) => R): (a: A, b: B, c: C) => R;

// 2-arity
export function uncurry<A, B, R>(fn: (a: A) => (b: B) => R): (a: A, b: B) => R;

// 1-arity (identity - technically not curried, but allows for consistent API)
export function uncurry<A, R>(fn: (a: A) => R): (a: A) => R;

// Implementation - looser types allow overloads to work correctly
export function uncurry(fn: unknown): unknown {
  return function uncurried(...args: unknown[]): unknown {
    // Apply arguments sequentially to the curried function chain
    let result = fn;

    for (const arg of args) {
      result = (result as UnknownFunction)(arg);
    }

    return result;
  };
}
