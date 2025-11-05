import { err, ok } from '../result';

import type { Validator } from './core';

/**
 * Creates a validator that ensures a value is a number and not NaN.
 *
 * @param {string} [message='Must be a number'] - Custom error message
 * @returns {Validator<unknown, number>} A validator that checks if a value is a number
 *
 * @example
 * // Validate that a value is a number
 * const ageValidator = number();
 * const result = ageValidator(25);
 * // If valid: { ok: true, value: 25, [RESULT_BRAND]: 'ok' }
 *
 * @example
 * // With invalid input
 * const result = number()('not a number');
 * // If invalid: { ok: false, error: [{ path: [], message: 'Must be a number' }], [RESULT_BRAND]: 'error' }
 *
 * @example
 * // Used in an object schema
 * const productSchema = object({
 *   price: required(number())
 * });
 */
export function number(message: string = 'Must be a number'): Validator<unknown, number> {
  return (value, path = []) => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return err([{ path, message }]);
    }
    return ok(value);
  };
}

/**
 * Creates a validator that ensures a number is greater than or equal to a minimum value.
 *
 * @param {number} value - The minimum value (inclusive)
 * @param {string} [message] - Custom error message (defaults to 'Must be at least {value}')
 * @returns {Validator<number>} A validator that checks if a number is at least the minimum value
 *
 * @example
 * // Validate that a number is at least 18
 * const adultAgeValidator = min(18);
 * const result = adultAgeValidator(21);
 * // If valid: { ok: true, value: 21, [RESULT_BRAND]: 'ok' }
 *
 * @example
 * // With invalid input
 * const result = min(18)(16);
 * // If invalid: { ok: false, error: [{ path: [], message: 'Must be at least 18' }], [RESULT_BRAND]: 'error' }
 *
 * @example
 * // With custom error message
 * const priceValidator = min(10, 'Price must be at least $10');
 *
 * @example
 * // Used in an object schema
 * const userSchema = object({
 *   age: required(chain(parseNumber(), min(18, 'Must be at least 18 years old')))
 * });
 */
export function min(value: number, message: string = `Must be at least ${value}`): Validator<number> {
  return (input, path = []) => {
    if (input < value) {
      return err([{ path, message }]);
    }
    return ok(input);
  };
}

/**
 * Creates a validator that ensures a number is less than or equal to a maximum value.
 *
 * @param {number} value - The maximum value (inclusive)
 * @param {string} [message] - Custom error message (defaults to 'Must be at most {value}')
 * @returns {Validator<number>} A validator that checks if a number is at most the maximum value
 *
 * @example
 * // Validate that a number is at most 100
 * const percentageValidator = max(100);
 * const result = percentageValidator(75);
 * // If valid: { ok: true, value: 75, [RESULT_BRAND]: 'ok' }
 *
 * @example
 * // With invalid input
 * const result = max(100)(150);
 * // If invalid: { ok: false, error: [{ path: [], message: 'Must be at most 100' }], [RESULT_BRAND]: 'error' }
 *
 * @example
 * // With custom error message
 * const quantityValidator = max(10, 'Maximum quantity is 10 items');
 *
 * @example
 * // Used in an object schema
 * const productSchema = object({
 *   quantity: required(chain(parseNumber(), max(100, 'Maximum quantity is 100')))
 * });
 */
export function max(value: number, message: string = `Must be at most ${value}`): Validator<number> {
  return (input, path = []) => {
    if (input > value) {
      return err([{ path, message }]);
    }
    return ok(input);
  };
}

/**
 * Creates a validator that ensures a number is between a minimum and maximum value (inclusive).
 *
 * @param {number} min - The minimum value (inclusive)
 * @param {number} max - The maximum value (inclusive)
 * @param {string} [message] - Custom error message (defaults to 'Must be between {min} and {max}')
 * @returns {Validator<number>} A validator that checks if a number is between min and max
 *
 * @example
 * // Validate that a number is between 1 and 10
 * const ratingValidator = between(1, 10);
 * const result = ratingValidator(7);
 * // If valid: { ok: true, value: 7, [RESULT_BRAND]: 'ok' }
 *
 * @example
 * // With invalid input
 * const result = between(1, 10)(15);
 * // If invalid: { ok: false, error: [{ path: [], message: 'Must be between 1 and 10' }], [RESULT_BRAND]: 'error' }
 *
 * @example
 * // With custom error message
 * const ageValidator = between(18, 65, 'Age must be between 18 and 65');
 *
 * @example
 * // Used in an object schema
 * const productSchema = object({
 *   rating: required(chain(parseNumber(), between(1, 5, 'Rating must be between 1 and 5')))
 * });
 */
