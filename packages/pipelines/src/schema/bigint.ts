import { err, ok } from '../result';

import type { Validator } from './core';

/**
 * Create a validator that ensures a value is a bigint.
 *
 * @example
 * const validate = bigint();
 * validate(9007199254740993n); // ok(9007199254740993n)
 * validate(123);               // err([{ path: [], message: 'Must be a bigint' }])
 *
 * @param message - Custom error message
 * @returns A validator that checks if the value is a bigint
 */
export function bigint(message: string = 'Must be a bigint'): Validator<unknown, bigint> {
  return (value, path = []) => {
    if (typeof value !== 'bigint') {
      return err([{ path, message }]);
    }
    return ok(value);
  };
}
