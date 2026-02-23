/* eslint-disable unicorn/no-array-reduce */
import { isErr, ok, err, type Result, match } from '../result';

import { _withAbortEarly } from './core';

import type { AsyncValidator, MaybeAsyncValidator, ValidationError, ValidationResult, Validator } from './core';

/**
 * Options for controlling validation behavior.
 */
export type ValidateOptions = { abortEarly?: boolean };

/**
 * The key used in formatted error objects for root-level validation errors (i.e. errors with an empty path).
 */
export const ROOT_ERROR_KEY = '_root';

/**
 * Combine multiple validators into a single validator, applying them in sequence.
 * Each validator's output feeds into the next. Short-circuits on first error.
 */
export function chain<A, B>(v1: Validator<A, B>): Validator<A, B>;
export function chain<A, B, C>(v1: Validator<A, B>, v2: Validator<B, C>): Validator<A, C>;
export function chain<A, B, C, D>(v1: Validator<A, B>, v2: Validator<B, C>, v3: Validator<C, D>): Validator<A, D>;
export function chain<A, B, C, D, E>(
  v1: Validator<A, B>,
  v2: Validator<B, C>,
  v3: Validator<C, D>,
  v4: Validator<D, E>,
): Validator<A, E>;
export function chain<A, B, C, D, E, F>(
  v1: Validator<A, B>,
  v2: Validator<B, C>,
  v3: Validator<C, D>,
  v4: Validator<D, E>,
  v5: Validator<E, F>,
): Validator<A, F>;
export function chain<A, B, C, D, E, F, G>(
  v1: Validator<A, B>,
  v2: Validator<B, C>,
  v3: Validator<C, D>,
  v4: Validator<D, E>,
  v5: Validator<E, F>,
  v6: Validator<F, G>,
): Validator<A, G>;
export function chain<A, B, C, D, E, F, G, H>(
  v1: Validator<A, B>,
  v2: Validator<B, C>,
  v3: Validator<C, D>,
  v4: Validator<D, E>,
  v5: Validator<E, F>,
  v6: Validator<F, G>,
  v7: Validator<G, H>,
): Validator<A, H>;
export function chain<A, B, C, D, E, F, G, H, I>(
  v1: Validator<A, B>,
  v2: Validator<B, C>,
  v3: Validator<C, D>,
  v4: Validator<D, E>,
  v5: Validator<E, F>,
  v6: Validator<F, G>,
  v7: Validator<G, H>,
  v8: Validator<H, I>,
): Validator<A, I>;
export function chain<A, B, C, D, E, F, G, H, I, J>(
  v1: Validator<A, B>,
  v2: Validator<B, C>,
  v3: Validator<C, D>,
  v4: Validator<D, E>,
  v5: Validator<E, F>,
  v6: Validator<F, G>,
  v7: Validator<G, H>,
  v8: Validator<H, I>,
  v9: Validator<I, J>,
): Validator<A, J>;
export function chain<A, B, C, D, E, F, G, H, I, J, K>(
  v1: Validator<A, B>,
  v2: Validator<B, C>,
  v3: Validator<C, D>,
  v4: Validator<D, E>,
  v5: Validator<E, F>,
  v6: Validator<F, G>,
  v7: Validator<G, H>,
  v8: Validator<H, I>,
  v9: Validator<I, J>,
  v10: Validator<J, K>,
): Validator<A, K>;

/**
 * Combine multiple validators into a single validator, applying them in sequence.
 * Each validator's output feeds into the next. Short-circuits on first error.
 *
 * @example
 * const validate = chain(string(), nonEmpty(), minLength(8));
 * validate('password123'); // ok("password123")
 * validate('abc');         // err([{ path: [], message: 'Must be at least 8 characters' }])
 *
 * @param validators - A list of validators to compose
 * @returns A combined validator that applies all validators in sequence
 */
export function chain(...validators: Validator<unknown, unknown>[]): Validator<unknown, unknown> {
  return (value, path = []) => {
    let result: Result<unknown, ValidationError[]> = ok(value);

    for (const validator of validators) {
      if (isErr(result)) return result;

      const nextResult = validator(result.value, path);
      result = isErr(nextResult) ? nextResult : ok(nextResult.value);
    }

    return result;
  };
}

/**
 * Combine multiple validators (sync or async) into a single async validator.
 * Each validator's output feeds into the next. Short-circuits on first error.
 * This is the async counterpart of {@link chain}.
 *
 * @example
 * const validate = chainAsync(
 *   string(),
 *   email(),
 *   refineAsync(async (e) => !(await db.users.exists({ email: e })), 'Taken')
 * );
 * const result = await validate('new@example.com'); // ok("new@example.com")
 *
 * @param validators - A list of sync or async validators to compose
 * @returns A combined async validator that applies all validators in sequence
 */
