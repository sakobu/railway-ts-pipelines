import { err, isOk, ok } from '../result';

import type { MaybeAsyncValidator, ValidationError, Validator } from './core';

/**
 * Extracts output types from an array of validators into a tuple type.
 * @internal
 */
type TupleType<V extends ReadonlyArray<MaybeAsyncValidator<unknown, unknown>>> = {
  [K in keyof V]: V[K] extends Validator<unknown, infer O>
    ? O
    : V[K] extends MaybeAsyncValidator<unknown, infer O>
      ? O
      : never;
};

/**
 * Validate a heterogeneous tuple where each position has its own validator.
 *
 * @example
 * const validate = tuple([string(), number(), boolean()]);
 * validate(['a', 1, true]); // ok(["a", 1, true])
 * validate(['a', 1]);       // err([{ path: [], message: 'Expected tuple of length 3, got 2' }])
 *
 * @param validators - Array of validators, one for each tuple position
 * @returns A validator that ensures the input is a tuple matching the validator array
 */
export function tuple<V extends ReadonlyArray<Validator<unknown, unknown>>>(
  validators: V,
): Validator<unknown, TupleType<V>>;
export function tuple<V extends ReadonlyArray<MaybeAsyncValidator<unknown, unknown>>>(
  validators: V,
): MaybeAsyncValidator<unknown, TupleType<V>>;
export function tuple<V extends ReadonlyArray<MaybeAsyncValidator<unknown, unknown>>>(
  validators: V,
): MaybeAsyncValidator<unknown, TupleType<V>> {
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
    const validatedItems: unknown[] = Array.from({ length: validators.length });
    const pendingResults: Promise<void>[] = [];

    for (const [i, validator] of validators.entries()) {
      const itemPath = [...parentPath, i.toString()];
      const item = (value as unknown[]).at(i);
      const result = validator(item, itemPath);

      if (result instanceof Promise) {
        const index = i;
        pendingResults.push(
          result.then((r) => {
            if (isOk(r)) {
              // eslint-disable-next-line security/detect-object-injection -- index from Array.entries(), always a safe integer
              validatedItems[index] = r.value;
            } else {
              allErrors.push(...r.error);
            }
          }),
        );
      } else if (isOk(result)) {
        // eslint-disable-next-line security/detect-object-injection -- index from Array.entries(), always a safe integer
        validatedItems[i] = result.value;
      } else {
        allErrors.push(...result.error);
      }
    }

    if (pendingResults.length > 0) {
      return Promise.all(pendingResults).then(() => {
        if (allErrors.length > 0) return err(allErrors);
        return ok(validatedItems as TupleType<V>);
      });
    }

    if (allErrors.length > 0) return err(allErrors);
    return ok(validatedItems as TupleType<V>);
  };
}

/**
 * Validate a homogeneous tuple where all elements share the same type and fixed length.
 *
 * @example
 * const point3D = tupleOf(number(), 3);  // [number, number, number]
 * point3D([1, 2, 3]); // ok([1, 2, 3])
 * point3D([1, 2]);    // err([{ path: [], message: 'Expected tuple of length 3, got 2' }])
 *
 * @param elementValidator - Validator to apply to each element
 * @param length - Fixed length of the tuple
 * @returns A validator that ensures the input is a tuple of the specified length
 */
