import { none, some, type Option } from '@/option';

import type { MaybeAsync } from '@/composition';

// ─── Types & Constructors ───────────────────────────────────

/**
 * Symbol used to identify Result objects.
 *
 * @internal
 */
export const RESULT_BRAND = Symbol('RESULT_BRAND');

/**
 * Represents a Result type.
 *
 * @example
 * const result: Result<number, string> = ok(123);
 * const error: Result<number, string> = error("An error occurred");
 *
 * @param T - The type of the value contained in the Ok variant
 * @param E - The type of the error contained in the Error variant
 * @returns A Result containing a value or an error
 */
export type Result<T, E> =
  | {
      readonly ok: true;
      readonly value: T;
      readonly [RESULT_BRAND]: 'ok';
    }
  | {
      readonly ok: false;
      readonly error: E;
      readonly [RESULT_BRAND]: 'error';
    };

/**
 * Creates a Result containing a value.
 *
 * @example
 * const result: Result<number, string> = ok(123);
 *
 * @param value - The value to contain
 * @returns A Result containing the value
 */
export function ok<T, E = never>(value: T): Result<T, E> {
  return {
    ok: true,
    value,
    [RESULT_BRAND]: 'ok',
  };
}

/**
 * Creates a Result containing an error.
 *
 * @example
 * const error: Result<number, string> = err("An error occurred");
 *
 * @param error - The error to contain
 * @returns A Result containing the error
 */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error, [RESULT_BRAND]: 'error' };
}

// ─── Type Guards ────────────────────────────────────────────

/**
 * Type guard that checks if a Result is an Ok variant containing a value.
 *
 * @example
 * const result: Result<number, string> = ok(123);
 * if (isOk(result)) {
 *   // TypeScript knows result.value exists here
 *   console.log(result.value);
 * }
 *
 * @param result - The result to check
 * @returns A type predicate indicating if the result is an Ok variant
 */
export function isOk<T, E>(
  result: Result<T, E>,
): result is {
  readonly ok: true;
  readonly value: T;
  readonly [RESULT_BRAND]: 'ok';
} {
  return result.ok;
}

/**
 * Type guard that checks if a Result is an Error variant.
 *
 * @example
 * const result: Result<number, string> = err("error");
 * if (isErr(result)) {
 *   // TypeScript knows result.error exists here
 *   console.log(result.error);
 * }
 *
 * @param result - The result to check
 * @returns A type predicate indicating if the result is an Error variant
 */
export function isErr<T, E>(
  result: Result<T, E>,
): result is {
  readonly ok: false;
  readonly error: E;
  readonly [RESULT_BRAND]: 'error';
} {
  return !result.ok;
}

// ─── Transformations ────────────────────────────────────────

/**
 * Maps the value inside a Result using a transformation function.
 *
 * @example
 * const result: Result<number, string> = ok(123);
 * const transformed: Result<string, string> = map(result, (value) => value.toString());
 *
 * @param result - The Result to transform
 * @param fn - The function to apply to the contained value
 * @returns A new Result containing the transformed value, or the original error if the input was an error
 */
export function map<T, E, U>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : result;
}

/**
 * Maps the value inside a Result using a transformation function that returns a Result.
 *
 * @example
 * const result: Result<number, string> = ok(123);
 * const transformed: Result<string, string> = flatMap(result, (value) => ok(value.toString()));
 *
 * @param result - The Result to transform
 * @param fn - The function to apply to the contained value, returning a Result
 * @returns The Result returned by the transformation function, or the original error if the input was an error
 */
export function flatMap<T, E, U>(result: Result<T, E>, fn: (value: T) => Result<U, E>): Result<U, E> {
  return result.ok ? fn(result.value) : result;
}

/**
 * Maps the error inside a Result using a transformation function.
 *
 * @example
 * const result: Result<number, string> = err("error");
 * const transformed: Result<number, Error> = mapErr(result, (err) => new Error(err));
 *
 * @param result - The Result to transform
 * @param fn - The function to apply to the contained error
 * @returns A new Result containing the transformed error, or the original value if the input was ok
 */
export function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
  return result.ok ? result : err(fn(result.error));
}

