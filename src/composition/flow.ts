type UnknownFunction = (...params: unknown[]) => unknown;

/**
 * Creates a new function that is the composition of the provided functions, applied from left to right.
 * Unlike pipe, flow doesn't immediately execute the functions but returns a new function that,
 * when called, will run the composed functions in sequence.
 *
 * @example
 * // Basic usage
 * const processNumber = flow(
 *   (n: number) => n * 2,
 *   (n) => n + 1,
 *   (n) => n.toString()
 * );
 *
 * const result = processNumber(5); // "11"
 *
 * @example
 * // With multiple arguments
 * const formatName = flow(
 *   (first: string, last: string) => `${first} ${last}`,
 *   (name) => name.toUpperCase()
 * );
 *
 * const name = formatName("John", "Doe"); // "JOHN DOE"
 *
 * @example
 * // With Option type
 * import { some, none, mapOption, flatMapOption, type Option } from "@railway-ts/pipelines/option";
 *
 * const safeParseInt = (radix: number) => (str: string): Option<number> => {
 *   const n = Number.parseInt(str, radix);
 *   return Number.isNaN(n) ? none() : some(n);
 * };
 *
 * const processString = flow(
 *   (s: string) => some(s),
 *   (o) => mapOption(o, (s) => s + "0"),
 *   (o) => flatMapOption(o, safeParseInt(10))
 * );
 *
 * const option = processString("42"); // Option<number> containing 420
 *
 * @example
 * // With Result type
 * import { ok, err, flatMapResult } from "@railway-ts/pipelines/result";
 *
 * const validatePositive = (n: number) => (n > 0 ? ok(n) : err("Not positive"));
 *
 * const validateNumber = flow(
 *   (n: number) => ok(n),
 *   (r) => flatMapResult(r, validatePositive),
 *   (r) => flatMapResult(r, (n) => ok(n * 2))
 * );
 *
 * const result = validateNumber(5); // Result<number, string> containing 10
 *
 * @param ab - The first function in the composition
 * @param functions - Additional functions to compose in sequence
 * @returns A new function that applies all the composed functions in sequence
 */
export function flow<A extends unknown[], B>(ab: (this: void, ...a: A) => B): (...a: A) => B;
export function flow<A extends unknown[], B, C>(
  ab: (this: void, ...a: A) => B,
  bc: (this: void, b: B) => C,
): (...a: A) => C;
export function flow<A extends unknown[], B, C, D>(
  ab: (this: void, ...a: A) => B,
  bc: (this: void, b: B) => C,
  cd: (this: void, c: C) => D,
): (...a: A) => D;
export function flow<A extends unknown[], B, C, D, E>(
  ab: (this: void, ...a: A) => B,
  bc: (this: void, b: B) => C,
  cd: (this: void, c: C) => D,
  de: (this: void, d: D) => E,
): (...a: A) => E;
export function flow<A extends unknown[], B, C, D, E, F>(
  ab: (this: void, ...a: A) => B,
  bc: (this: void, b: B) => C,
  cd: (this: void, c: C) => D,
  de: (this: void, d: D) => E,
  ef: (this: void, e: E) => F,
): (...a: A) => F;
export function flow<A extends unknown[], B, C, D, E, F, G>(
  ab: (this: void, ...a: A) => B,
  bc: (this: void, b: B) => C,
  cd: (this: void, c: C) => D,
  de: (this: void, d: D) => E,
  ef: (this: void, e: E) => F,
  fg: (this: void, f: F) => G,
): (...a: A) => G;
export function flow<A extends unknown[], B, C, D, E, F, G, H>(
  ab: (this: void, ...a: A) => B,
  bc: (this: void, b: B) => C,
  cd: (this: void, c: C) => D,
  de: (this: void, d: D) => E,
  ef: (this: void, e: E) => F,
  fg: (this: void, f: F) => G,
  gh: (this: void, g: G) => H,
): (...a: A) => H;
export function flow<A extends unknown[], B, C, D, E, F, G, H, I>(
  ab: (this: void, ...a: A) => B,
  bc: (this: void, b: B) => C,
  cd: (this: void, c: C) => D,
  de: (this: void, d: D) => E,
  ef: (this: void, e: E) => F,
  fg: (this: void, f: F) => G,
  gh: (this: void, g: G) => H,
  hi: (this: void, h: H) => I,
): (...a: A) => I;
export function flow<A extends unknown[], B, C, D, E, F, G, H, I, J>(
  ab: (this: void, ...a: A) => B,
  bc: (this: void, b: B) => C,
  cd: (this: void, c: C) => D,
  de: (this: void, d: D) => E,
  ef: (this: void, e: E) => F,
  fg: (this: void, f: F) => G,
  gh: (this: void, g: G) => H,
  hi: (this: void, h: H) => I,
  ij: (this: void, i: I) => J,
): (...a: A) => J;
export function flow<A extends unknown[], B, C, D, E, F, G, H, I, J, K>(
  ab: (this: void, ...a: A) => B,
  bc: (this: void, b: B) => C,
  cd: (this: void, c: C) => D,
  de: (this: void, d: D) => E,
  ef: (this: void, e: E) => F,
  fg: (this: void, f: F) => G,
  gh: (this: void, g: G) => H,
  hi: (this: void, h: H) => I,
  ij: (this: void, i: I) => J,
  jk: (this: void, j: J) => K,
): (...a: A) => K;
export function flow(...fns: [UnknownFunction, ...UnknownFunction[]]): UnknownFunction {
  if (fns.length === 1) {
    return fns[0];
  }

  const [first, ...rest] = fns;
  return (...args: unknown[]): unknown => {
    let result = first(...args);
    for (const fn of rest) {
      result = fn(result);
    }
    return result;
  };
}
