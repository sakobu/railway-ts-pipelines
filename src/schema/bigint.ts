import { err, ok } from '../result';

import type { Validator } from './core';

/**
 * Creates a validator that ensures a value is a bigint
 *
 * @param {string} [message] - Custom error message when validation fails
 * @returns {Validator<unknown, bigint>} A validator that checks if the value is a bigint
 *
 * @example
 * // Validate that a field is a bigint
 * const timestampField = required(bigint());
 * const schema = object({ timestampUnix: timestampField });
 *
 * @example
 * // With valid bigint input
 * const validator = bigint();
 * const result = validator(9007199254740993n);
 * // If valid: { ok: true, value: 9007199254740993n, [RESULT_BRAND]: 'ok' }
 *
 * @example
 * // With invalid input (regular number)
 * const result = bigint()(123);
 * // If invalid: { ok: false, error: [{ path: [], message: 'Must be a bigint' }], [RESULT_BRAND]: 'error' }
 */
export function bigint(message: string = 'Must be a bigint'): Validator<unknown, bigint> {
  return (value, path = []) => {
    if (typeof value !== 'bigint') {
      return err([{ path, message }]);
    }
    return ok(value);
  };
}
