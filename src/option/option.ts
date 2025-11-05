import { type Result, ok, err } from '@/result';

/**
 * Symbol used to identify Option objects.
 *
 * @internal
 */
export const OPTION_BRAND = Symbol('OPTION_BRAND');

/**
 * Represents an Option type.
 *
 * @example
 * const some: Option<number> = some(123);
 * const none: Option<number> = none();
 *
 * @param T - The type of the value contained in the Some variant
 * @returns An Option containing a value or nothing
 */
export type Option<T> =
  | {
      readonly some: true;
      readonly value: T;
      readonly [OPTION_BRAND]: 'some';
    }
  | {
      readonly some: false;
      readonly [OPTION_BRAND]: 'none';
    };

/**
 * Creates an Option containing a value.
 *
 * @param value - The value to contain
 * @returns An Option containing the value
 */
export function some<T>(value: T): Option<T> {
  return {
    some: true,
    value,
    [OPTION_BRAND]: 'some',
  };
}

/**
 * Creates an Option containing nothing.
 *
 * @example
 * const some: Option<number> = some(123);
 * const none: Option<number> = none();
 *
 * @returns An Option containing nothing
 */
export function none(): Option<never>;
export function none<T>(): Option<T>;
export function none<T>(): Option<T> {
  return {
    some: false,
    [OPTION_BRAND]: 'none',
  };
}

/**
 * Type guard that checks if an Option is a Some variant containing a value.
 *
 * @example
 * const option: Option<number> = some(123);
 * if (isSome(option)) {
 *   // TypeScript knows option.value exists here
 *   console.log(option.value);
 * }
 *
 * @param option - The option to check
 * @returns A type predicate indicating if the option is a Some variant
 */
export function isSome<T>(option: Option<T>): option is {
  readonly some: true;
  readonly value: T;
  readonly [OPTION_BRAND]: 'some';
} {
  return option.some;
}

/**
 * Type guard that checks if an Option is a None variant containing no value.
 *
 * @example
 * const option: Option<number> = none();
 * if (isNone(option)) {
 *   // TypeScript knows this option has no value
 *   // Attempting to access option.value would be a type error
 * }
 *
 * @param option - The option to check
 * @returns A type predicate indicating if the option is a None variant
 */
export function isNone<T>(option: Option<T>): option is {
  readonly some: false;
  readonly [OPTION_BRAND]: 'none';
} {
  return !option.some;
}

/**
 * Maps the value inside an Option using a transformation function.
 *
 * @example
 * const option: Option<number> = some(123);
 * const transformed: Option<string> = map(option, (value) => value.toString());
 *
 * @param option - The Option to transform
 * @param fn - The function to apply to the contained value
 * @returns A new Option containing the transformed value, or none if the input was none
 */
export function map<T, U>(option: Option<T>, fn: (value: T) => U): Option<U> {
  return option.some ? some(fn(option.value)) : none();
}

/**
 * Maps the value inside an Option using a transformation function that returns an Option.
 *
 * @example
 * const option: Option<number> = some(123);
 * const transformed: Option<string> = flatMap(option, (value) => some(value.toString()));
 *
 * @param option - The Option to transform
 * @param fn - The function to apply to the contained value, returning an Option
 * @returns The Option returned by the transformation function, or none if the input was none
 */
export function flatMap<T, U>(option: Option<T>, fn: (value: T) => Option<U>): Option<U> {
  return option.some ? fn(option.value) : none();
}

/**
 * Maps both the Some and None branches of an Option using separate transformation functions.
 * This is similar to combining a match with flatMap: it lets you decide the resulting Option in both cases.
 *
 * @example
 * const o1 = some(123);
 * const r1 = bimap(o1, (n) => some(n.toString()), () => none()); // some("123")
 *
 * const o2 = none<number>();
 * const r2 = bimap(o2, (n) => some(n.toString()), () => some('fallback')); // some("fallback")
 *
 * @param option - The Option to transform
 * @param someFn - The function to apply if the Option is Some, returning a new Option
 * @param noneFn - The function to apply if the Option is None, returning a new Option
 * @returns The Option returned by the appropriate transformation function
 */
export function bimap<T, U>(option: Option<T>, someFn: (value: T) => Option<U>, noneFn: () => Option<U>): Option<U> {
  return option.some ? someFn(option.value) : noneFn();
}