/**
 * Maps both the value and error of a Result using separate transformation functions.
 * This is equivalent to chaining map and mapErr, but more concise.
 *
 * @example
 * const result: Result<number, string> = ok(123);
 * const transformed = bimap(
 *   result,
 *   (value) => value.toString(),
 *   (error) => new Error(error)
 * ); // ok("123")
 *
 * const error: Result<number, string> = err("failed");
 * const transformed2 = bimap(
 *   error,
 *   (value) => value.toString(),
 *   (error) => new Error(error)
 * ); // err(Error("failed"))
 *
 * @param result - The Result to transform
 * @param okFn - The function to apply to the contained value if Ok
 * @param errFn - The function to apply to the contained error if Err
 * @returns A new Result with both branches transformed
 */
export function bimap<T, E, U, F>(result: Result<T, E>, okFn: (value: T) => U, errFn: (error: E) => F): Result<U, F> {
  return result.ok ? ok(okFn(result.value)) : err(errFn(result.error));
}

/**
 * Filters a Result based on a predicate function.
 *
 * @example
 * const result: Result<number, string> = ok(123);
 * const filtered: Result<number, string> = filter(result, value => value > 100, "Value too small"); // still Ok(123)
 * const filtered2: Result<number, string> = filter(result, value => value > 200, "Value too small"); // Err("Value too small")
 *
 * @param result - The Result to filter
 * @param predicate - A function that determines if the value should be kept
 * @param error - The error to return if the predicate fails
 * @returns The original Result if it contains a value that satisfies the predicate, otherwise an Error
 */
export function filter<T, E>(result: Result<T, E>, predicate: (value: T) => boolean, error: E): Result<T, E> {
  return result.ok && predicate(result.value) ? result : err(error);
}

// ─── Side Effects ───────────────────────────────────────────

/**
 * Executes a callback with the value if the Result is Ok, without changing the Result.
 * Useful for side effects like logging while maintaining a processing chain.
 *
 * @example
 * const finalResult = pipe(
 *   ok(123),
 *   r => map(r, x => x * 2),
 *   r => tap(r, x => console.log(`Value: ${x}`)), // Logs but doesn't change the Result
 *   r => filter(r, x => x > 200, "Value too small")
 * );
 *
 * @param result - The Result to tap into
 * @param fn - The function to execute with the value if Ok
 * @returns The original Result unchanged
 */
export function tap<T, E>(result: Result<T, E>, fn: (value: T) => void): Result<T, E> {
  if (isOk(result)) {
    const callback = fn;
    callback(result.value);
  }
  return result;
}

/**
 * Executes a callback with the error if the Result is an Error, without changing the Result.
 * Useful for side effects like logging while maintaining a processing chain.
 *
 * @example
 * const finalResult = pipe(
 *   err("something went wrong"),
 *   r => tapErr(r, e => console.error(`Error: ${e}`)), // Logs but doesn't change the Result
 *   r => mapErr(r, e => new Error(e))
 * );
 *
 * @param result - The Result to tap into
 * @param fn - The function to execute with the error if Error
 * @returns The original Result unchanged
 */
export function tapErr<T, E>(result: Result<T, E>, fn: (error: E) => void): Result<T, E> {
  if (isErr(result)) {
    const callback = fn;
    callback(result.error);
  }
  return result;
}

// ─── Error Recovery ─────────────────────────────────────────

/**
 * Recovers from an Err by applying `fn` to the error value. Returns the original Ok unchanged.
 * This is the error-channel equivalent of `flatMap`.
 *
 * @example
 * const result: Result<number, string> = err("not found");
 * const recovered = orElse(result, (e) => ok(e.length)); // ok(9)
 *
 * const okResult: Result<number, string> = ok(42);
 * const kept = orElse(okResult, (e) => ok(e.length)); // ok(42)
 *
 * @param result - The Result to recover from
 * @param fn - A function that receives the Err value and returns a fallback Result
 * @returns The original Ok, or the Result of applying fn to the error
 */
export function orElse<T, E>(result: Result<T, E>, fn: (error: E) => Result<T, E>): Result<T, E> {
  return result.ok ? result : fn(result.error);
}

// ─── Pattern Matching ───────────────────────────────────────

