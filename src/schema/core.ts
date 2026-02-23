/* eslint-disable security/detect-object-injection -- keys from Object.entries() on schema-defined fields, always safe */
import { err, isOk, ok, type Result } from '../result';

/**
 * Represents a validation error with path information and a message.
 */
export type ValidationError = {
  path: string[];
  message: string;
};

/**
 * A synchronous validator function that checks if a value meets certain criteria.
 *
 * @param value - The value to validate
 * @param path - The path to the current value (used for nested objects)
 * @returns A Result containing either the validated value or validation errors
 */
export type Validator<I, O = I> = (value: I, path?: string[]) => Result<O, ValidationError[]>;

/**
 * An asynchronous validator function that always returns a Promise.
 *
 * @param value - The value to validate
 * @param path - The path to the current value (used for nested objects)
 * @returns A Promise resolving to a Result
 */
export type AsyncValidator<I, O = I> = (value: I, path?: string[]) => Promise<Result<O, ValidationError[]>>;

/**
 * A validator function that may return either a synchronous Result or a Promise.
 * Use this type when a validator accepts both sync and async validators
 * (e.g., in `object()` schemas that mix sync and async field validators).
 *
 * @param value - The value to validate
 * @param path - The path to the current value (used for nested objects)
 * @returns A Result or Promise of Result
 */
export type MaybeAsyncValidator<I, O = I> = (
  value: I,
  path?: string[],
) => Result<O, ValidationError[]> | Promise<Result<O, ValidationError[]>>;

/**
 * Extracts the union of output types from a validator map.
 * Used by {@link discriminatedUnion} to infer the output type from the map's validators.
 */
export type ValidatorMapOutput<M extends Record<string, MaybeAsyncValidator<unknown, unknown>>> = {
  [K in keyof M]: M[K] extends MaybeAsyncValidator<unknown, infer O> ? O : never;
}[keyof M];

type AtomicType = string | number | boolean | Date | null | undefined | bigint;

type RemoveUndefined<T> = T extends undefined ? never : T;

type ProcessType<T> = T extends AtomicType
  ? T
  : T extends readonly [unknown, ...unknown[]]
    ? { [K in keyof T]: ProcessType<T[K]> }
    : T extends [unknown, ...unknown[]]
      ? { [K in keyof T]: ProcessType<T[K]> }
      : T extends Array<infer U>
        ? Array<ProcessType<U>>
        : T extends object
          ? {
              [K in keyof T as undefined extends T[K] ? never : K]: ProcessType<T[K]>;
            } & {
              [K in keyof T as undefined extends T[K] ? K : never]?: ProcessType<RemoveUndefined<T[K]>>;
            } extends infer O
            ? { [K in keyof O]: O[K] }
            : never
          : T;

// Infer the output type of a validator or schema
type InferType<V> =
  V extends Validator<unknown, infer O>
    ? O
    : V extends AsyncValidator<unknown, infer O>
      ? O
      : V extends MaybeAsyncValidator<unknown, infer O>
        ? O
        : never;

/**
 * Infer the output type of a validator or schema after processing.
 * Useful for getting the TypeScript type that a validator will produce.
 */
export type InferSchemaType<V> = ProcessType<InferType<V>>;

/**
 * A validation schema where each key maps to a synchronous validator for that field.
 */
export type SyncSchema<T = Record<string, unknown>> = {
  [K in keyof T]: Validator<unknown, T[K]>;
};

/**
 * A validation schema that accepts both sync and async validators.
 * Use {@link SyncSchema} when all validators are synchronous to preserve sync return types.
 */
export type Schema<T = Record<string, unknown>> = {
  [K in keyof T]: MaybeAsyncValidator<unknown, T[K]>;
};

/**
 * The result of a validation operation.
 */
export type ValidationResult<T> = { valid: true; data: T } | { valid: false; errors: Record<string, string> };

// --- Abort-early context (internal) ---
let _abortEarly = false;

/** @internal */
export function _getAbortEarly(): boolean {
  return _abortEarly;
}

