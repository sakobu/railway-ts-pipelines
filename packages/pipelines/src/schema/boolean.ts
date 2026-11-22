import { err, ok } from '../result';

import type { Validator } from './core';

/**
 * Create a validator that ensures a value is a boolean.
 *
 * @example
 * const validate = boolean();
 * validate(true);           // ok(true)
 * validate('not a boolean'); // err([{ path: [], message: 'Must be a boolean' }])
 *
 * @param message - Custom error message
 * @returns A validator that checks if a value is a boolean
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
 * Create a validator that ensures a boolean matches the expected value.
 *
 * @example
 * const validate = matches(true);
 * validate(true);  // ok(true)
 * validate(false); // err([{ path: [], message: 'Value must be true' }])
 *
 * @param expected - The expected boolean value
 * @param message - Custom error message
 * @returns A validator that confirms the value matches the expected boolean
 */
export function matches(expected: boolean, message: string = `Value must be ${expected}`): Validator<boolean> {
  return (value, path = []) => {
    if (value !== expected) {
      return err([{ path, message }]);
    }
    return ok(value);
  };
}
