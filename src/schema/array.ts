import { err, isOk, ok } from '../result';

import { string } from './string';
import { chain } from './utils';

import type { ValidationError, Validator } from './core';

/**
 * Creates a validator for arrays where each item is validated by the provided item validator.
 *
 * @template I - The input type of items the validator accepts
 * @template O - The output type of items after validation
 *
 * @param {Validator<I, O>} itemValidator - The validator to apply to each array item
 * @returns {Validator<unknown, O[]>} A validator that validates arrays of items
 *
 * @example
 * // Validate an array of strings
 * const stringArrayValidator = array(string());
 *
 * @example
 * // Validate an array of enum values
 * const contactsValidator = array(stringEnum(['email', 'phone']));
 * const result = contactsValidator(['email', 'phone']);
 * // If valid: { ok: true, value: ['email', 'phone'], [RESULT_BRAND]: 'ok' }
 *
 * @example
 * // Used in an object schema
 * const userSchema = object({
 *   contacts: optional(array(stringEnum(['email', 'phone'])))
 * });
 */
export function array<I, O>(itemValidator: Validator<I, O>): Validator<unknown, O[]> {
  return (value, parentPath = []) => {
    if (!Array.isArray(value)) {
      return err([{ path: parentPath, message: 'Expected an array' }]);
    }

    const allErrors: ValidationError[] = [];
    const validatedItems: O[] = [];

    for (const [i, item] of value.entries()) {
      const itemPath = [...parentPath, i.toString()];

      const result = itemValidator(item as I, itemPath);

      if (isOk(result)) {
        validatedItems.push(result.value);
      } else {
        allErrors.push(...result.error);
      }
    }

    if (allErrors.length > 0) {
      return err(allErrors);
    }

    return ok(validatedItems);
  };
}

/**
 * Validates that an array has at least a minimum number of items
 *
 * @template T - The type of array elements
 * @param {number} min - The minimum number of items required
 * @param {string} [message] - Custom error message
 * @returns {Validator<T[], T[]>} A validator that checks minimum array length
 *
 * @example
 * // Validate that an array has at least 2 items
 * const validator = minItems(2);
 * const result = validator([1, 2, 3]);
 * // If valid: { ok: true, value: [1, 2, 3], [RESULT_BRAND]: 'ok' }
 *
 * @example
 * // With custom error message
 * const validator = minItems(3, 'Need at least 3 items');
 * const result = validator([1, 2]);
 * // If invalid: { ok: false, error: [{ path: [], message: 'Need at least 3 items' }], [RESULT_BRAND]: 'err' }
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
 * Validates that an array has at most a maximum number of items
 *
 * @template T - The type of array elements
 * @param {number} max - The maximum number of items allowed
 * @param {string} [message] - Custom error message
 * @returns {Validator<T[], T[]>} A validator that checks maximum array length
 *
 * @example
 * // Validate that an array has at most 5 items
 * const validator = maxItems(5);
 * const result = validator([1, 2, 3]);
 * // If valid: { ok: true, value: [1, 2, 3], [RESULT_BRAND]: 'ok' }
 *
 * @example
 * // With custom error message
 * const validator = maxItems(2, 'Cannot exceed 2 items');
 * const result = validator([1, 2, 3]);
 * // If invalid: { ok: false, error: [{ path: [], message: 'Cannot exceed 2 items' }], [RESULT_BRAND]: 'err' }
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
 * Validates that an array is not empty
 *
 * @template T - The type of array elements
 * @param {string} [message='Array must not be empty'] - Custom error message
 * @returns {Validator<T[], T[]>} A validator that checks the array is not empty
 *
 * @example
 * // Validate that an array is not empty
 * const validator = notEmpty();
 * const result = validator([1]);
 * // If valid: { ok: true, value: [1], [RESULT_BRAND]: 'ok' }
 *
 * @example
 * // With empty array
 * const validator = notEmpty('Please provide at least one item');
 * const result = validator([]);
 * // If invalid: { ok: false, error: [{ path: [], message: 'Please provide at least one item' }], [RESULT_BRAND]: 'err' }
 */
export function notEmpty<T>(message: string = 'Array must not be empty'): Validator<T[], T[]> {
  return minItems(1, message);
}

/**
 * Validates that an array contains only unique values
 *
 * @template T - The type of array elements
 * @param {string} [message='Array must contain unique values'] - Custom error message
 * @param {(item: T) => unknown} [keyExtractor] - Optional function to extract a comparison key from each item
 * @returns {Validator<T[], T[]>} A validator that checks for unique array values
 *
 * @example
 * // Validate unique primitive values
 * const validator = unique();
 * const result = validator([1, 2, 3]);
 * // If valid: { ok: true, value: [1, 2, 3], [RESULT_BRAND]: 'ok' }
 *
 * @example
 * // With duplicate values
 * const validator = unique();
 * const result = validator([1, 2, 2, 3]);
 * // If invalid: { ok: false, error: [{ path: ['2'], message: 'Array must contain unique values' }], [RESULT_BRAND]: 'err' }
 *
 * @example
 * // With custom key extractor for objects
 * const validator = unique<{ id: number }>(
 *   'Duplicate ID found',
 *   (item) => item.id
 * );
 * const result = validator([{ id: 1 }, { id: 2 }]);
 * // If valid: { ok: true, value: [{ id: 1 }, { id: 2 }], [RESULT_BRAND]: 'ok' }
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
 * Creates a validator that ensures a value is one of the allowed values.
 *
 * @template T - The type of the values being validated
 *
 * @param {T[]} allowedValues - Array of acceptable values
 * @param {string} [message] - Custom error message (defaults to a list of allowed values)
 * @returns {Validator<T>} A validator that checks if a value is in the allowed list
 *
 * @example
 * // Validate that a value is one of the specified options
 * const statusValidator = oneOf(['pending', 'approved', 'rejected']);
 * const result = statusValidator('approved');
 * // If valid: { ok: true, value: 'approved', [RESULT_BRAND]: 'ok' }
 * // If invalid: { ok: false, error: [{ path: [], message: 'Value must be one of: pending, approved, rejected' }], [RESULT_BRAND]: 'error' }
 *
 * @example
 * // With custom error message
 * const priorityValidator = oneOf([1, 2, 3], 'Priority must be between 1 and 3');
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
 * Creates a validator that ensures a value is a string and one of the allowed enum values.
 * This validator first checks that the input is a string, then validates it against the allowed values.
 *
 * @template T - The string literal union type of allowed values
 *
 * @param {T[]} allowedValues - Array of acceptable string enum values
 * @param {string} [message] - Custom error message (defaults to a list of allowed values)
 * @returns {Validator<unknown, T>} A validator that checks if a value is a string and in the allowed list
 *
 * @example
 * // Validate that a value is one of the specified string options
 * const roleValidator = stringEnum(['admin', 'user']);
 * const result = roleValidator('admin');
 * // If valid: { ok: true, value: 'admin', [RESULT_BRAND]: 'ok' }
 * // If invalid: { ok: false, error: [{ path: [], message: 'Value must be one of: admin, user' }], [RESULT_BRAND]: 'error' }
 *
 * @example
 * // Used in an object schema
 * const userSchema = object({
 *   role: required(stringEnum(['admin', 'user'])),
 *   contacts: optional(array(stringEnum(['email', 'phone'])))
 * });
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