/** @internal - Sets abortEarly for the duration of fn's synchronous execution */
export function _withAbortEarly<T>(enabled: boolean, fn: () => T): T {
  const prev = _abortEarly;
  _abortEarly = enabled;
  try {
    return fn();
  } finally {
    _abortEarly = prev;
  }
}

/**
 * Create a validator for objects based on a schema.
 *
 * @example
 * const userSchema = object({
 *   name: required(string()),
 *   age: required(chain(parseNumber(), min(18))),
 * });
 * userSchema({ name: 'John', age: 25 }); // ok({ name: "John", age: 25 })
 *
 * @param schema - An object where each key contains a validator for that property
 * @param options - Options object. `strict` (default true) rejects extra properties
 * @returns A validator that validates objects against the schema
 */
export function object<T extends Record<string, unknown>>(
  schema: SyncSchema<T>,
  options?: { strict?: boolean },
): Validator<unknown, T>;
export function object<T extends Record<string, unknown>>(
  schema: Schema<T>,
  options?: { strict?: boolean },
): MaybeAsyncValidator<unknown, T>;
export function object<T extends Record<string, unknown>>(
  schema: Schema<T>,
  { strict = true }: { strict?: boolean } = {},
): MaybeAsyncValidator<unknown, T> {
  return (obj, parentPath = []) => {
    if (obj === null || typeof obj !== 'object') {
      return err([{ path: parentPath, message: 'Expected an object' }]);
    }

    const abortEarly = _getAbortEarly();
    const allErrors: ValidationError[] = [];
    const validatedObj: Record<string, unknown> = {};

    if (strict !== false) {
      const extraKeys = Object.keys(obj as object).filter((key) => !Object.prototype.hasOwnProperty.call(schema, key));

      if (extraKeys.length > 0) {
        if (abortEarly) {
          return err([{ path: [...parentPath, extraKeys[0]!], message: `Unexpected field: '${extraKeys[0]}'` }]);
        }
        for (const key of extraKeys) {
          allErrors.push({
            path: [...parentPath, key],
            message: `Unexpected field: '${key}'`,
          });
        }
      }
    }

    if (abortEarly && allErrors.length > 0) return err(allErrors);

    const pendingResults: Promise<void>[] = [];

    for (const key in schema) {
      if (!Object.prototype.hasOwnProperty.call(schema, key)) continue;

      const validator = schema[key];
      if (!validator) continue;

      if (abortEarly && allErrors.length > 0) break;

      const value = (obj as Record<string, unknown>)[key];
      const fieldPath = [...parentPath, key];

      const result = validator(value, fieldPath);

      if (result instanceof Promise) {
        if (abortEarly && allErrors.length > 0) continue;
        pendingResults.push(
          result.then((r) => {
            if (isOk(r)) {
              validatedObj[key] = r.value;
            } else {
              allErrors.push(...r.error);
            }
          }),
        );
      } else if (isOk(result)) {
        validatedObj[key] = result.value;
      } else {
        allErrors.push(...result.error);
        if (abortEarly) break;
      }
    }

    if (pendingResults.length > 0) {
      return Promise.all(pendingResults).then(() => {
        if (allErrors.length > 0) return err(allErrors);
        return ok(validatedObj as T);
      });
    }

    if (allErrors.length > 0) return err(allErrors);
    return ok(validatedObj as T);
  };
}

/**
 * Create a validator that requires a value to be defined (not null or undefined).
 *
 * @example
 * const validate = required(string());
 * validate('hello');   // ok("hello")
 * validate(undefined); // err([{ path: [], message: 'Field is required' }])
 *
 * @param validator - The validator to apply if the value is defined
 * @param message - Error message when value is null or undefined
 * @returns A validator that checks the value is defined
 */
