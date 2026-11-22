import type { UnknownFunction } from './types';

/**
 * Transforms a multi-argument function into one that accepts a single tuple argument.
 * This makes multi-arg functions composable in `pipe`/`flow` when your data is a tuple.
 *
 * @example
 * // Basic
 * const add = (a: number, b: number) => a + b;
 * const tupledAdd = tupled(add);
 * tupledAdd([5, 3]); // 8
 *
 * @example
 * // With pipe (tuple input)
 * import { pipe } from "@/utils";
 * const distance = (x: number, y: number) => Math.hypot(x, y);
 * pipe([3, 4] as [number, number], tupled(distance)); // 5
 *
 * @example
 * // With Result
 * import { ok, err, flatMapResult, mapResult, type Result } from "@railway-ts/pipelines/result";
 * const divide = (dividend: number, divisor: number): Result<number, string> =>
 *   divisor === 0 ? err("Division by zero") : ok(dividend / divisor);
 * const tupledDivide = tupled(divide);
 * pipe(ok<[number, number], string>([10, 2]),
 *   (r) => flatMapResult(r, tupledDivide),
 *   (r) => mapResult(r, (n) => n * 2)
 * ); // ok(10)
 *
 * @example
 * // With Option
 * import { some, none, flatMapOption, type Option } from "@railway-ts/pipelines/option";
 * const safeParse = (str: string, radix: number): Option<number> => {
 *   const n = Number.parseInt(str, radix);
 *   return Number.isNaN(n) ? none() : some(n);
 * };
 * const tupledParse = tupled(safeParse);
 * flatMapOption(some(["FF", 16] as [string, number]), tupledParse); // some(255)
 *
 * @param fn - A function taking positional arguments to be adapted to a single tuple argument
 * @returns A function that takes a tuple and applies it to `fn` as positional args
 */

// 2-arity
export function tupled<A, B, R>(fn: (a: A, b: B) => R): (args: [A, B]) => R;

// 3-arity
export function tupled<A, B, C, R>(fn: (a: A, b: B, c: C) => R): (args: [A, B, C]) => R;

// 4-arity
export function tupled<A, B, C, D, R>(fn: (a: A, b: B, c: C, d: D) => R): (args: [A, B, C, D]) => R;

// 5-arity
export function tupled<A, B, C, D, E, R>(fn: (a: A, b: B, c: C, d: D, e: E) => R): (args: [A, B, C, D, E]) => R;

// Implementation
export function tupled<T extends UnknownFunction>(fn: T): (args: unknown[]) => unknown {
  return function tupledFn(args: unknown[]): unknown {
    return fn(...args);
  };
}
