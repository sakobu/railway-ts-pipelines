import type { MaybeAsync, UnknownFunction } from './types';

/**
 * Creates a new function that is the async composition of the provided functions, applied from left to right.
 * Unlike flow, flowAsync awaits between each step, enabling async composition.
 * The returned function always returns a Promise.
 *
 * @example
 * // Basic async usage
 * const processNumber = flowAsync(
 *   async (n: number) => n * 2,
 *   (n) => n + 1,
 *   async (n) => n.toString()
 * );
 *
 * const result = await processNumber(5); // "11"
 *
 * @example
 * // With Result and curried helpers
 * import { ok, flatMapWith, mapWith } from "@railway-ts/pipelines/result";
 *
 * const process = flowAsync(
 *   (n: number) => ok(n),
 *   flatMapWith(async (n) => ok(n * 2)),
 *   mapWith((n) => n.toString())
 * );
 *
 * const result = await process(5); // Result<string, never> containing "10"
 *
 * @param ab - The first function in the composition
 * @param functions - Additional functions to compose in sequence
 * @returns A new function that applies all the composed functions in sequence, returning a Promise
 */
export function flowAsync<A extends unknown[], B>(ab: (this: void, ...a: A) => MaybeAsync<B>): (...a: A) => Promise<B>;
export function flowAsync<A extends unknown[], B, C>(
  ab: (this: void, ...a: A) => MaybeAsync<B>,
  bc: (this: void, b: B) => MaybeAsync<C>,
): (...a: A) => Promise<C>;
export function flowAsync<A extends unknown[], B, C, D>(
  ab: (this: void, ...a: A) => MaybeAsync<B>,
  bc: (this: void, b: B) => MaybeAsync<C>,
  cd: (this: void, c: C) => MaybeAsync<D>,
): (...a: A) => Promise<D>;
export function flowAsync<A extends unknown[], B, C, D, E>(
  ab: (this: void, ...a: A) => MaybeAsync<B>,
  bc: (this: void, b: B) => MaybeAsync<C>,
  cd: (this: void, c: C) => MaybeAsync<D>,
  de: (this: void, d: D) => MaybeAsync<E>,
): (...a: A) => Promise<E>;
export function flowAsync<A extends unknown[], B, C, D, E, F>(
  ab: (this: void, ...a: A) => MaybeAsync<B>,
  bc: (this: void, b: B) => MaybeAsync<C>,
  cd: (this: void, c: C) => MaybeAsync<D>,
  de: (this: void, d: D) => MaybeAsync<E>,
  ef: (this: void, e: E) => MaybeAsync<F>,
): (...a: A) => Promise<F>;
export function flowAsync<A extends unknown[], B, C, D, E, F, G>(
  ab: (this: void, ...a: A) => MaybeAsync<B>,
  bc: (this: void, b: B) => MaybeAsync<C>,
  cd: (this: void, c: C) => MaybeAsync<D>,
  de: (this: void, d: D) => MaybeAsync<E>,
  ef: (this: void, e: E) => MaybeAsync<F>,
  fg: (this: void, f: F) => MaybeAsync<G>,
): (...a: A) => Promise<G>;
export function flowAsync<A extends unknown[], B, C, D, E, F, G, H>(
  ab: (this: void, ...a: A) => MaybeAsync<B>,
  bc: (this: void, b: B) => MaybeAsync<C>,
  cd: (this: void, c: C) => MaybeAsync<D>,
  de: (this: void, d: D) => MaybeAsync<E>,
  ef: (this: void, e: E) => MaybeAsync<F>,
  fg: (this: void, f: F) => MaybeAsync<G>,
  gh: (this: void, g: G) => MaybeAsync<H>,
): (...a: A) => Promise<H>;
export function flowAsync<A extends unknown[], B, C, D, E, F, G, H, I>(
  ab: (this: void, ...a: A) => MaybeAsync<B>,
  bc: (this: void, b: B) => MaybeAsync<C>,
  cd: (this: void, c: C) => MaybeAsync<D>,
  de: (this: void, d: D) => MaybeAsync<E>,
  ef: (this: void, e: E) => MaybeAsync<F>,
  fg: (this: void, f: F) => MaybeAsync<G>,
  gh: (this: void, g: G) => MaybeAsync<H>,
  hi: (this: void, h: H) => MaybeAsync<I>,
): (...a: A) => Promise<I>;
export function flowAsync<A extends unknown[], B, C, D, E, F, G, H, I, J>(
  ab: (this: void, ...a: A) => MaybeAsync<B>,
  bc: (this: void, b: B) => MaybeAsync<C>,
  cd: (this: void, c: C) => MaybeAsync<D>,
  de: (this: void, d: D) => MaybeAsync<E>,
  ef: (this: void, e: E) => MaybeAsync<F>,
  fg: (this: void, f: F) => MaybeAsync<G>,
  gh: (this: void, g: G) => MaybeAsync<H>,
  hi: (this: void, h: H) => MaybeAsync<I>,
  ij: (this: void, i: I) => MaybeAsync<J>,
): (...a: A) => Promise<J>;
export function flowAsync<A extends unknown[], B, C, D, E, F, G, H, I, J, K>(
  ab: (this: void, ...a: A) => MaybeAsync<B>,
  bc: (this: void, b: B) => MaybeAsync<C>,
  cd: (this: void, c: C) => MaybeAsync<D>,
  de: (this: void, d: D) => MaybeAsync<E>,
  ef: (this: void, e: E) => MaybeAsync<F>,
  fg: (this: void, f: F) => MaybeAsync<G>,
  gh: (this: void, g: G) => MaybeAsync<H>,
  hi: (this: void, h: H) => MaybeAsync<I>,
  ij: (this: void, i: I) => MaybeAsync<J>,
  jk: (this: void, j: J) => MaybeAsync<K>,
): (...a: A) => Promise<K>;
export function flowAsync(
  first: (...args: unknown[]) => unknown,
  ...fns: UnknownFunction[]
): (...args: unknown[]) => Promise<unknown> {
  return async (...args: unknown[]) => {
    let result = await first(...args);
    for (const fn of fns) {
      result = await fn(result);
    }
    return result;
  };
}