/**
 * Pattern matches on a Result to handle both Ok and Error cases.
 *
 * @example
 * const result = ok(42);
 * const message = match(result, {
 *   ok: (value) => `Got value: ${value}`,
 *   err: (error) => `Got error: ${error}`
 * }); // "Got value: 42"
 *
 * @param result - The Result to match against
 * @param patterns - An object containing handler functions for Ok and Error cases
 * @returns The result of calling the appropriate handler function
 */
export function match<T, E, R>(
  result: Result<T, E>,
  patterns: {
    ok: (value: T) => R;
    err: (error: E) => R;
  },
): R {
  if (isOk(result)) {
    const okFn = patterns.ok;
    return okFn(result.value);
  } else {
    const errFn = patterns.err;
    return errFn(result.error);
  }
}

// ─── Unwrap ─────────────────────────────────────────────────

/**
 * Unwraps the value inside a Result, throwing an error if the Result is an error.
 *
 * @remarks
 * This function is intended for prototyping only and should not be used in production.
 * In production code, prefer using pattern matching or `unwrapOr` to handle both Ok and Error cases safely.
 *
 * @example
 * const result: Result<number, string> = ok(123);
 * const value: number = unwrap(result);
 *
 * // With custom error message
 * try {
 *   const badResult: Result<number, string> = err("Invalid data");
 *   unwrap(badResult, "Custom error message");
 * } catch (error) {
 *   // Error will contain "Custom error message" instead of the default
 * }
 *
 * @param result - The Result to unwrap
 * @param errorMsg - Optional custom error message to use if Result is an error
 * @returns The contained value
 * @throws If the Result is an error
 */
export function unwrap<T, E>(result: Result<T, E>, errorMsg?: string): T {
  if (result.ok) {
    return result.value;
  } else {
    throw new Error(errorMsg || `Cannot unwrap an error Result: ${String(result.error)}`);
  }
}

/**
 * Unwraps the value inside a Result, providing a default value if the Result is an error.
 *
 * @example
 * const result: Result<number, string> = err("error");
 * const value: number = unwrapOr(result, 123);
 *
 * @param result - The Result to unwrap
 * @param defaultValue - The value to return if the Result is an error
 * @returns The contained value, or the default value if the Result is an error
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  return result.ok ? result.value : defaultValue;
}

/**
 * Unwraps the value inside a Result, calling a function to generate a default value if the Result is an error.
 * Unlike unwrapOr, this only computes the default when needed.
 *
 * @example
 * const result: Result<number, string> = err("error");
 * const value = unwrapOrElse(result, () => expensiveComputation());
 *
 * @param result - The Result to unwrap
 * @param defaultFn - A function that returns a default value if the Result is an error
 * @returns The contained value, or the result of calling defaultFn if the Result is an error
 */
export function unwrapOrElse<T, E>(result: Result<T, E>, defaultFn: () => T): T {
  return result.ok ? result.value : defaultFn();
}

// ─── Combining ──────────────────────────────────────────────

/**
 * Combines an array of Results into a single Result containing an array of values.
 * Returns an Error if any Result in the array is an Error, using the first encountered error.
 * If an empty array is provided, returns `ok([])` (an Ok containing an empty array).
 *
 * @example
 * const results = [ok(1), ok(2), ok(3)];
 * const combined = combine(results); // ok([1, 2, 3])
 *
 * const withError = [ok(1), err("error"), ok(3)];
 * const result = combine(withError); // err("error")
 *
 * const emptyResults = [];
 * const emptyResult = combine(emptyResults); // ok([])
 *
 * @param results - An array of Results to combine
 * @returns A Result containing an array of all values if all inputs are Ok, or the first Error if any input is an Error
 */

