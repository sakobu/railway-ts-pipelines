type UnknownFunction = (...params: unknown[]) => unknown;

/**
 * Pipes a value through a series of functions, from left to right.
 * Each function receives the output of the previous function.
 * Unlike flow, pipe immediately executes the functions with the provided initial value.
 *
 * @example
 * // Basic usage
 * const result = pipe(
 *   5,
 *   (n) => n * 2,      // 10
 *   (n) => n + 1,      // 11
 *   (n) => n.toString() // "11"
 * );
 * // result: "11"
 *
 * @example
 * // With Option
 * import { some, mapOption } from "@railway-ts/pipelines/option";
 *
 * const optionResult = pipe(
 *   some(5),
 *   (o) => mapOption(o, (n) => n * 2),
 *   (o) => mapOption(o, (n) => n.toString())
 * );
 * // optionResult: Option<string> containing "10"
 *
 * @example
 * // With Result
 * import { ok, mapResult } from "@railway-ts/pipelines/result";
 *
 * const resultValue = pipe(
 *   ok(5),
 *   (r) => mapResult(r, (n) => n * 2),
 *   (r) => mapResult(r, (n) => n.toString())
 * );
 * // resultValue: Result<string, never> containing "10"
 *
 * @param a - The initial value to pipe through the functions
 * @param ab - The first function to apply to the initial value
 * @param functions - Additional functions to apply in sequence
 * @returns The final result after applying all functions
 */

export function pipe<A, B>(a: A, ab: (this: void, a: A) => B): B;
export function pipe<A, B, C>(a: A, ab: (this: void, a: A) => B, bc: (this: void, b: B) => C): C;
export function pipe<A, B, C, D>(
  a: A,
  ab: (this: void, a: A) => B,
  bc: (this: void, b: B) => C,
  cd: (this: void, c: C) => D,
): D;
export function pipe<A, B, C, D, E>(
  a: A,
  ab: (this: void, a: A) => B,
  bc: (this: void, b: B) => C,
  cd: (this: void, c: C) => D,
  de: (this: void, d: D) => E,
): E;
export function pipe<A, B, C, D, E, F>(
  a: A,
  ab: (this: void, a: A) => B,
  bc: (this: void, b: B) => C,
  cd: (this: void, c: C) => D,
  de: (this: void, d: D) => E,
  ef: (this: void, e: E) => F,
): F;
export function pipe<A, B, C, D, E, F, G>(
  a: A,
  ab: (this: void, a: A) => B,
  bc: (this: void, b: B) => C,
  cd: (this: void, c: C) => D,
  de: (this: void, d: D) => E,
  ef: (this: void, e: E) => F,
  fg: (this: void, f: F) => G,
): G;
export function pipe<A, B, C, D, E, F, G, H>(
  a: A,
  ab: (this: void, a: A) => B,
  bc: (this: void, b: B) => C,
  cd: (this: void, c: C) => D,
  de: (this: void, d: D) => E,
  ef: (this: void, e: E) => F,
  fg: (this: void, f: F) => G,
  gh: (this: void, g: G) => H,
): H;
export function pipe<A, B, C, D, E, F, G, H, I>(
  a: A,
  ab: (this: void, a: A) => B,
  bc: (this: void, b: B) => C,
  cd: (this: void, c: C) => D,
  de: (this: void, d: D) => E,
  ef: (this: void, e: E) => F,
  fg: (this: void, f: F) => G,
  gh: (this: void, g: G) => H,
  hi: (this: void, h: H) => I,
): I;
export function pipe<A, B, C, D, E, F, G, H, I, J>(
  a: A,
  ab: (this: void, a: A) => B,
  bc: (this: void, b: B) => C,
  cd: (this: void, c: C) => D,
  de: (this: void, d: D) => E,
  ef: (this: void, e: E) => F,
  fg: (this: void, f: F) => G,
  gh: (this: void, g: G) => H,
  hi: (this: void, h: H) => I,
  ij: (this: void, i: I) => J,
): J;
export function pipe(value: unknown, ...fns: UnknownFunction[]): unknown {
  let result = value;
  for (const fn of fns) {
    result = fn(result);
  }
  return result;
}
