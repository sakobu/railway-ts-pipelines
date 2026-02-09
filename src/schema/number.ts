import { err, ok } from '../result';

import type { Validator } from './core';

/**
 * Create a validator that ensures a value is a number and not NaN.
 *
 * @example
 * const validate = number();
 * validate(25);           // ok(25)
 * validate('not a number'); // err([{ path: [], message: 'Must be a number' }])
 *
 * @param message - Custom error message
 * @returns A validator that checks if a value is a number
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
 * Create a validator that ensures a number is at least a minimum value.
 *
 * @example
 * const validate = min(18);
 * validate(21); // ok(21)
 * validate(16); // err([{ path: [], message: 'Must be at least 18' }])
 *
 * @param value - The minimum value (inclusive)
 * @param message - Custom error message
 * @returns A validator that checks if a number is at least the minimum
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
 * Create a validator that ensures a number is at most a maximum value.
 *
 * @example
 * const validate = max(100);
 * validate(75);  // ok(75)
 * validate(150); // err([{ path: [], message: 'Must be at most 100' }])
 *
 * @param value - The maximum value (inclusive)
 * @param message - Custom error message
 * @returns A validator that checks if a number is at most the maximum
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
 * Create a validator that ensures a number is between a minimum and maximum (inclusive).
 *
 * @example
 * const validate = between(1, 10);
 * validate(7);  // ok(7)
 * validate(15); // err([{ path: [], message: 'Must be between 1 and 10' }])
 *
 * @param min - The minimum value (inclusive)
 * @param max - The maximum value (inclusive)
 * @param message - Custom error message
 * @returns A validator that checks if a number is between min and max
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
 * Create a validator that ensures a number is an integer.
 *
 * @example
 * const validate = integer();
 * validate(42);   // ok(42)
 * validate(3.14); // err([{ path: [], message: 'Must be an integer' }])
 *
 * @param message - Custom error message
 * @returns A validator that checks if a number is an integer
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
 * Create a validator that ensures a number is positive (greater than zero).
 *
 * @example
 * const validate = positive();
 * validate(29.99); // ok(29.99)
 * validate(0);     // err([{ path: [], message: 'Must be a positive number' }])
 *
 * @param message - Custom error message
 * @returns A validator that checks if a number is positive
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
 * Create a validator that ensures a number is negative (less than zero).
 *
 * @example
 * const validate = negative();
 * validate(-5); // ok(-5)
 * validate(0);  // err([{ path: [], message: 'Must be a negative number' }])
 *
 * @param message - Custom error message
 * @returns A validator that checks if a number is negative
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
 * Create a validator that ensures a number is not zero.
 *
 * @example
 * const validate = nonZero();
 * validate(5); // ok(5)
 * validate(0); // err([{ path: [], message: 'Must not be zero' }])
 *
 * @param message - Custom error message
 * @returns A validator that checks if a number is not zero
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
 * Create a validator that ensures a number is divisible by a specific divisor.
 *
 * @example
 * const validate = divisibleBy(5);
 * validate(15); // ok(15)
 * validate(12); // err([{ path: [], message: 'Must be divisible by 5' }])
 *
 * @param divisor - The number that the input must be divisible by
 * @param message - Custom error message
 * @returns A validator that checks if a number is divisible by the divisor
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
 * Create a validator that ensures a number has at most the specified decimal places.
 *
 * @example
 * const validate = precision(2);
 * validate(10.99);  // ok(10.99)
 * validate(10.999); // err([{ path: [], message: 'Must have at most 2 decimal places' }])
 *
 * @param maxDecimalPlaces - The maximum number of decimal places allowed
 * @param message - Custom error message
 * @returns A validator that checks the number's decimal precision
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
 * Create a validator that ensures a number is finite (not Infinity or -Infinity).
 *
 * @example
 * const validate = finite();
 * validate(42);       // ok(42)
 * validate(Infinity); // err([{ path: [], message: 'Must be a finite number' }])
 *
 * @param message - Custom error message
 * @returns A validator that checks if a number is finite
 */
export function finite(message: string = 'Must be a finite number'): Validator<number> {
  return (value, path = []) => {
    if (!Number.isFinite(value)) {
      return err([{ path, message }]);
    }
    return ok(value);
  };
}
