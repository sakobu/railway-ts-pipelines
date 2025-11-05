import { err, ok } from '../result';

import type { Validator } from './core';

/**
 * Creates a validator for TypeScript enum values
 * Works with both string and numeric enums
 *
 * @template T - The enum object type
 * @param {T} enumObject - The enum object to validate against
 * @param {string} [message] - Custom error message when the value is not a valid enum value
 * @param {T[keyof T][]} [excludedValues] - Invalid values which to be excluded from the enum
 * @returns {Validator<unknown, T[keyof T]>} A validator that ensures the value is a valid enum value
 *
 * @example
 * // Define an enum
 * enum Status {
 *   Pending = "PENDING",
 *   Approved = "APPROVED",
 *   Rejected = "REJECTED"
 * }
 *
 * // Create validator for the enum
 * const statusValidator = enumValue(Status);
 *
 * @example
 * // With numeric enum
 * enum Priority {
 *   Low = 0,
 *   Medium = 1,
 *   High = 2
 * }
 * const priorityValidator = enumValue(Priority);
 * const result = priorityValidator(1);
 * // If valid: { ok: true, value: 1, [RESULT_BRAND]: 'ok' }
 *
 * @example
 * // With excluded values
 * const activeStatusValidator = enumValue(Status, "Status not allowed", ["REJECTED"]);
 * const result = activeStatusValidator("REJECTED");
 * // If invalid: { ok: false, error: [{ path: [], message: 'Status not allowed' }], [RESULT_BRAND]: 'error' }
 */
export function enumValue<T extends Record<string, string | number>>(
  enumObject: T,
  message?: string,
  excludedValues?: T[keyof T][],
): Validator<unknown, T[keyof T]> {
  return (value, path = []) => {
    const enumValues = Object.values(enumObject);

    if (!enumValues.includes(value as T[keyof T])) {
      const defaultMessage = `Value must be one of: ${enumValues.join(', ')}`;
      return err([{ path, message: message || defaultMessage }]);
    }

    if (excludedValues && excludedValues.includes(value as T[keyof T])) {
      const defaultMessage = `Selected value is excluded from valid enum values`;
      return err([{ path, message: `${message || defaultMessage}` }]);
    }

    return ok(value as T[keyof T]);
  };
}