// Tuple-preserving overloads with error type unions
export function combine<T1, E1>(results: readonly [Result<T1, E1>]): Result<[T1], E1>;
export function combine<T1, E1, T2, E2>(results: readonly [Result<T1, E1>, Result<T2, E2>]): Result<[T1, T2], E1 | E2>;
export function combine<T1, E1, T2, E2, T3, E3>(
  results: readonly [Result<T1, E1>, Result<T2, E2>, Result<T3, E3>],
): Result<[T1, T2, T3], E1 | E2 | E3>;
export function combine<T1, E1, T2, E2, T3, E3, T4, E4>(
  results: readonly [Result<T1, E1>, Result<T2, E2>, Result<T3, E3>, Result<T4, E4>],
): Result<[T1, T2, T3, T4], E1 | E2 | E3 | E4>;
export function combine<T1, E1, T2, E2, T3, E3, T4, E4, T5, E5>(
  results: readonly [Result<T1, E1>, Result<T2, E2>, Result<T3, E3>, Result<T4, E4>, Result<T5, E5>],
): Result<[T1, T2, T3, T4, T5], E1 | E2 | E3 | E4 | E5>;
export function combine<T1, E1, T2, E2, T3, E3, T4, E4, T5, E5, T6, E6>(
  results: readonly [Result<T1, E1>, Result<T2, E2>, Result<T3, E3>, Result<T4, E4>, Result<T5, E5>, Result<T6, E6>],
): Result<[T1, T2, T3, T4, T5, T6], E1 | E2 | E3 | E4 | E5 | E6>;
export function combine<T1, E1, T2, E2, T3, E3, T4, E4, T5, E5, T6, E6, T7, E7>(
  results: readonly [
    Result<T1, E1>,
    Result<T2, E2>,
    Result<T3, E3>,
    Result<T4, E4>,
    Result<T5, E5>,
    Result<T6, E6>,
    Result<T7, E7>,
  ],
): Result<[T1, T2, T3, T4, T5, T6, T7], E1 | E2 | E3 | E4 | E5 | E6 | E7>;
export function combine<T1, E1, T2, E2, T3, E3, T4, E4, T5, E5, T6, E6, T7, E7, T8, E8>(
  results: readonly [
    Result<T1, E1>,
    Result<T2, E2>,
    Result<T3, E3>,
    Result<T4, E4>,
    Result<T5, E5>,
    Result<T6, E6>,
    Result<T7, E7>,
    Result<T8, E8>,
  ],
): Result<[T1, T2, T3, T4, T5, T6, T7, T8], E1 | E2 | E3 | E4 | E5 | E6 | E7 | E8>;
export function combine<T1, E1, T2, E2, T3, E3, T4, E4, T5, E5, T6, E6, T7, E7, T8, E8, T9, E9>(
  results: readonly [
    Result<T1, E1>,
    Result<T2, E2>,
    Result<T3, E3>,
    Result<T4, E4>,
    Result<T5, E5>,
    Result<T6, E6>,
    Result<T7, E7>,
    Result<T8, E8>,
    Result<T9, E9>,
  ],
): Result<[T1, T2, T3, T4, T5, T6, T7, T8, T9], E1 | E2 | E3 | E4 | E5 | E6 | E7 | E8 | E9>;
export function combine<T1, E1, T2, E2, T3, E3, T4, E4, T5, E5, T6, E6, T7, E7, T8, E8, T9, E9, T10, E10>(
  results: readonly [
    Result<T1, E1>,
    Result<T2, E2>,
    Result<T3, E3>,
    Result<T4, E4>,
    Result<T5, E5>,
    Result<T6, E6>,
    Result<T7, E7>,
    Result<T8, E8>,
    Result<T9, E9>,
    Result<T10, E10>,
  ],
): Result<[T1, T2, T3, T4, T5, T6, T7, T8, T9, T10], E1 | E2 | E3 | E4 | E5 | E6 | E7 | E8 | E9 | E10>;
export function combine<T, E>(results: readonly Result<T, E>[]): Result<T[], E>;
export function combine<T, E>(results: readonly Result<T, E>[]): Result<T[], E> {
  const values: T[] = [];

  for (const result of results) {
    if (!result.ok) return result;
    values.push(result.value);
  }

  return ok(values);
}

/**
 * Combines an array of Results into a single Result containing an array of values.
 * Unlike combine, this collects all errors instead of returning just the first one.
 * If all Results are Ok, returns an Ok containing an array of all values.
 * If any Results are Error, returns an Error containing an array of all errors.
 *
 * @example
 * const results = [ok(1), ok(2), ok(3)];
 * const combined = combineAll(results); // ok([1, 2, 3])
 *
 * const withErrors = [ok(1), err("error1"), ok(3), err("error2")];
 * const result = combineAll(withErrors); // err(["error1", "error2"])
 *
 * const emptyResults = [];
 * const emptyResult = combineAll(emptyResults); // ok([])
 *
 * @param results - An array of Results to combine
 * @returns A Result containing an array of all values if all inputs are Ok, or an array of all errors if any input is an Error
 */

