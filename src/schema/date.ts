import { err, ok } from '../result';

import type { Validator } from './core';

/**
 * Creates a validator that ensures a value is a Date object
 *
 * @param {string} [message='Must be a Date object'] - Custom error message
 * @returns {Validator<unknown, Date>} A validator that checks if value is a valid Date
 *
 * @example
 * // Basic Date validation
 * const validator = date();
 * const result = validator(new Date());
 * // If valid: { ok: true, value: Date, [RESULT_BRAND]: 'ok' }
 *
 * @example
 * // Chain with other date validators
 * const futureDateValidator = chain(date(), futureDate());
 */
export function date(message: string = 'Must be a Date object'): Validator<unknown, Date> {
  return (value, path = []) => {
    if (!(value instanceof Date)) {
      return err([{ path, message }]);
    }

    // Check for Invalid Date
    if (Number.isNaN(value.getTime())) {
      return err([
        {
          path,
          message: 'Invalid Date',
        },
      ]);
    }

    return ok(value);
  };
}

/**
 * Creates a validator that ensures a Date is within a specified range.
 *
 * @param {Date} min - The minimum valid date (inclusive)
 * @param {Date} max - The maximum valid date (inclusive)
 * @param {string} [message] - Custom error message (defaults to a readable date range)
 * @returns {Validator<Date>} A validator that checks if a date is between min and max
 *
 * @example
 * // Validate that a date is within a specific range
 * const birthDate = new Date('1950-01-01');
 * const today = new Date();
 * const birthDateValidator = dateRange(birthDate, today);
 *
 * const result = birthDateValidator(new Date('1990-05-15'));
 * // If valid: { ok: true, value: Date(1990-05-15), [RESULT_BRAND]: 'ok' }
 *
 * @example
 * // With custom error message
 * const validPeriod = dateRange(
 *   new Date('2023-01-01'),
 *   new Date('2023-12-31'),
 *   'The date must be within the 2023 calendar year'
 * );
 *
 * @example
 * // Used in an object schema
 * const eventSchema = object({
 *   eventDate: required(chain(parseDate(), dateRange(startDate, endDate)))
 * });
 */
export function dateRange(
  min: Date,
  max: Date,
  message: string = `Must be between ${min.toISOString().split('T')[0]} and ${max.toISOString().split('T')[0]}`,
): Validator<Date> {
  return (value, path = []) => {
    if (value < min || value > max) {
      return err([{ path, message }]);
    }
    return ok(value);
  };
}

/**
 * Creates a validator that ensures a Date is in the past (before the current date and time).
 *
 * @param {string} [message='Must be a date in the past'] - Custom error message
 * @returns {Validator<Date>} A validator that checks if a date is in the past
 *
 * @example
 * // Validate that a date is in the past
 * const birthDateValidator = pastDate();
 * const result = birthDateValidator(new Date('1990-01-01'));
 * // If valid: { ok: true, value: Date(1990-01-01), [RESULT_BRAND]: 'ok' }
 *
 * @example
 * // With future date (invalid)
 * const tomorrow = new Date();
 * tomorrow.setDate(tomorrow.getDate() + 1);
 * const result = pastDate()(tomorrow);
 * // If invalid: { ok: false, error: [{ path: [], message: 'Must be a date in the past' }], [RESULT_BRAND]: 'error' }
 *
 * @example
 * // Used in an object schema with custom message
 * const userSchema = object({
 *   birthDate: required(chain(parseDate(), pastDate('Birth date must be in the past')))
 * });
 */
export function pastDate(message: string = 'Must be a date in the past'): Validator<Date> {
  return (value, path = []) => {
    if (value >= new Date()) {
      return err([{ path, message }]);
    }
    return ok(value);
  };
}

/**
 * Creates a validator that ensures a Date is in the future (after the current date and time).
 *
 * @param {string} [message='Must be a date in the future'] - Custom error message
 * @returns {Validator<Date>} A validator that checks if a date is in the future
 *
 * @example
 * // Validate that a date is in the future
 * const expiryDateValidator = futureDate();
 * const nextYear = new Date();
 * nextYear.setFullYear(nextYear.getFullYear() + 1);
 * const result = expiryDateValidator(nextYear);
 * // If valid: { ok: true, value: Date(next-year), [RESULT_BRAND]: 'ok' }
 *
 * @example
 * // With past date (invalid)
 * const lastYear = new Date();
 * lastYear.setFullYear(lastYear.getFullYear() - 1);
 * const result = futureDate()(lastYear);
 * // If invalid: { ok: false, error: [{ path: [], message: 'Must be a date in the future' }], [RESULT_BRAND]: 'error' }
 *
 * @example
 * // Used in an object schema with custom message
 * const subscriptionSchema = object({
 *   expirationDate: required(chain(parseDate(), futureDate('Expiration date must be in the future')))
 * });
 */
export function futureDate(message: string = 'Must be a date in the future'): Validator<Date> {
  return (value, path = []) => {
    if (value <= new Date()) {
      return err([{ path, message }]);
    }
    return ok(value);
  };
}

/**
 * Creates a validator that ensures a Date is either today or in the future.
 * This validator uses calendar date comparison (ignoring time portions).
 *
 * @param {string} [message='Must be today or a future date'] - Custom error message
 * @returns {Validator<Date>} A validator that checks if a date is today or in the future
 *
 * @example
 * // Validate that a date is today or later
 * const deliveryDateValidator = todayOrFuture();
 * const tomorrow = new Date();
 * tomorrow.setDate(tomorrow.getDate() + 1);
 * const result = deliveryDateValidator(tomorrow);
 * // If valid: { ok: true, value: Date(tomorrow), [RESULT_BRAND]: 'ok' }
 *
 * @example
 * // With a date from yesterday (invalid)
 * const yesterday = new Date();
 * yesterday.setDate(yesterday.getDate() - 1);
 * const result = todayOrFuture()(yesterday);
 * // If invalid: { ok: false, error: [{ path: [], message: 'Must be today or a future date' }], [RESULT_BRAND]: 'error' }
 *
 * @example
 * // Used in an object schema with custom message
 * const eventSchema = object({
 *   startDate: required(chain(parseDate(), todayOrFuture('Event must start today or in the future')))
 * });
 */
export function todayOrFuture(message: string = 'Must be today or a future date'): Validator<Date> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (value, path = []) => {
    if (value < today) {
      return err([{ path, message }]);
    }
    return ok(value);
  };
}
