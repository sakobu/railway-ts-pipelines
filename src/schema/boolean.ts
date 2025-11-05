import { err, ok } from '../result';

import type { Validator } from './core';

/**
 * Creates a validator that ensures a value is a boolean.
 *
 * @param {string} [message='Must be a boolean'] - Custom error message
 * @returns {Validator<unknown, boolean>} A validator that checks if a value is a boolean
 *
 * @example
 * // Validate that a value is a boolean
 * const boolValidator = boolean();
 * const result = boolValidator(true);
 * // If valid: { ok: true, value: true, [RESULT_BRAND]: 'ok' }
 *
 * @example
 * // With invalid input
 * const result = boolean()('not a boolean');
 * // If invalid: { ok: false, error: [{ path: [], message: 'Must be a boolean' }], [RESULT_BRAND]: 'error' }
 *
 * @example
 * // Used in an object schema
 * const featureSchema = object({
 *   isEnabled: required(boolean())
 * });
 */
export function boolean(message: string = 'Must be a boolean'): Validator<unknown, boolean> {
  return (value, path = []) => {
    if (typeof value !== 'boolean') {
      return err([{ path, message }]);
    }
    return ok(value);
  };
}

/**
 * Creates a validator that ensures a boolean value matches the expected value.
 *
 * @param {boolean} expected - The expected boolean value
 * @param {string} [message] - Custom error message (defaults to 'Value must be {expected}')
 * @returns {Validator<boolean>} A validator that confirms the value matches the expected boolean
 *
 * @example
 * // Validate that a feature is enabled (true)
 * const enabledValidator = matches(true);
 * const result = enabledValidator(true);
 * // If valid: { ok: true, value: true, [RESULT_BRAND]: 'ok' }
 *
 * @example
 * // With custom message
 * const disabledValidator = matches(false, 'The option must be turned off');
 * const result = disabledValidator(true);
 * // If invalid: { ok: false, error: [{ path: [], message: 'The option must be turned off' }], [RESULT_BRAND]: 'error' }
 *
 * @example
 * // Used in an object schema
 * const featureSchema = object({
 *   isEnabled: required(matches(true, 'This feature must be enabled'))
 * });
 */
export function matches(expected: boolean, message: string = `Value must be ${expected}`): Validator<boolean> {
  return (value, path = []) => {
    if (value !== expected) {
      return err([{ path, message }]);
    }
    return ok(value);
  };
}
