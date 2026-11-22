import type { MaybeAsync, UnknownFunction } from './types';

/**
 * Pipes a value through a series of potentially async functions, from left to right.
 * Each function receives the awaited output of the previous function.
 * Unlike pipe, pipeAsync awaits between each step, enabling async composition.
 *
 * @example
 * // Basic async usage
 * const result = await pipeAsync(
 *   5,
 *   async (n) => n * 2,    // 10
 *   (n) => n + 1,           // 11
 *   async (n) => n.toString() // "11"
 * );
 * // result: "11"
 *
 * @example
 * // With Result and curried helpers
 * import { ok, flatMapWith, mapWith } from "@railway-ts/pipelines/result";
 *
 * const result = await pipeAsync(
 *   ok(5),
 *   flatMapWith(async (n) => ok(n * 2)),
 *   mapWith((n) => n.toString())
 * );
 * // result: Result<string, never> containing "10"
 *
 * @param a - The initial value (or Promise) to pipe through the functions
 * @param ab - The first function to apply to the initial value
 * @param functions - Additional functions to apply in sequence
 * @returns A Promise of the final result after applying all functions
 */

export function pipeAsync<A, B>(a: MaybeAsync<A>, ab: (this: void, a: A) => MaybeAsync<B>): Promise<B>;
export function pipeAsync<A, B, C>(
  a: MaybeAsync<A>,
  ab: (this: void, a: A) => MaybeAsync<B>,
  bc: (this: void, b: B) => MaybeAsync<C>,
): Promise<C>;
export function pipeAsync<A, B, C, D>(
  a: MaybeAsync<A>,
  ab: (this: void, a: A) => MaybeAsync<B>,
  bc: (this: void, b: B) => MaybeAsync<C>,
  cd: (this: void, c: C) => MaybeAsync<D>,
): Promise<D>;
export function pipeAsync<A, B, C, D, E>(
  a: MaybeAsync<A>,
  ab: (this: void, a: A) => MaybeAsync<B>,
  bc: (this: void, b: B) => MaybeAsync<C>,
  cd: (this: void, c: C) => MaybeAsync<D>,
  de: (this: void, d: D) => MaybeAsync<E>,
): Promise<E>;
export function pipeAsync<A, B, C, D, E, F>(
  a: MaybeAsync<A>,
  ab: (this: void, a: A) => MaybeAsync<B>,
  bc: (this: void, b: B) => MaybeAsync<C>,
  cd: (this: void, c: C) => MaybeAsync<D>,
  de: (this: void, d: D) => MaybeAsync<E>,
  ef: (this: void, e: E) => MaybeAsync<F>,
): Promise<F>;
export function pipeAsync<A, B, C, D, E, F, G>(
  a: MaybeAsync<A>,
  ab: (this: void, a: A) => MaybeAsync<B>,
  bc: (this: void, b: B) => MaybeAsync<C>,
  cd: (this: void, c: C) => MaybeAsync<D>,
  de: (this: void, d: D) => MaybeAsync<E>,
  ef: (this: void, e: E) => MaybeAsync<F>,
  fg: (this: void, f: F) => MaybeAsync<G>,
): Promise<G>;
export function pipeAsync<A, B, C, D, E, F, G, H>(
  a: MaybeAsync<A>,
  ab: (this: void, a: A) => MaybeAsync<B>,
  bc: (this: void, b: B) => MaybeAsync<C>,
  cd: (this: void, c: C) => MaybeAsync<D>,
  de: (this: void, d: D) => MaybeAsync<E>,
  ef: (this: void, e: E) => MaybeAsync<F>,
  fg: (this: void, f: F) => MaybeAsync<G>,
  gh: (this: void, g: G) => MaybeAsync<H>,
): Promise<H>;
export function pipeAsync<A, B, C, D, E, F, G, H, I>(
  a: MaybeAsync<A>,
  ab: (this: void, a: A) => MaybeAsync<B>,
  bc: (this: void, b: B) => MaybeAsync<C>,
  cd: (this: void, c: C) => MaybeAsync<D>,
  de: (this: void, d: D) => MaybeAsync<E>,
  ef: (this: void, e: E) => MaybeAsync<F>,
  fg: (this: void, f: F) => MaybeAsync<G>,
  gh: (this: void, g: G) => MaybeAsync<H>,
  hi: (this: void, h: H) => MaybeAsync<I>,
): Promise<I>;
export function pipeAsync<A, B, C, D, E, F, G, H, I, J>(
  a: MaybeAsync<A>,
  ab: (this: void, a: A) => MaybeAsync<B>,
  bc: (this: void, b: B) => MaybeAsync<C>,
  cd: (this: void, c: C) => MaybeAsync<D>,
  de: (this: void, d: D) => MaybeAsync<E>,
  ef: (this: void, e: E) => MaybeAsync<F>,
  fg: (this: void, f: F) => MaybeAsync<G>,
  gh: (this: void, g: G) => MaybeAsync<H>,
  hi: (this: void, h: H) => MaybeAsync<I>,
  ij: (this: void, i: I) => MaybeAsync<J>,
): Promise<J>;
export async function pipeAsync(a: unknown, ...fns: UnknownFunction[]): Promise<unknown> {
  let result = await a;
  for (const fn of fns) {
    result = await fn(result);
  }
  return result;
}