// Tuple-preserving overloads with error arrays
export function combineAll<T1, E1>(results: readonly [Result<T1, E1>]): Result<[T1], E1[]>;
export function combineAll<T1, E1, T2, E2>(
  results: readonly [Result<T1, E1>, Result<T2, E2>],
): Result<[T1, T2], (E1 | E2)[]>;
export function combineAll<T1, E1, T2, E2, T3, E3>(
  results: readonly [Result<T1, E1>, Result<T2, E2>, Result<T3, E3>],
): Result<[T1, T2, T3], (E1 | E2 | E3)[]>;
export function combineAll<T1, E1, T2, E2, T3, E3, T4, E4>(
  results: readonly [Result<T1, E1>, Result<T2, E2>, Result<T3, E3>, Result<T4, E4>],
): Result<[T1, T2, T3, T4], (E1 | E2 | E3 | E4)[]>;
export function combineAll<T1, E1, T2, E2, T3, E3, T4, E4, T5, E5>(
  results: readonly [Result<T1, E1>, Result<T2, E2>, Result<T3, E3>, Result<T4, E4>, Result<T5, E5>],
): Result<[T1, T2, T3, T4, T5], (E1 | E2 | E3 | E4 | E5)[]>;
export function combineAll<T1, E1, T2, E2, T3, E3, T4, E4, T5, E5, T6, E6>(
  results: readonly [Result<T1, E1>, Result<T2, E2>, Result<T3, E3>, Result<T4, E4>, Result<T5, E5>, Result<T6, E6>],
): Result<[T1, T2, T3, T4, T5, T6], (E1 | E2 | E3 | E4 | E5 | E6)[]>;
export function combineAll<T1, E1, T2, E2, T3, E3, T4, E4, T5, E5, T6, E6, T7, E7>(
  results: readonly [
    Result<T1, E1>,
    Result<T2, E2>,
    Result<T3, E3>,
    Result<T4, E4>,
    Result<T5, E5>,
    Result<T6, E6>,
    Result<T7, E7>,
  ],
): Result<[T1, T2, T3, T4, T5, T6, T7], (E1 | E2 | E3 | E4 | E5 | E6 | E7)[]>;
export function combineAll<T1, E1, T2, E2, T3, E3, T4, E4, T5, E5, T6, E6, T7, E7, T8, E8>(
  results: readonly [
    Result<T1, E1>,
    Result<T2, E2>,
    Result<T3, E3>,
    Result<T4, E4>,
    Result<T5, E5>,
    Result<T6, E6>,
    Result<T7, E7>,
    Result<T8, E8>,
  ],
): Result<[T1, T2, T3, T4, T5, T6, T7, T8], (E1 | E2 | E3 | E4 | E5 | E6 | E7 | E8)[]>;
export function combineAll<T1, E1, T2, E2, T3, E3, T4, E4, T5, E5, T6, E6, T7, E7, T8, E8, T9, E9>(
  results: readonly [
    Result<T1, E1>,
    Result<T2, E2>,
    Result<T3, E3>,
    Result<T4, E4>,
    Result<T5, E5>,
    Result<T6, E6>,
    Result<T7, E7>,
    Result<T8, E8>,
    Result<T9, E9>,
  ],
): Result<[T1, T2, T3, T4, T5, T6, T7, T8, T9], (E1 | E2 | E3 | E4 | E5 | E6 | E7 | E8 | E9)[]>;
export function combineAll<T1, E1, T2, E2, T3, E3, T4, E4, T5, E5, T6, E6, T7, E7, T8, E8, T9, E9, T10, E10>(
  results: readonly [
    Result<T1, E1>,
    Result<T2, E2>,
    Result<T3, E3>,
    Result<T4, E4>,
    Result<T5, E5>,
    Result<T6, E6>,
    Result<T7, E7>,
    Result<T8, E8>,
    Result<T9, E9>,
    Result<T10, E10>,
  ],
): Result<[T1, T2, T3, T4, T5, T6, T7, T8, T9, T10], (E1 | E2 | E3 | E4 | E5 | E6 | E7 | E8 | E9 | E10)[]>;
export function combineAll<T, E>(results: readonly Result<T, E>[]): Result<T[], E[]>;
export function combineAll<T, E>(results: readonly Result<T, E>[]): Result<T[], E[]> {
  const errors: E[] = [];
  const values: T[] = [];

  for (const result of results) {
    if (result.ok) {
      values.push(result.value);
    } else {
      errors.push(result.error);
    }
  }

  return errors.length > 0 ? err(errors) : ok(values);
}

