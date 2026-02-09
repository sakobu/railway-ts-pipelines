import type { UnknownFunction } from './types';

/**
 * Transforms a function that accepts a tuple into a multi-argument function.
 * Inverse of `tupled`. Useful when callers have positional arguments but your core API uses tuples.
 *
 * @example
 * // Basic
 * const tupledAdd = ([a, b]: [number, number]) => a + b;
 * const add = untupled(tupledAdd);
 * add(5, 3); // 8
 *
 * @example
 * // 3-arity
 * const sum3Tupled = ([a, b, c]: [number, number, number]) => a + b + c;
 * const sum3 = untupled(sum3Tupled);
 * sum3(1, 2, 3); // 6
 *
 * @example
 * // With Result
 * import { ok, err, flatMapResult, type Result } from "@railway-ts/pipelines/result";
 * const validateRange = ([min, max, value]: [number, number, number]): Result<number, string> =>
 *   value >= min && value <= max ? ok(value) : err(`Value ${value} not between ${min} and ${max}`);
 * const validate = untupled(validateRange);
 * flatMapResult(ok(50), (n) => validate(0, 100, n)); // ok(50)
 *
 * @example
 * // With Option
 * import { some, none, type Option } from "@railway-ts/pipelines/option";
 * const parsePair = ([x, y]: [string, string]): Option<number> => {
 *   const a = Number(x), b = Number(y);
 *   return Number.isNaN(a) || Number.isNaN(b) ? none() : some(a + b);
 * };
 * const parse = untupled(parsePair);
 * parse("2", "3"); // some(5)
 *
 * @param fn - A function that accepts a tuple of arguments
 * @returns A function that accepts the same arguments positionally
 */

// 2-arity
export function untupled<A, B, R>(fn: (args: [A, B]) => R): (a: A, b: B) => R;

// 3-arity
export function untupled<A, B, C, R>(fn: (args: [A, B, C]) => R): (a: A, b: B, c: C) => R;

// 4-arity
export function untupled<A, B, C, D, R>(fn: (args: [A, B, C, D]) => R): (a: A, b: B, c: C, d: D) => R;

// 5-arity
export function untupled<A, B, C, D, E, R>(fn: (args: [A, B, C, D, E]) => R): (a: A, b: B, c: C, d: D, e: E) => R;

// Implementation
export function untupled<T extends UnknownFunction>(fn: T): UnknownFunction {
  return function untupledFn(...args: unknown[]): unknown {
    return fn(args);
  };
}