export function tupleOf<T>(elementValidator: Validator<unknown, T>, length: 1): Validator<unknown, [T]>;
export function tupleOf<T>(
  elementValidator: MaybeAsyncValidator<unknown, T>,
  length: 1,
): MaybeAsyncValidator<unknown, [T]>;
export function tupleOf<T>(elementValidator: Validator<unknown, T>, length: 2): Validator<unknown, [T, T]>;
export function tupleOf<T>(
  elementValidator: MaybeAsyncValidator<unknown, T>,
  length: 2,
): MaybeAsyncValidator<unknown, [T, T]>;
export function tupleOf<T>(elementValidator: Validator<unknown, T>, length: 3): Validator<unknown, [T, T, T]>;
export function tupleOf<T>(
  elementValidator: MaybeAsyncValidator<unknown, T>,
  length: 3,
): MaybeAsyncValidator<unknown, [T, T, T]>;
export function tupleOf<T>(elementValidator: Validator<unknown, T>, length: 4): Validator<unknown, [T, T, T, T]>;
export function tupleOf<T>(
  elementValidator: MaybeAsyncValidator<unknown, T>,
  length: 4,
): MaybeAsyncValidator<unknown, [T, T, T, T]>;
export function tupleOf<T>(elementValidator: Validator<unknown, T>, length: 5): Validator<unknown, [T, T, T, T, T]>;
export function tupleOf<T>(
  elementValidator: MaybeAsyncValidator<unknown, T>,
  length: 5,
): MaybeAsyncValidator<unknown, [T, T, T, T, T]>;
export function tupleOf<T>(elementValidator: Validator<unknown, T>, length: 6): Validator<unknown, [T, T, T, T, T, T]>;
export function tupleOf<T>(
  elementValidator: MaybeAsyncValidator<unknown, T>,
  length: 6,
): MaybeAsyncValidator<unknown, [T, T, T, T, T, T]>;
export function tupleOf<T>(
  elementValidator: Validator<unknown, T>,
  length: 7,
): Validator<unknown, [T, T, T, T, T, T, T]>;
export function tupleOf<T>(
  elementValidator: MaybeAsyncValidator<unknown, T>,
  length: 7,
): MaybeAsyncValidator<unknown, [T, T, T, T, T, T, T]>;
export function tupleOf<T>(
  elementValidator: Validator<unknown, T>,
  length: 8,
): Validator<unknown, [T, T, T, T, T, T, T, T]>;
export function tupleOf<T>(
  elementValidator: MaybeAsyncValidator<unknown, T>,
  length: 8,
): MaybeAsyncValidator<unknown, [T, T, T, T, T, T, T, T]>;
export function tupleOf<T>(
  elementValidator: Validator<unknown, T>,
  length: 9,
): Validator<unknown, [T, T, T, T, T, T, T, T, T]>;
export function tupleOf<T>(
  elementValidator: MaybeAsyncValidator<unknown, T>,
  length: 9,
): MaybeAsyncValidator<unknown, [T, T, T, T, T, T, T, T, T]>;
export function tupleOf<T>(
  elementValidator: Validator<unknown, T>,
  length: 10,
): Validator<unknown, [T, T, T, T, T, T, T, T, T, T]>;
export function tupleOf<T>(
  elementValidator: MaybeAsyncValidator<unknown, T>,
  length: 10,
): MaybeAsyncValidator<unknown, [T, T, T, T, T, T, T, T, T, T]>;
export function tupleOf<T>(elementValidator: Validator<unknown, T>, length: number): Validator<unknown, T[]>;
export function tupleOf<T>(
  elementValidator: MaybeAsyncValidator<unknown, T>,
  length: number,
): MaybeAsyncValidator<unknown, T[]>;
export function tupleOf<T>(
  elementValidator: MaybeAsyncValidator<unknown, T>,
  length: number,
): MaybeAsyncValidator<unknown, T[]> {
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
    const validatedItems: T[] = Array.from({ length }) as T[];
    const pendingResults: Promise<void>[] = [];

    for (const [i, item] of value.entries()) {
      const itemPath = [...parentPath, i.toString()];
      const result = elementValidator(item, itemPath);

      if (result instanceof Promise) {
        const index = i;
        pendingResults.push(
          result.then((r) => {
            if (isOk(r)) {
              // eslint-disable-next-line security/detect-object-injection -- index from Array.entries(), always a safe integer
              validatedItems[index] = r.value;
            } else {
              allErrors.push(...r.error);
            }
          }),
        );
      } else if (isOk(result)) {
        // eslint-disable-next-line security/detect-object-injection -- index from Array.entries(), always a safe integer
        validatedItems[i] = result.value;
      } else {
        allErrors.push(...result.error);
      }
    }

    if (pendingResults.length > 0) {
      return Promise.all(pendingResults).then(() => {
        if (allErrors.length > 0) return err(allErrors);
        return ok(validatedItems as T[] & { length: typeof length });
      });
    }

    if (allErrors.length > 0) return err(allErrors);
    return ok(validatedItems as T[] & { length: typeof length });
  };
}
