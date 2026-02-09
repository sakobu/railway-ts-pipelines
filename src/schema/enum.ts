import { err, ok } from '../result';

import type { Validator } from './core';

/**
 * Create a validator for TypeScript enum values.
 * Works with both string and numeric enums.
 *
 * @example
 * enum Status { Pending = "PENDING", Approved = "APPROVED" }
 * const validate = enumValue(Status);
 * validate("PENDING"); // ok("PENDING")
 * validate("INVALID"); // err([{ path: [], message: 'Value must be one of: PENDING, APPROVED' }])
 *
 * @example
 * // With excluded values
 * const validate = enumValue(Status, "Not allowed", [Status.Pending]);
 * validate("PENDING"); // err(...)
 *
 * @param enumObject - The enum object to validate against
 * @param message - Custom error message
 * @param excludedValues - Values to exclude from the valid set
 * @returns A validator that ensures the value is a valid enum value
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