export function between(
  min: number,
  max: number,
  message: string = `Must be between ${min} and ${max}`,
): Validator<number> {
  return (input, path = []) => {
    if (input < min || input > max) {
      return err([{ path, message }]);
    }
    return ok(input);
  };
}

/**
 * Creates a validator that ensures a number is an integer (no decimal places).
 *
 * @param {string} [message='Must be an integer'] - Custom error message
 * @returns {Validator<number>} A validator that checks if a number is an integer
 *
 * @example
 * // Validate that a number is an integer
 * const countValidator = integer();
 * const result = countValidator(42);
 * // If valid: { ok: true, value: 42, [RESULT_BRAND]: 'ok' }
 *
 * @example
 * // With invalid input
 * const result = integer()(3.14);
 * // If invalid: { ok: false, error: [{ path: [], message: 'Must be an integer' }], [RESULT_BRAND]: 'error' }
 *
 * @example
 * // With custom error message
 * const quantityValidator = integer('Quantity must be a whole number');
 *
 * @example
 * // Used in an object schema
 * const orderSchema = object({
 *   quantity: required(chain(parseNumber(), integer()))
 * });
 */
export function integer(message: string = 'Must be an integer'): Validator<number> {
  return (value, path = []) => {
    if (!Number.isInteger(value)) {
      return err([{ path, message }]);
    }
    return ok(value);
  };
}

/**
 * Creates a validator that ensures a number is positive (greater than zero).
 *
 * @param {string} [message='Must be a positive number'] - Custom error message
 * @returns {Validator<number>} A validator that checks if a number is positive
 *
 * @example
 * // Validate that a number is positive
 * const priceValidator = positive();
 * const result = priceValidator(29.99);
 * // If valid: { ok: true, value: 29.99, [RESULT_BRAND]: 'ok' }
 *
 * @example
 * // With invalid input
 * const result = positive()(0); // Note: 0 is not considered positive
 * // If invalid: { ok: false, error: [{ path: [], message: 'Must be a positive number' }], [RESULT_BRAND]: 'error' }
 *
 * @example
 * // With custom error message
 * const volumeValidator = positive('Volume must be greater than zero');
 *
 * @example
 * // Used in an object schema
 * const productSchema = object({
 *   price: required(chain(parseNumber(), positive()))
 * });
 */
export function positive(message: string = 'Must be a positive number'): Validator<number> {
  return (value, path = []) => {
    if (value <= 0) {
      return err([{ path, message }]);
    }
    return ok(value);
  };
}

/**
 * Creates a validator that ensures a number is negative (less than zero).
 *
 * @param {string} [message='Must be a negative number'] - Custom error message
 * @returns {Validator<number>} A validator that checks if a number is negative
 *
 * @example
 * // Validate that a number is negative
 * const temperatureValidator = negative();
 * const result = temperatureValidator(-5);
 * // If valid: { ok: true, value: -5, [RESULT_BRAND]: 'ok' }
 *
 * @example
 * // With invalid input
 * const result = negative()(0); // Note: 0 is not considered negative
 * // If invalid: { ok: false, error: [{ path: [], message: 'Must be a negative number' }], [RESULT_BRAND]: 'error' }
 *
 * @example
 * // With custom error message
 * const deficitValidator = negative('Must be a deficit (negative amount)');
 *
 * @example
 * // Used in an object schema
 * const temperatureSchema = object({
 *   freezingTemp: required(chain(parseNumber(), negative()))
 * });
 */
export function negative(message: string = 'Must be a negative number'): Validator<number> {
  return (value, path = []) => {
    if (value >= 0) {
      return err([{ path, message }]);
    }
    return ok(value);
  };
}

/**
 * Creates a validator that ensures a number is not zero.
 *
 * @param {string} [message='Must not be zero'] - Custom error message
 * @returns {Validator<number>} A validator that checks if a number is not zero
 *
 * @example
 * // Validate that a number is not zero
 * const divisorValidator = nonZero();
 * const result = divisorValidator(5);
 * // If valid: { ok: true, value: 5, [RESULT_BRAND]: 'ok' }
 *
 * @example
 * // With invalid input
 * const result = nonZero()(0);
 * // If invalid: { ok: false, error: [{ path: [], message: 'Must not be zero' }], [RESULT_BRAND]: 'error' }
 *
 * @example
 * // With custom error message
 * const speedValidator = nonZero('Speed cannot be zero');
 *
 * @example
 * // Used in an object schema
 * const calculationSchema = object({
 *   divisor: required(chain(parseNumber(), nonZero('Division by zero is not allowed')))
 * });
 */