// ─── Conversions ────────────────────────────────────────────

/**
 * Converts a Result to an Option.
 * If the Result is Ok, returns a Some variant with the value.
 * If the Result is an Error, returns a None variant.
 *
 * @example
 * import { some, none } from "@/option";
 *
 * const option1 = mapToOption(ok(123)); // some(123)
 * const option2 = mapToOption(err("error")); // none()
 *
 * @param result - The Result to convert
 * @returns An Option containing the value if Ok, or None if Error
 */
export function mapToOption<T, E>(result: Result<T, E>): Option<T> {
  return result.ok ? some(result.value) : none();
}

/**
 * Safely executes a function that might throw and converts the result into a Result type.
 * If the function executes successfully, returns an Ok variant with the return value.
 * If the function throws an error, returns an Error variant containing the error message as a string.
 *
 * @example
 * const parseJson = (str: string) => fromTry(() => JSON.parse(str));
 *
 * const validResult = parseJson('{"name":"John"}'); // ok({ name: 'John' })
 * const invalidResult = parseJson('invalid json'); // err("Unexpected token...")
 *
 * @param f - The function to execute
 * @returns A Result containing either the function's return value or the error message
 */
export function fromTry<T>(f: () => T): Result<T, string> {
  try {
    return ok(f());
  } catch (error) {
    return err(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Safely executes a function that might throw and converts the result into a Result type.
 * Unlike fromTry, this preserves the full Error object instead of just the message.
 * Use this when you need access to error stack traces or custom error properties.
 *
 * @example
 * const result = fromTryWithError(() => JSON.parse('invalid'));
 * if (isErr(result)) {
 *   console.log(result.error.stack); // Access to full stack trace
 * }
 *
 * @param f - The function to execute
 * @returns A Result containing either the function's return value or the full Error object
 */
export function fromTryWithError<T>(f: () => T): Result<T, Error> {
  try {
    return ok(f());
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Converts a Promise to a Result, capturing any errors that occur during promise resolution.
 * Returns error messages as strings for simplicity.
 *
 * @example
 * const result = await fromPromise(fetch('https://api.example.com/data'));
 * if (isErr(result)) {
 *   console.log(result.error); // Error message as string
 * }
 *
 * @param promise - The Promise to convert
 * @returns A Promise that resolves to a Result with string error messages
 */
export async function fromPromise<T>(promise: Promise<T>): Promise<Result<T, string>> {
  try {
    const value = await promise;
    return ok(value);
  } catch (error) {
    return err(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Converts a Promise to a Result, preserving the full error object or custom error type.
 * Use this when you need access to error stack traces, custom properties, or specific error types.
 *
 * @example
 * // With default error handling (preserves full error)
 * const result = await fromPromiseWithError(fetch('https://api.example.com/data'));
 *
 * @example
 * // With specific error type and transformer
 * type ApiError = { code: number; message: string };
 *
 * const result = await fromPromiseWithError<Response, ApiError>(
 *   fetch('https://api.example.com/data'),
 *   (error) => ({
 *     code: error instanceof Error ? 500 : 400,
 *     message: error instanceof Error ? error.message : String(error)
 *   })
 * );
 *
 * @param promise - The Promise to convert
 * @param errorFn - Optional function to transform caught errors to the expected error type
 * @returns A Promise that resolves to a Result
 */
export async function fromPromiseWithError<T, E = unknown>(
  promise: Promise<T>,
  errorFn: (error: unknown) => E = (error) => error as unknown as E,
): Promise<Result<T, E>> {
  try {
    const value = await promise;
    return ok(value);
  } catch (error) {
    return err(errorFn(error));
  }
}

/**
 * Converts a Result to a Promise.
 *
 * @example
 * const result = ok(123);
 * const promise = toPromise(result);
 * const value = await promise; // 123
 *
 * @param result - The Result to convert
 * @returns A Promise that resolves to the value if Ok, or rejects with the error if Error
 */
export function toPromise<T, E>(result: Result<T, E>): Promise<T> {
  return result.ok ? Promise.resolve(result.value) : Promise.reject(result.error);
}

// ─── Curried / Point-Free ───────────────────────────────────

/**
 * Curried version of `map`. Returns a function that transforms the Ok value using `fn`,
 * passing through any Err unchanged.
 *
 * @example
 * const double = mapWith((n: number) => n * 2);
 *
 * const result: Result<number, string> = ok(5);
 * const doubled: Result<number, string> = double(result); // ok(10)
 *
 * const errResult: Result<number, string> = err("fail");
 * const stillErr: Result<number, string> = double(errResult); // err("fail")
 *
 * // Point-free in a pipe
 * const result2 = pipe(ok(3), mapWith((n: number) => n + 1)); // ok(4)
 *
 * @param fn - The function to apply to the Ok value
 * @returns A function that takes a Result and returns a new Result with the Ok value transformed
 */
export function mapWith<T, U>(fn: (value: T) => U): <E>(result: Result<T, E>) => Result<U, E> {
  return (result) => map(result, fn);
}

/**
 * Curried version of `flatMap`. Returns a function that chains on an Ok value using `fn`,
 * passing through any Err unchanged. Supports both sync and async step functions.
 *
 * @example
 * const toStr = flatMapWith((n: number) => ok(n.toString()));
 *
 * const result: Result<number, string> = ok(5);
 * const chained: Result<string, string> = toStr(result); // ok("5")
 *
 * const errResult: Result<number, string> = err("fail");
 * const stillErr: Result<string, string> = toStr(errResult); // err("fail")
 *
 * // Async step function in a pipe
 * const fetchUser = flatMapWith(async (id: number) => {
 *   const user = await getUser(id);
 *   return user ? ok(user) : err("not found" as const);
 * });
 *
 * @param fn - The function to apply to the Ok value, returning a Result or Promise<Result>
 * @returns A function that takes a Result and returns a (possibly async) Result
 */
export function flatMapWith<T, U, E>(
  fn: (value: T) => Promise<Result<U, E>>,
): (result: Result<T, E>) => Promise<Result<U, E>>;
export function flatMapWith<T, U, E>(fn: (value: T) => Result<U, E>): (result: Result<T, E>) => Result<U, E>;
export function flatMapWith<T, U, E>(
  fn: (value: T) => MaybeAsync<Result<U, E>>,
): (result: Result<T, E>) => MaybeAsync<Result<U, E>> {
  return (result: Result<T, E>) => {
    if (!result.ok) return result;
    return fn(result.value);
  };
}

/**
 * Curried version of `mapErr`. Returns a function that transforms the Err value using `fn`,
 * passing through any Ok unchanged.
 *
 * @example
 * const wrapError = mapErrWith((msg: string) => new Error(msg));
 *
 * const result: Result<number, string> = err("fail");
 * const wrapped: Result<number, Error> = wrapError(result); // err(Error("fail"))
 *
 * const okResult: Result<number, string> = ok(42);
 * const stillOk: Result<number, Error> = wrapError(okResult); // ok(42)
 *
 * // Point-free in a pipe
 * const result2 = pipe(err("oops"), mapErrWith((s: string) => s.toUpperCase())); // err("OOPS")
 *
 * @param fn - The function to apply to the Err value
 * @returns A function that takes a Result and returns a new Result with the Err value transformed
 */
export function mapErrWith<E, F>(fn: (error: E) => F): <T>(result: Result<T, E>) => Result<T, F> {
  return (result) => mapErr(result, fn);
}

/**
 * Curried version of `filter`. Returns a function that keeps an Ok value matching the predicate,
 * or returns the provided error if the predicate fails.
 *
 * @example
 * const isPositive = filterWith((n: number) => n > 0, "must be positive");
 *
 * const result: Result<number, string> = ok(5);
 * const filtered: Result<number, string> = isPositive(result); // ok(5)
 *
 * const zero: Result<number, string> = ok(-1);
 * const failed: Result<number, string> = isPositive(zero); // err("must be positive")
 *
 * // Point-free in a pipe
 * const result2 = pipe(ok(10), filterWith((n: number) => n < 100, "too large")); // ok(10)
 *
 * @param predicate - A function that determines if the Ok value should be kept
 * @param error - The error to return if the predicate fails
 * @returns A function that takes a Result and returns the original Result or an Err
 */
export function filterWith<T, E>(predicate: (value: T) => boolean, error: E): (result: Result<T, E>) => Result<T, E> {
  return (result) => filter(result, predicate, error);
}

/**
 * Curried version of `tap`. Returns a function that performs a side effect on the Ok value
 * without changing the Result. Err values pass through untouched. Supports both sync and async
 * side effects.
 *
 * @example
 * const log = tapWith((n: number) => console.log("value:", n));
 *
 * const result: Result<number, string> = ok(5);
 * const same: Result<number, string> = log(result); // logs "value: 5", returns ok(5)
 *
 * const errResult: Result<number, string> = err("fail");
 * const stillErr: Result<number, string> = log(errResult); // no log, returns err("fail")
 *
 * // Async side effect in a pipe
 * const audit = tapWith(async (user: User) => {
 *   await saveAuditLog(user.id);
 * });
 *
 * @param fn - The side-effect function to execute on the Ok value
 * @returns A function that takes a Result, performs the side effect if Ok, and returns the original Result
 */
export function tapWith<T, E>(fn: (value: T) => Promise<void>): (result: Result<T, E>) => Promise<Result<T, E>>;
export function tapWith<T, E>(fn: (value: T) => void): (result: Result<T, E>) => Result<T, E>;
export function tapWith<T, E>(fn: (value: T) => MaybeAsync<void>): (result: Result<T, E>) => MaybeAsync<Result<T, E>> {
  return (result: Result<T, E>) => {
    if (!result.ok) return result;
    const out = fn(result.value);
    if (out instanceof Promise) return out.then(() => result);
    return result;
  };
}

/**
 * Curried version of `tapErr`. Returns a function that performs a side effect on the Err value
 * without changing the Result. Ok values pass through untouched.
 *
 * @example
 * const logErr = tapErrWith((msg: string) => console.error("error:", msg));
 *
 * const errResult: Result<number, string> = err("fail");
 * const same: Result<number, string> = logErr(errResult); // logs "error: fail", returns err("fail")
 *
 * const okResult: Result<number, string> = ok(42);
 * const stillOk: Result<number, string> = logErr(okResult); // no log, returns ok(42)
 *
 * // Point-free in a pipe
 * const result = pipe(err("oops"), tapErrWith((e: string) => reportError(e)));
 *
 * @param fn - The side-effect function to execute on the Err value
 * @returns A function that takes a Result, performs the side effect if Err, and returns the original Result
 */
export function tapErrWith<E>(fn: (error: E) => void): <T>(result: Result<T, E>) => Result<T, E> {
  return (result) => tapErr(result, fn);
}

/**
 * Curried version of `orElse`. Recovers from an Err by applying `fn` to the error value;
 * passes through Ok unchanged.
 *
 * @example
 * const recover = orElseWith((msg: string) => ok(msg.length));
 *
 * const errResult: Result<number, string> = err("fail");
 * const recovered: Result<number, string> = recover(errResult); // ok(4)
 *
 * const okResult: Result<number, string> = ok(42);
 * const kept: Result<number, string> = recover(okResult); // ok(42)
 *
 * // Point-free in a pipe — recover using the error
 * const result = pipe(
 *   err("not found"),
 *   orElseWith((e: string) => ok(`recovered from: ${e}`) as Result<string, string>)
 * ); // ok("recovered from: not found")
 *
 * @param fn - A function that receives the Err value and returns a fallback Result
 * @returns A function that takes a Result and returns either the original Ok or the result of calling fn
 */
export function orElseWith<T, E>(fn: (error: E) => Result<T, E>): (result: Result<T, E>) => Result<T, E> {
  return (result) => orElse(result, fn);
}
