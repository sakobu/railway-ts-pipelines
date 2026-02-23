import { err, ok } from '../result';

import type { Validator } from './core';

/**
 * Create a validator that ensures a value is a string.
 *
 * @example
 * const validate = string();
 * validate('John'); // ok("John")
 * validate(42);     // err([{ path: [], message: 'Must be a string' }])
 *
 * @param message - Custom error message
 * @returns A validator that checks if a value is a string
 */
export function string(message: string = 'Must be a string'): Validator<unknown, string> {
  return (value, path = []) => {
    if (typeof value !== 'string') {
      return err([{ path, message }]);
    }
    return ok(value);
  };
}

/**
 * Create a validator that ensures a string's length is at least a minimum value.
 *
 * @example
 * const validate = minLength(3);
 * validate('john_doe'); // ok("john_doe")
 * validate('jo');       // err([{ path: [], message: 'Must be at least 3 characters' }])
 *
 * @param min - The minimum length (inclusive)
 * @param message - Custom error message
 * @returns A validator that checks if a string meets the minimum length
 */
export function minLength(min: number, message: string = `Must be at least ${min} characters`): Validator<string> {
  return (value, path = []) => {
    if (value.length < min) {
      return err([{ path, message }]);
    }
    return ok(value);
  };
}

/**
 * Create a validator that ensures a string's length is at most a maximum value.
 *
 * @example
 * const validate = maxLength(10);
 * validate('short');                // ok("short")
 * validate('this is too long!!!'); // err([{ path: [], message: 'Must be at most 10 characters' }])
 *
 * @param max - The maximum length (inclusive)
 * @param message - Custom error message
 * @returns A validator that checks if a string meets the maximum length
 */
export function maxLength(max: number, message: string = `Must be at most ${max} characters`): Validator<string> {
  return (value, path = []) => {
    if (value.length > max) {
      return err([{ path, message }]);
    }
    return ok(value);
  };
}

/**
 * Create a validator that ensures a string matches a regular expression pattern.
 *
 * @example
 * const validate = pattern(/^[a-zA-Z0-9]+$/);
 * validate('abc123'); // ok("abc123")
 * validate('abc!');   // err([{ path: [], message: 'Invalid format' }])
 *
 * @param regex - The regular expression to test against
 * @param message - Custom error message
 * @returns A validator that checks if a string matches the pattern
 */
export function pattern(regex: RegExp, message: string = 'Invalid format'): Validator<string> {
  return (value, path = []) => {
    if (!regex.test(value)) {
      return err([{ path, message }]);
    }
    return ok(value);
  };
}

/**
 * Create a validator that ensures a string is not empty after trimming whitespace.
 *
 * @example
 * const validate = nonEmpty();
 * validate('John'); // ok("John")
 * validate('');     // err([{ path: [], message: 'String must not be empty' }])
 * validate('   '); // err([{ path: [], message: 'String must not be empty' }])
 *
 * @param message - Custom error message
 * @returns A validator that checks if a string is not empty
 */
export function nonEmpty(message: string = 'String must not be empty'): Validator<string> {
  return (value, path = []) => {
    if (value.trim().length === 0) {
      return err([{ path, message }]);
    }
    return ok(value);
  };
}

/**
 * Create a validator that ensures a string is a valid email address.
 *
 * @example
 * const validate = email();
 * validate('user@example.com'); // ok("user@example.com")
 * validate('not-an-email');     // err([{ path: [], message: 'Invalid email format' }])
 *
 * @param message - Custom error message
 * @returns A validator that checks if a string is a valid email
 */
export function email(message: string = 'Invalid email format'): Validator<string> {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return pattern(emailRegex, message);
}

/**
 * Create a validator that ensures a string is a valid URL.
 *
 * @example
 * const validate = url();
 * validate('https://example.com');  // ok("https://example.com")
 * validate('not-a-url');            // err([{ path: [], message: 'Invalid URL format' }])
 *
 * @param message - Custom error message
 * @returns A validator that checks if a string is a valid URL
 */
export function url(message: string = 'Invalid URL format'): Validator<string> {
  return (value, path = []) => {
    try {
      new URL(value);
      return ok(value);
    } catch {
      return err([{ path, message }]);
    }
  };
}

/**
 * Create a validator that ensures a string is a valid phone number.
 * Accepts common formats including international (+), spaces, dashes, and parentheses.
 *
 * @example
 * const validate = phoneNumber();
 * validate('+1-555-123-4567'); // ok("+1-555-123-4567")
 * validate('not-a-phone');     // err([{ path: [], message: 'Invalid phone number format' }])
 *
 * @param message - Custom error message
 * @returns A validator that checks if a string is a valid phone number
 */
export function phoneNumber(message: string = 'Invalid phone number format'): Validator<string> {
  // Flexible regex that accepts common phone formats
  // Allows optional + prefix, digits, spaces, dashes, and parentheses
  // Total length should be reasonable for a phone number (8-20 chars after removing spaces)
  const phoneRegex = /^\+?[\d\s\-()]{8,20}$/;
  return (value, path = []) => {
    // Remove all spaces for validation
    const cleanedValue = value.replaceAll(/\s+/g, '');
    if (!phoneRegex.test(cleanedValue)) {
      return err([{ path, message }]);
    }
    return ok(value); // Return original value, not cleaned
  };
}