export function nonZero(message: string = 'Must not be zero'): Validator<number> {
  return (value, path = []) => {
    if (value === 0) {
      return err([{ path, message }]);
    }
    return ok(value);
  };
}

/**
 * Creates a validator that ensures a number is divisible by a specific divisor.
 *
 * @param {number} divisor - The number that the input must be divisible by
 * @param {string} [message] - Custom error message (defaults to 'Must be divisible by {divisor}')
 * @returns {Validator<number>} A validator that checks if a number is divisible by the divisor
 *
 * @example
 * // Validate that a number is divisible by 5
 * const multipleOf5Validator = divisibleBy(5);
 * const result = multipleOf5Validator(15);
 * // If valid: { ok: true, value: 15, [RESULT_BRAND]: 'ok' }
 *
 * @example
 * // With invalid input
 * const result = divisibleBy(5)(12);
 * // If invalid: { ok: false, error: [{ path: [], message: 'Must be divisible by 5' }], [RESULT_BRAND]: 'error' }
 *
 * @example
 * // With custom error message
 * const evenValidator = divisibleBy(2, 'Number must be even');
 *
 * @example
 * // Used in an object schema
 * const productSchema = object({
 *   itemsPerBox: required(chain(parseNumber(), divisibleBy(6, 'Items must be packaged in multiples of 6')))
 * });
 */
export function divisibleBy(divisor: number, message: string = `Must be divisible by ${divisor}`): Validator<number> {
  return (value, path = []) => {
    if (value % divisor !== 0) {
      return err([{ path, message }]);
    }
    return ok(value);
  };
}

/**
 * Creates a validator that ensures a number has at most the specified number of decimal places.
 *
 * @param {number} maxDecimalPlaces - The maximum number of decimal places allowed
 * @param {string} [message] - Custom error message (defaults to 'Must have at most {maxDecimalPlaces} decimal places')
 * @returns {Validator<number>} A validator that checks the number's decimal precision
 *
 * @example
 * // Validate that a number has at most 2 decimal places
 * const currencyValidator = precision(2);
 * const result = currencyValidator(10.99);
 * // If valid: { ok: true, value: 10.99, [RESULT_BRAND]: 'ok' }
 *
 * @example
 * // With invalid input
 * const result = precision(2)(10.999);
 * // If invalid: { ok: false, error: [{ path: [], message: 'Must have at most 2 decimal places' }], [RESULT_BRAND]: 'error' }
 *
 * @example
 * // With custom error message
 * const percentValidator = precision(2, 'Percentage can have at most 2 decimal places');
 *
 * @example
 * // Used in an object schema
 * const productSchema = object({
 *   price: required(chain(parseNumber(), precision(2, 'Price must have at most 2 decimal places')))
 * });
 */
export function precision(
  maxDecimalPlaces: number,
  message: string = `Must have at most ${maxDecimalPlaces} decimal places`,
): Validator<number> {
  return (value, path = []) => {
    const str = value.toString();
    const decimalPlaces = (str.split('.')[1] || '').length;

    if (decimalPlaces > maxDecimalPlaces) {
      return err([{ path, message }]);
    }
    return ok(value);
  };
}

/**
 * Creates a validator that ensures a number is finite (not Infinity or -Infinity).
 *
 * @param {string} [message='Must be a finite number'] - Custom error message
 * @returns {Validator<number>} A validator that checks if a number is finite
 *
 * @example
 * // Validate that a number is finite
 * const finiteValidator = finite();
 * const result = finiteValidator(42);
 * // If valid: { ok: true, value: 42, [RESULT_BRAND]: 'ok' }
 *
 * @example
 * // With invalid input (Infinity)
 * const result = finite()(Infinity);
 * // If invalid: { ok: false, error: [{ path: [], message: 'Must be a finite number' }], [RESULT_BRAND]: 'error' }
 *
 * @example
 * // With invalid input (-Infinity)
 * const result = finite()(-Infinity);
 * // If invalid: { ok: false, error: [{ path: [], message: 'Must be a finite number' }], [RESULT_BRAND]: 'error' }
 *
 * @example
 * // Used in a chain
 * const validRatioValidator = chain(
 *   number(),
 *   finite(),
 *   between(0, 1)
 * );
 *
 * @example
 * // Used in an object schema
 * const calculationSchema = object({
 *   result: required(chain(number(), finite()))
 * });
 */
export function finite(message: string = 'Must be a finite number'): Validator<number> {
  return (value, path = []) => {
    if (!Number.isFinite(value)) {
      return err([{ path, message }]);
    }
    return ok(value);
  };
}