/**
 * Filters an Option based on a predicate function.
 *
 * @example
 * const option: Option<number> = some(123);
 * const filtered: Option<number> = filter(option, value => value > 100); // still Some(123)
 * const filtered2: Option<number> = filter(option, value => value < 100); // None
 *
 * @param option - The Option to filter
 * @param predicate - A function that determines if the value should be kept
 * @returns The original Option if it contains a value that satisfies the predicate, otherwise None
 */
export function filter<T>(option: Option<T>, predicate: (value: T) => boolean): Option<T> {
  return option.some && predicate(option.value) ? option : none();
}

/**
 * Unwraps the value inside an Option, throwing an error if the Option is none.
 *
 * @remarks
 * This function is intended for prototyping only and should not be used in production.
 * In production code, prefer using pattern matching or `unwrapOr` to handle both Some and None cases safely.
 *
 * @example
 * const option: Option<number> = some(123);
 * const value: number = unwrap(option);
 *
 * @param option - The Option to unwrap
 * @param [errorMsg] - Optional custom error message to throw when the Option is none
 * @returns The contained value
 */
export function unwrap<T>(option: Option<T>, errorMsg?: string): T {
  if (option.some) {
    return option.value;
  } else {
    throw new Error(errorMsg || 'Cannot unwrap a none Option');
  }
}

/**
 * Unwraps the value inside an Option, providing a default value if the Option is none.
 *
 * @example
 * const option: Option<number> = none();
 * const value: number = unwrapOr(option, 123);
 *
 * @param option - The Option to unwrap
 * @param defaultValue - The value to return if the Option is none
 * @returns The contained value, or the default value if the Option is none
 */
export function unwrapOr<T>(option: Option<T>, defaultValue: T): T {
  return option.some ? option.value : defaultValue;
}

/**
 * Unwraps the value inside an Option, calling a function to generate a default value if the Option is none.
 * Unlike unwrapOr, this only computes the default when needed.
 *
 * @example
 * const option: Option<number> = none();
 * const value = unwrapOrElse(option, () => expensiveComputation());
 *
 * @param option - The Option to unwrap
 * @param defaultFn - A function that returns a default value if the Option is none
 * @returns The contained value, or the result of calling defaultFn if the Option is none
 */
export function unwrapOrElse<T>(option: Option<T>, defaultFn: () => T): T {
  return option.some ? option.value : defaultFn();
}

/**
 * Creates an Option from a nullable value.
 *
 * @example
 * const option = fromNullable(123); // some(123)
 * const option = fromNullable(null); // none()
 *
 * @param value - The value to wrap in the Some variant
 * @returns An Option containing the value (Some) if the value is not null or undefined, or None if the value is null or undefined
 */
export const fromNullable = <T>(value: T | null | undefined): Option<T> => {
  return value === null || value === undefined ? none() : some(value);
};

/**
 * Combines an array of Options into a single Option containing an array of values.
 * Returns None if any Option in the array is None.
 *
 * @example
 * const options = [some(1), some(2), some(3)];
 * const combined = combine(options); // some([1, 2, 3])
 *
 * const withNone = [some(1), none(), some(3)];
 * const result = combine(withNone); // none()
 *
 * @param options - An array of Options to combine
 * @returns An Option containing an array of all values if all inputs are Some, or None if any input is None
 */