export function chainAsync<A, B>(v1: MaybeAsyncValidator<A, B>): AsyncValidator<A, B>;
export function chainAsync<A, B, C>(v1: MaybeAsyncValidator<A, B>, v2: MaybeAsyncValidator<B, C>): AsyncValidator<A, C>;
export function chainAsync<A, B, C, D>(
  v1: MaybeAsyncValidator<A, B>,
  v2: MaybeAsyncValidator<B, C>,
  v3: MaybeAsyncValidator<C, D>,
): AsyncValidator<A, D>;
export function chainAsync<A, B, C, D, E>(
  v1: MaybeAsyncValidator<A, B>,
  v2: MaybeAsyncValidator<B, C>,
  v3: MaybeAsyncValidator<C, D>,
  v4: MaybeAsyncValidator<D, E>,
): AsyncValidator<A, E>;
export function chainAsync<A, B, C, D, E, F>(
  v1: MaybeAsyncValidator<A, B>,
  v2: MaybeAsyncValidator<B, C>,
  v3: MaybeAsyncValidator<C, D>,
  v4: MaybeAsyncValidator<D, E>,
  v5: MaybeAsyncValidator<E, F>,
): AsyncValidator<A, F>;
export function chainAsync<A, B, C, D, E, F, G>(
  v1: MaybeAsyncValidator<A, B>,
  v2: MaybeAsyncValidator<B, C>,
  v3: MaybeAsyncValidator<C, D>,
  v4: MaybeAsyncValidator<D, E>,
  v5: MaybeAsyncValidator<E, F>,
  v6: MaybeAsyncValidator<F, G>,
): AsyncValidator<A, G>;
export function chainAsync<A, B, C, D, E, F, G, H>(
  v1: MaybeAsyncValidator<A, B>,
  v2: MaybeAsyncValidator<B, C>,
  v3: MaybeAsyncValidator<C, D>,
  v4: MaybeAsyncValidator<D, E>,
  v5: MaybeAsyncValidator<E, F>,
  v6: MaybeAsyncValidator<F, G>,
  v7: MaybeAsyncValidator<G, H>,
): AsyncValidator<A, H>;
export function chainAsync<A, B, C, D, E, F, G, H, I>(
  v1: MaybeAsyncValidator<A, B>,
  v2: MaybeAsyncValidator<B, C>,
  v3: MaybeAsyncValidator<C, D>,
  v4: MaybeAsyncValidator<D, E>,
  v5: MaybeAsyncValidator<E, F>,
  v6: MaybeAsyncValidator<F, G>,
  v7: MaybeAsyncValidator<G, H>,
  v8: MaybeAsyncValidator<H, I>,
): AsyncValidator<A, I>;
export function chainAsync<A, B, C, D, E, F, G, H, I, J>(
  v1: MaybeAsyncValidator<A, B>,
  v2: MaybeAsyncValidator<B, C>,
  v3: MaybeAsyncValidator<C, D>,
  v4: MaybeAsyncValidator<D, E>,
  v5: MaybeAsyncValidator<E, F>,
  v6: MaybeAsyncValidator<F, G>,
  v7: MaybeAsyncValidator<G, H>,
  v8: MaybeAsyncValidator<H, I>,
  v9: MaybeAsyncValidator<I, J>,
): AsyncValidator<A, J>;
export function chainAsync<A, B, C, D, E, F, G, H, I, J, K>(
  v1: MaybeAsyncValidator<A, B>,
  v2: MaybeAsyncValidator<B, C>,
  v3: MaybeAsyncValidator<C, D>,
  v4: MaybeAsyncValidator<D, E>,
  v5: MaybeAsyncValidator<E, F>,
  v6: MaybeAsyncValidator<F, G>,
  v7: MaybeAsyncValidator<G, H>,
  v8: MaybeAsyncValidator<H, I>,
  v9: MaybeAsyncValidator<I, J>,
  v10: MaybeAsyncValidator<J, K>,
): AsyncValidator<A, K>;
export function chainAsync(...validators: MaybeAsyncValidator<unknown, unknown>[]): AsyncValidator<unknown, unknown> {
  return async (value, path = []) => {
    let current = value;
    for (const validator of validators) {
      const result = await validator(current, path);
      if (isErr(result)) return result;
      current = result.value;
    }
    return ok(current);
  };
}

