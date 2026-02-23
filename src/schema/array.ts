import { err, isOk, ok } from '../result';

import { string } from './string';
import { chain } from './utils';

import { _getAbortEarly } from './core';

import type { MaybeAsyncValidator, ValidationError, Validator } from './core';

/**
 * Create a validator for arrays where each item is validated by the provided validator.
 *
 * @example
 * const validate = array(string());
 * validate(['a', 'b']);   // ok(["a", "b"])
 * validate('not array');  // err([{ path: [], message: 'Expected an array' }])
 *
 * @param itemValidator - The validator to apply to each array item
 * @returns A validator that validates arrays of items
 */
export function array<I, O>(itemValidator: Validator<I, O>): Validator<unknown, O[]>;
export function array<I, O>(itemValidator: MaybeAsyncValidator<I, O>): MaybeAsyncValidator<unknown, O[]>;
export function array<I, O>(itemValidator: MaybeAsyncValidator<I, O>): MaybeAsyncValidator<unknown, O[]> {
  return (value, parentPath = []) => {
    if (!Array.isArray(value)) {
      return err([{ path: parentPath, message: 'Expected an array' }]);
    }

    const abortEarly = _getAbortEarly();
    const allErrors: ValidationError[] = [];
    const validatedItems: O[] = Array.from({ length: value.length }) as O[];
    const pendingResults: Promise<void>[] = [];

    for (const [i, item] of value.entries()) {
      if (abortEarly && allErrors.length > 0) break;

      const itemPath = [...parentPath, i.toString()];
      const result = itemValidator(item as I, itemPath);

      if (result instanceof Promise) {
        if (abortEarly && allErrors.length > 0) continue;
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
        if (abortEarly) break;
      }
    }

    if (pendingResults.length > 0) {
      return Promise.all(pendingResults).then(() => {
        if (allErrors.length > 0) return err(allErrors);
        return ok(validatedItems);
      });
    }

    if (allErrors.length > 0) return err(allErrors);
    return ok(validatedItems);
  };
}

/**
 * Validate that an array has at least a minimum number of items.
 *
 * @example
 * const validate = minItems(2);
 * validate([1, 2, 3]); // ok([1, 2, 3])
 * validate([1]);       // err([{ path: [], message: 'Array must have at least 2 items' }])
 *
 * @param min - The minimum number of items required
 * @param message - Custom error message
 * @returns A validator that checks minimum array length
 */
export function minItems<T>(
  min: number,
  message: string = `Array must have at least ${min} items`,
): Validator<T[], T[]> {
  return (value, path = []) => {
    if (value.length < min) {
      return err([{ path, message }]);
    }
    return ok(value);
  };
}

/**
 * Validate that an array has at most a maximum number of items.
 *
 * @example
 * const validate = maxItems(2);
 * validate([1, 2]);    // ok([1, 2])
 * validate([1, 2, 3]); // err([{ path: [], message: 'Array must have at most 2 items' }])
 *
 * @param max - The maximum number of items allowed
 * @param message - Custom error message
 * @returns A validator that checks maximum array length
 */
export function maxItems<T>(
  max: number,
  message: string = `Array must have at most ${max} items`,
): Validator<T[], T[]> {
  return (value, path = []) => {
    if (value.length > max) {
      return err([{ path, message }]);
    }
    return ok(value);
  };
}

/**
 * Validate that an array is not empty.
 *
 * @example
 * const validate = notEmpty();
 * validate([1]);  // ok([1])
 * validate([]);   // err([{ path: [], message: 'Array must not be empty' }])
 *
 * @param message - Custom error message
 * @returns A validator that checks the array is not empty
 */
export function notEmpty<T>(message: string = 'Array must not be empty'): Validator<T[], T[]> {
  return minItems(1, message);
}

/**
 * Validate that an array contains only unique values.
 *
 * @example
 * const validate = unique();
 * validate([1, 2, 3]);    // ok([1, 2, 3])
 * validate([1, 2, 2, 3]); // err([{ path: ['2'], message: 'Array must contain unique values' }])
 *
 * @example
 * // With custom key extractor for objects
 * const validate = unique<{ id: number }>('Duplicate ID', (item) => item.id);
 *
 * @param message - Custom error message
 * @param keyExtractor - Optional function to extract a comparison key from each item
 * @returns A validator that checks for unique array values
 */
export function unique<T>(
  message: string = 'Array must contain unique values',
  keyExtractor?: (item: T) => unknown,
): Validator<T[], T[]> {
  return (value, path = []) => {
    const seen = new Set();

    for (const [i, item] of value.entries()) {
      const key = keyExtractor ? keyExtractor(item) : item;

      if (seen.has(key)) {
        return err([
          {
            path: [...path, i.toString()],
            message,
          },
        ]);
      }
      seen.add(key);
    }

    return ok(value);
  };
}

/**
 * Create a validator that ensures a value is one of the allowed values.
 *
 * @example
 * const validate = oneOf(['pending', 'approved', 'rejected']);
 * validate('approved'); // ok("approved")
 * validate('unknown');  // err([{ path: [], message: 'Value must be one of: pending, approved, rejected' }])
 *
 * @param allowedValues - Array of acceptable values
 * @param message - Custom error message
 * @returns A validator that checks if a value is in the allowed list
 */
export function oneOf<T>(
  allowedValues: T[],
  message: string = `Value must be one of: ${allowedValues.join(', ')}`,
): Validator<T> {
  return (value, path = []) => {
    if (!allowedValues.includes(value)) {
      return err([{ path, message }]);
    }
    return ok(value);
  };
}

/**
 * Create a validator that ensures a value is a string and one of the allowed enum values.
 *
 * @example
 * const validate = stringEnum(['admin', 'user']);
 * validate('admin'); // ok("admin")
 * validate(42);      // err([{ path: [], message: 'Value must be a string' }])
 * validate('other'); // err([{ path: [], message: 'Value must be one of: admin, user' }])
 *
 * @param allowedValues - Array of acceptable string enum values
 * @param message - Custom error message
 * @returns A validator that checks if a value is a string and in the allowed list
 */
export function stringEnum<T extends string>(
  allowedValues: T[],
  message: string = `Value must be one of: ${allowedValues.join(', ')}`,
): Validator<unknown, T> {
  return chain(string('Value must be a string'), (value: string, path = []) => {
    if (!allowedValues.includes(value as T)) {
      return err([{ path, message }]);
    }
    return ok(value as T);
  });
}
