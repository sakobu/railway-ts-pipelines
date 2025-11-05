type UnknownFunction = (...params: unknown[]) => unknown;

/**
 * Curries a multi-parameter function into a sequence of unary functions.
 * Enables partial application at any depth and composes cleanly with `pipe`.
 *
 * Note: This curry is unary-only at each step to ensure compatibility with `pipe` and `flow`.
 *
 * @example
 * // Basic (2-arity)
 * const add = (a: number, b: number) => a + b;
 * const add5 = curry(add)(5);
 * add5(3); // 8
 *
 * @example
 * // 3-arity and partial application
 * const multiply = (a: number, b: number, c: number) => a * b * c;
 * const curriedMultiply = curry(multiply);
 * curriedMultiply(2)(3)(4); // 24
 *
 * @example
 * // With pipe
 * import { pipe } from "@/utils";
 * const divide = (divisor: number, dividend: number) => dividend / divisor;
 * const result = pipe(100, curry(divide)(2), (n) => n + 1); // 51
 *
 * @example
 * // With Result validators
 * import { ok, err, flatMapResult, type Result } from "@/index";
 * const between = (min: number, max: number, n: number): Result<number, string> =>
 *   n >= min && n <= max ? ok(n) : err(`Value must be between ${min} and ${max}`);
 * const validateAge = curry(between)(0)(120);
 * pipe(ok(25), (r) => flatMapResult(r, validateAge)); // ok(25)
 *
 * @param fn - The multi-argument function to transform into a unary curried chain
 * @returns A curried function that takes one argument at each application step
 */

// 2-arity
export function curry<A, B, R>(fn: (a: A, b: B) => R): (a: A) => (b: B) => R;

// 3-arity
export function curry<A, B, C, R>(fn: (a: A, b: B, c: C) => R): (a: A) => (b: B) => (c: C) => R;

// 4-arity
export function curry<A, B, C, D, R>(fn: (a: A, b: B, c: C, d: D) => R): (a: A) => (b: B) => (c: C) => (d: D) => R;

// 5-arity
export function curry<A, B, C, D, E, R>(
  fn: (a: A, b: B, c: C, d: D, e: E) => R,
): (a: A) => (b: B) => (c: C) => (d: D) => (e: E) => R;

// Implementation
export function curry<T extends UnknownFunction>(fn: T): UnknownFunction {
  const arity = fn.length;

  return function curried(...args: unknown[]): unknown {
    if (args.length >= arity) {
      return (fn as UnknownFunction)(...args);
    }

    return function (...nextArgs: unknown[]): unknown {
      return curried(...args, ...nextArgs);
    };
  };
}