/**
 * Validate a value against a validator.
 *
 * @example
 * const result = validate(10, chain(number(), min(5)));
 * // ok(10)
 *
 * @example
 * // With abortEarly option — stops on first error
 * const result = validate(input, userSchema, { abortEarly: true });
 *
 * @param value - The value to validate
 * @param validator - The validator to apply
 * @param pathOrOptions - Optional base path for error reporting, or options object
 * @param maybeOptions - Options object when path is also provided
 * @returns A Result containing either the validated value or validation errors
 */
export function validate<T>(value: unknown, validator: Validator<unknown, T>): Result<T, ValidationError[]>;
export function validate<T>(
  value: unknown,
  validator: Validator<unknown, T>,
  path: string[],
): Result<T, ValidationError[]>;
export function validate<T>(
  value: unknown,
  validator: Validator<unknown, T>,
  options: ValidateOptions,
): Result<T, ValidationError[]>;
export function validate<T>(
  value: unknown,
  validator: Validator<unknown, T>,
  path: string[],
  options: ValidateOptions,
): Result<T, ValidationError[]>;
export function validate<T>(
  value: unknown,
  validator: MaybeAsyncValidator<unknown, T>,
): Result<T, ValidationError[]> | Promise<Result<T, ValidationError[]>>;
export function validate<T>(
  value: unknown,
  validator: MaybeAsyncValidator<unknown, T>,
  path: string[],
): Result<T, ValidationError[]> | Promise<Result<T, ValidationError[]>>;
export function validate<T>(
  value: unknown,
  validator: MaybeAsyncValidator<unknown, T>,
  options: ValidateOptions,
): Result<T, ValidationError[]> | Promise<Result<T, ValidationError[]>>;
export function validate<T>(
  value: unknown,
  validator: MaybeAsyncValidator<unknown, T>,
  path: string[],
  options: ValidateOptions,
): Result<T, ValidationError[]> | Promise<Result<T, ValidationError[]>>;
export function validate<T>(
  value: unknown,
  validator: MaybeAsyncValidator<unknown, T>,
  pathOrOptions: string[] | ValidateOptions = [],
  maybeOptions?: ValidateOptions,
): Result<T, ValidationError[]> | Promise<Result<T, ValidationError[]>> {
  const path = Array.isArray(pathOrOptions) ? pathOrOptions : [];
  const options = Array.isArray(pathOrOptions) ? maybeOptions : pathOrOptions;

  if (options?.abortEarly) {
    return _withAbortEarly(true, () => validator(value, path));
  }
  return validator(value, path);
}

/**
 * Format validation errors into a user-friendly object.
 * Converts array paths to dot/bracket notation strings.
 *
 * @example
 * formatErrors([
 *   { path: ['name'], message: 'Required' },
 *   { path: ['items', '1'], message: 'Must be a number' },
 * ]);
 * // { name: 'Required', 'items[1]': 'Must be a number' }
 *
 * @param errors - The array of validation errors to format
 * @returns An object mapping paths to error messages
 */
export function formatErrors(errors: ValidationError[]): Record<string, string> {
  return errors.reduce(
    (acc, error) => {
      const formattedPath = error.path.reduce((path, segment, index) => {
        if (/^\d+$/.test(segment)) {
          return `${path}[${segment}]`;
        } else {
          return index === 0 ? segment : `${path}.${segment}`;
        }
      }, '');

      acc[formattedPath || ROOT_ERROR_KEY] = error.message;
      return acc;
    },
    {} as Record<string, string>,
  );
}

/**
 * Validate input and return a formatted ValidationResult in one call.
 * Combines validate() + formatErrors() + match() into a single operation.
 *
 * @example
 * const result = validateAndFormatResult(input, userSchema);
 * // { valid: true, data: { email: "user@example.com", age: 25 } }
 * // or { valid: false, errors: { email: "Invalid email", age: "Must be at least 18" } }
 *
 * @param input - The untrusted input to validate
 * @param schema - The validator/schema to validate against
 * @returns An object with either `{ valid: true, data }` or `{ valid: false, errors }`
 */
export function validateAndFormatResult<T>(
  input: unknown,
  schema: Validator<unknown, T>,
  options?: ValidateOptions,
): ValidationResult<T>;
export function validateAndFormatResult<T>(
  input: unknown,
  schema: MaybeAsyncValidator<unknown, T>,
  options?: ValidateOptions,
): ValidationResult<T> | Promise<ValidationResult<T>>;
export function validateAndFormatResult<T>(
  input: unknown,
  schema: MaybeAsyncValidator<unknown, T>,
  options?: ValidateOptions,
): ValidationResult<T> | Promise<ValidationResult<T>> {
  const run = () => {
    const result = schema(input);
    if (result instanceof Promise) {
      return result.then((r) =>
        match(r, {
          ok: (data) => ({ valid: true as const, data }),
          err: (errors) => ({ valid: false as const, errors: formatErrors(errors) }),
        }),
      );
    }
    return match(result, {
      ok: (data) => ({ valid: true as const, data }),
      err: (errors) => ({ valid: false as const, errors: formatErrors(errors) }),
    });
  };

  if (options?.abortEarly) {
    return _withAbortEarly(true, run);
  }
  return run();
}

