import { err, ok } from '../result';

import type { Validator } from './core';

/**
 * Create a validator that ensures a value is a valid Date object.
 *
 * @example
 * const validate = date();
 * validate(new Date());      // ok(Date)
 * validate('not a date');    // err([{ path: [], message: 'Must be a Date object' }])
 *
 * @param message - Custom error message
 * @returns A validator that checks if value is a valid Date
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
 * Create a validator that ensures a Date is within a specified range.
 *
 * @example
 * const validate = dateRange(new Date('2023-01-01'), new Date('2023-12-31'));
 * validate(new Date('2023-06-15')); // ok(Date)
 * validate(new Date('2024-01-01')); // err(...)
 *
 * @param min - The minimum valid date (inclusive)
 * @param max - The maximum valid date (inclusive)
 * @param message - Custom error message
 * @returns A validator that checks if a date is between min and max
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
 * Create a validator that ensures a Date is in the past.
 *
 * @example
 * const validate = pastDate();
 * validate(new Date('1990-01-01')); // ok(Date)
 *
 * @param message - Custom error message
 * @returns A validator that checks if a date is in the past
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
 * Create a validator that ensures a Date is in the future.
 *
 * @example
 * const validate = futureDate();
 * const nextYear = new Date();
 * nextYear.setFullYear(nextYear.getFullYear() + 1);
 * validate(nextYear); // ok(Date)
 *
 * @param message - Custom error message
 * @returns A validator that checks if a date is in the future
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
 * Create a validator that ensures a Date is today or in the future.
 * Uses calendar date comparison (ignoring time portions).
 *
 * @example
 * const validate = todayOrFuture();
 * validate(new Date()); // ok(Date)
 *
 * @param message - Custom error message
 * @returns A validator that checks if a date is today or in the future
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