export function required<I, O>(validator: Validator<I, O>, message?: string): Validator<I | undefined | null, O>;
export function required<I, O>(
  validator: MaybeAsyncValidator<I, O>,
  message?: string,
): MaybeAsyncValidator<I | undefined | null, O>;
export function required<I, O>(
  validator: MaybeAsyncValidator<I, O>,
  message: string = 'Field is required',
): MaybeAsyncValidator<I | undefined | null, O> {
  return (value, path = []) => {
    if (value === undefined || value === null) {
      return err([{ path, message }]);
    }
    return validator(value as I, path);
  };
}

/**
 * Create a validator that makes a field optional.
 * Returns undefined for null/undefined values, otherwise applies the validator.
 *
 * @example
 * const validate = optional(string());
 * validate(undefined); // ok(undefined)
 * validate('hello');   // ok("hello")
 *
 * @param validator - The validator to apply if the value is defined
 * @returns A validator that allows undefined values
 */
export function optional<I, O>(validator: Validator<I, O>): Validator<I | undefined | null, O | undefined>;
export function optional<I, O>(
  validator: MaybeAsyncValidator<I, O>,
): MaybeAsyncValidator<I | undefined | null, O | undefined>;
export function optional<I, O>(
  validator: MaybeAsyncValidator<I, O>,
): MaybeAsyncValidator<I | undefined | null, O | undefined> {
  return (value, path = []) => {
    if (value === undefined || value === null) {
      // eslint-disable-next-line unicorn/no-useless-undefined
      return ok(undefined);
    }
    return validator(value, path);
  };
}

/**
 * Create a validator that only accepts null values.
 *
 * @example
 * const validate = nullable();
 * validate(null);        // ok(null)
 * validate('some value'); // err([{ path: [], message: 'Must be null' }])
 *
 * @param message - Custom error message
 * @returns A validator that ensures the value is exactly null
 */
export function nullable(message: string = 'Must be null'): Validator<unknown, null> {
  return (value, path = []) => {
    if (value !== null) {
      return err([{ path, message }]);
    }
    // eslint-disable-next-line unicorn/no-null
    return ok(null);
  };
}

/**
 * Create a validator that treats empty strings, empty arrays, and empty objects as optional.
 *
 * @example
 * const schema = object({
 *   bio: emptyAsOptional(chain(string(), maxLength(500))),
 * });
 * schema({ bio: '' });      // ok({ bio: undefined })
 * schema({ bio: 'Hello' }); // ok({ bio: "Hello" })
 *
 * @param validator - The validator to apply if the value is not empty
 * @returns A validator that treats empty values as undefined
 */
export function emptyAsOptional<I, O>(validator: Validator<I, O>): Validator<I | undefined | null, O | undefined>;
export function emptyAsOptional<I, O>(
  validator: MaybeAsyncValidator<I, O>,
): MaybeAsyncValidator<I | undefined | null, O | undefined>;
export function emptyAsOptional<I, O>(
  validator: MaybeAsyncValidator<I, O>,
): MaybeAsyncValidator<I | undefined | null, O | undefined> {
  return (value, path = []) => {
    // Handle empty strings, empty arrays, etc.
    if (
      value === '' ||
      (Array.isArray(value) && value.length === 0) ||
      (typeof value === 'object' && value !== null && Object.keys(value).length === 0)
    ) {
      // eslint-disable-next-line unicorn/no-useless-undefined
      return ok(undefined);
    }

    // Delegate to the built-in optional for other cases
    return optional(validator)(value, path);
  };
}

/**
 * Create a validator that checks if a value exactly matches the expected literal.
 *
 * @example
 * const validate = literal('active');
 * validate('active');    // ok("active")
 * validate('completed'); // err([{ path: [], message: "Value must be 'active'" }])
 *
 * @param expectedValue - The exact value that should be matched
 * @param message - Custom error message
 * @returns A validator that checks if the value matches the literal
 */
export function literal<T>(
  expectedValue: T,
  message: string = `Value must be '${String(expectedValue)}'`,
): Validator<unknown, T> {
  return (value, path = []) => {
    if (value !== expectedValue) {
      return err([{ path, message }]);
    }
    return ok(expectedValue);
  };
}