// Tuple-preserving overloads
export function combine<T1>(options: readonly [Option<T1>]): Option<[T1]>;
export function combine<T1, T2>(options: readonly [Option<T1>, Option<T2>]): Option<[T1, T2]>;
export function combine<T1, T2, T3>(options: readonly [Option<T1>, Option<T2>, Option<T3>]): Option<[T1, T2, T3]>;
export function combine<T1, T2, T3, T4>(
  options: readonly [Option<T1>, Option<T2>, Option<T3>, Option<T4>],
): Option<[T1, T2, T3, T4]>;
export function combine<T1, T2, T3, T4, T5>(
  options: readonly [Option<T1>, Option<T2>, Option<T3>, Option<T4>, Option<T5>],
): Option<[T1, T2, T3, T4, T5]>;
export function combine<T1, T2, T3, T4, T5, T6>(
  options: readonly [Option<T1>, Option<T2>, Option<T3>, Option<T4>, Option<T5>, Option<T6>],
): Option<[T1, T2, T3, T4, T5, T6]>;
export function combine<T1, T2, T3, T4, T5, T6, T7>(
  options: readonly [Option<T1>, Option<T2>, Option<T3>, Option<T4>, Option<T5>, Option<T6>, Option<T7>],
): Option<[T1, T2, T3, T4, T5, T6, T7]>;
export function combine<T1, T2, T3, T4, T5, T6, T7, T8>(
  options: readonly [Option<T1>, Option<T2>, Option<T3>, Option<T4>, Option<T5>, Option<T6>, Option<T7>, Option<T8>],
): Option<[T1, T2, T3, T4, T5, T6, T7, T8]>;
export function combine<T1, T2, T3, T4, T5, T6, T7, T8, T9>(
  options: readonly [
    Option<T1>,
    Option<T2>,
    Option<T3>,
    Option<T4>,
    Option<T5>,
    Option<T6>,
    Option<T7>,
    Option<T8>,
    Option<T9>,
  ],
): Option<[T1, T2, T3, T4, T5, T6, T7, T8, T9]>;
export function combine<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10>(
  options: readonly [
    Option<T1>,
    Option<T2>,
    Option<T3>,
    Option<T4>,
    Option<T5>,
    Option<T6>,
    Option<T7>,
    Option<T8>,
    Option<T9>,
    Option<T10>,
  ],
): Option<[T1, T2, T3, T4, T5, T6, T7, T8, T9, T10]>;
export function combine<T>(options: readonly Option<T>[]): Option<T[]>;

export function combine<T>(options: readonly Option<T>[]): Option<T[]> {
  const values: T[] = [];

  for (const option of options) {
    if (!option.some) return none();
    values.push(option.value);
  }

  return some(values);
}

/**
 * Pattern matches on an Option to handle both Some and None cases.
 *
 * @example
 * const option = some(42);
 * const result = match(option, {
 *   some: (value) => `Got value: ${value}`,
 *   none: () => "Got nothing"
 * }); // "Got value: 42"
 *
 * const empty = none<number>();
 * const result2 = match(empty, {
 *   some: (value) => `Got value: ${value}`,
 *   none: () => "Got nothing"
 * }); // "Got nothing"
 *
 * @param option - The Option to match against
 * @param patterns - An object containing handler functions for Some and None cases
 * @returns The result of calling the appropriate handler function
 */
export function match<T, R>(
  option: Option<T>,
  patterns: {
    some: (value: T) => R;
    none: () => R;
  },
): R {
  if (isSome(option)) {
    const someFn = patterns.some;
    return someFn(option.value);
  } else {
    const noneFn = patterns.none;
    return noneFn();
  }
}

/**
 * Executes a callback with the value if the Option is Some, without changing the Option.
 * Useful for side effects like logging while maintaining a processing chain.
 *
 * @example
 * const result = pipe(
 *   some(123),
 *   opt => map(opt, x => x * 2),
 *   opt => tap(opt, x => console.log(`Value: ${x}`)), // Logs but doesn't change the Option
 *   opt => filter(opt, x => x > 200)
 * );
 *
 * @param option - The Option to tap into
 * @param fn - The function to execute with the value if Some
 * @returns The original Option unchanged
 */
export function tap<T>(option: Option<T>, fn: (value: T) => void): Option<T> {
  if (isSome(option)) {
    const callback = fn;
    callback(option.value);
  }
  return option;
}

/**
 * Converts an Option to a Result.
 * If the Option is Some, returns an Ok variant with the value.
 * If the Option is None, returns an Err variant with the provided error.
 *
 * @example
 * const result = mapToResult(some(123), 'Some error message');
 * if (isOk(result)) {
 *   console.log('Value:', result.value);
 * } else {
 *   console.error('Error:', result.error);
 * }
 *
 * @param option - The Option to convert
 * @param error - The error to return if the Option is None
 * @returns A Result containing either the value (Ok) or the error (Err)
 */
export function mapToResult<T, E>(option: Option<T>, error: E): Result<T, E> {
  return option.some ? ok(option.value) : err(error);
}
