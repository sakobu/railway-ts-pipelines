import { err, isOk, ok } from '../result';

import type { ValidationError, Validator } from './core';

/**
 * Extracts output types from an array of validators into a tuple type.
 * @internal
 */
type TupleType<V extends ReadonlyArray<Validator<unknown, unknown>>> = {
  [K in keyof V]: V[K] extends Validator<unknown, infer O> ? O : never;
};

/**
 * Validates a heterogeneous tuple where each position has its own validator.
 *
 * @example
 * ```typescript
 * // Different types per position
 * const userRecord = tuple([
 *   chain(string(), nonEmpty()),         // id
 *   chain(number(), integer(), min(0)),  // age
 *   boolean()                             // active
 * ]);
 * // Type: [string, number, boolean]
 * ```
 *
 * @param validators - Array of validators, one for each tuple position
 * @returns A validator that ensures the input is a tuple matching the validator array
 */
export function tuple<V extends ReadonlyArray<Validator<unknown, unknown>>>(
  validators: V,
): Validator<unknown, TupleType<V>> {
  return (value, parentPath = []) => {
    if (!Array.isArray(value)) {
      return err([{ path: parentPath, message: 'Expected an array' }]);
    }

    if (value.length !== validators.length) {
      return err([
        {
          path: parentPath,
          message: `Expected tuple of length ${validators.length}, got ${value.length}`,
        },
      ]);
    }

    const allErrors: ValidationError[] = [];
    const validatedItems: unknown[] = [];

    for (const [i, validator] of validators.entries()) {
      const itemPath = [...parentPath, i.toString()];
      const item = (value as unknown[]).at(i);
      const result = validator(item, itemPath);

      if (isOk(result)) {
        validatedItems.push(result.value);
      } else {
        allErrors.push(...result.error);
      }
    }

    if (allErrors.length > 0) {
      return err(allErrors);
    }

    return ok(validatedItems as TupleType<V>);
  };
}

/**
 * Validates a homogeneous tuple where all elements have the same type and fixed length.
 *
 * @example
 * ```typescript
 * // 3D position vector
 * const position = tupleOf(
 *   chain(number(), finite(), min(-1e9), max(1e9)),
 *   3
 * );
 * // Type: [number, number, number]
 *
 * // RGB color (0-255)
 * const rgb = tupleOf(
 *   chain(number(), integer(), min(0), max(255)),
 *   3
 * );
 * // Type: [number, number, number]
 *
 * // 2D point
 * const point2D = tupleOf(number(), 2);
 * // Type: [number, number]
 * ```
 *
 * @param elementValidator - Validator to apply to each element
 * @param length - Fixed length of the tuple
 * @returns A validator that ensures the input is a tuple of the specified length
 */
export function tupleOf<T>(elementValidator: Validator<unknown, T>, length: 1): Validator<unknown, [T]>;

export function tupleOf<T>(elementValidator: Validator<unknown, T>, length: 2): Validator<unknown, [T, T]>;

export function tupleOf<T>(elementValidator: Validator<unknown, T>, length: 3): Validator<unknown, [T, T, T]>;

export function tupleOf<T>(elementValidator: Validator<unknown, T>, length: 4): Validator<unknown, [T, T, T, T]>;

export function tupleOf<T>(elementValidator: Validator<unknown, T>, length: 5): Validator<unknown, [T, T, T, T, T]>;

export function tupleOf<T>(elementValidator: Validator<unknown, T>, length: 6): Validator<unknown, [T, T, T, T, T, T]>;

export function tupleOf<T>(
  elementValidator: Validator<unknown, T>,
  length: 7,
): Validator<unknown, [T, T, T, T, T, T, T]>;

export function tupleOf<T>(
  elementValidator: Validator<unknown, T>,
  length: 8,
): Validator<unknown, [T, T, T, T, T, T, T, T]>;

export function tupleOf<T>(
  elementValidator: Validator<unknown, T>,
  length: 9,
): Validator<unknown, [T, T, T, T, T, T, T, T, T]>;

export function tupleOf<T>(
  elementValidator: Validator<unknown, T>,
  length: 10,
): Validator<unknown, [T, T, T, T, T, T, T, T, T, T]>;

export function tupleOf<T>(elementValidator: Validator<unknown, T>, length: number): Validator<unknown, T[]>;

export function tupleOf<T>(elementValidator: Validator<unknown, T>, length: number): Validator<unknown, T[]> {
  return (value, parentPath = []) => {
    if (!Array.isArray(value)) {
      return err([{ path: parentPath, message: 'Expected an array' }]);
    }

    if (value.length !== length) {
      return err([
        {
          path: parentPath,
          message: `Expected tuple of length ${length}, got ${value.length}`,
        },
      ]);
    }

    const allErrors: ValidationError[] = [];
    const validatedItems: T[] = [];

    for (const [i, item] of value.entries()) {
      const itemPath = [...parentPath, i.toString()];
      const result = elementValidator(item, itemPath);

      if (isOk(result)) {
        validatedItems.push(result.value);
      } else {
        allErrors.push(...result.error);
      }
    }

    if (allErrors.length > 0) {
      return err(allErrors);
    }

    return ok(validatedItems as T[] & { length: typeof length });
  };
}