/**
 * Create a validator that transforms a value during validation.
 * The transformer function must be pure and not throw exceptions.
 *
 * @example
 * const normalize = chain(string(), email(), transform(s => s.toLowerCase()));
 * normalize('User@Example.COM'); // ok("user@example.com")
 *
 * @param transformer - A pure function that transforms the input value
 * @returns A validator that applies the transformation
 */
export function transform<I, O>(transformer: (value: I) => O): Validator<I, O> {
  return (value) => ok(transformer(value));
}

/**
 * Create a validator that refines a value with a custom predicate.
 *
 * @example
 * const isEven = refine<number>(n => n % 2 === 0, 'Must be even');
 * isEven(4); // ok(4)
 * isEven(3); // err([{ path: [], message: 'Must be even' }])
 *
 * @param predicate - A function that returns true if the value is valid
 * @param message - The error message if validation fails
 * @returns A validator that checks the predicate
 */
export function refine<T>(
  predicate: (value: T) => boolean,
  message: string = 'Custom validation failed',
): Validator<T, T> {
  return (value, path = []) => {
    if (!predicate(value)) {
      return err([{ path, message }]);
    }
    return ok(value);
  };
}

/**
 * Create an async validator that refines a value with an asynchronous predicate.
 * This is the async counterpart of {@link refine}.
 *
 * @example
 * const unique = refineAsync<string>(
 *   async (name) => !(await db.users.exists({ name })),
 *   'Already taken'
 * );
 *
 * @param predicate - An async function returning true if the value is valid
 * @param message - The error message if validation fails
 * @returns An async validator that checks the predicate
 */
export function refineAsync<T>(
  predicate: (value: T) => Promise<boolean>,
  message: string = 'Custom validation failed',
): AsyncValidator<T, T> {
  return async (value, path = []) => {
    if (!(await predicate(value))) {
      return err([{ path, message }]);
    }
    return ok(value);
  };
}

/**
 * Create a validator that targets a specific field path with cross-field validation.
 * Unlike `refine`, receives the entire parent object and attaches errors to a specific field.
 *
 * @example
 * const validate = chain(
 *   object({ password: required(string()), confirm: required(string()) }),
 *   refineAt('confirm', (d) => d.password === d.confirm, 'Passwords must match')
 * );
 *
 * @param targetPath - The field path where the error should be attached
 * @param predicate - Validation function that receives the entire parent object
 * @param message - Error message when validation fails
 * @returns A validator for cross-field validation
 *
 * @see refine - For single-field validation without cross-field dependencies
 */
export function refineAt<T>(
  targetPath: string | string[],
  predicate: (value: T) => boolean,
  message: string,
): Validator<T, T> {
  return (value: T, parentPath: string[] = []) => {
    if (!predicate(value)) {
      const fieldPath = Array.isArray(targetPath) ? targetPath : [targetPath];
      return err([{ path: [...parentPath, ...fieldPath], message }]);
    }
    return ok(value);
  };
}

/**
 * Create an async validator that targets a specific field path with cross-field validation.
 * This is the async counterpart of {@link refineAt}.
 *
 * @example
 * const validate = chainAsync(
 *   object({ username: required(string()), email: required(email()) }),
 *   refineAtAsync(
 *     'username',
 *     async (d) => !(await db.users.exists({ username: d.username })),
 *     'Username taken'
 *   )
 * );
 *
 * @param targetPath - The field path where the error should be attached
 * @param predicate - An async function that receives the entire parent object
 * @param message - Error message when validation fails
 * @returns An async validator for cross-field validation
 *
 * @see refineAt - For synchronous cross-field validation
 */
export function refineAtAsync<T>(
  targetPath: string | string[],
  predicate: (value: T) => Promise<boolean>,
  message: string,
): AsyncValidator<T, T> {
  return async (value: T, parentPath: string[] = []) => {
    if (!(await predicate(value))) {
      const fieldPath = Array.isArray(targetPath) ? targetPath : [targetPath];
      return err([{ path: [...parentPath, ...fieldPath], message }]);
    }
    return ok(value);
  };
}
