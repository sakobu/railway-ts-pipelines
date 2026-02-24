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
 * validate('');     // err([{ path: [], message: 'Field must not be empty' }])
 * validate('   '); // err([{ path: [], message: 'Field must not be empty' }])
 *
 * @param message - Custom error message
 * @returns A validator that checks if a string is not empty
 */
export function nonEmpty(message: string = 'Field must not be empty'): Validator<string> {
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
  const phoneRegex = /^\+?[\d\-()]{8,20}$/;
  return (value, path = []) => {
    // Remove all spaces for validation
    const cleanedValue = value.replaceAll(/\s+/g, '');
    if (!phoneRegex.test(cleanedValue) || cleanedValue.replaceAll(/\D/g, '').length < 7) {
      return err([{ path, message }]);
    }
    return ok(value); // Return original value, not cleaned
  };
}

/**
 * Create a validator that ensures a string is a valid UUID (RFC 4122).
 * Accepts any UUID version including NIL UUIDs (all zeros).
 *
 * @example
 * const validate = uuid();
 * validate('550e8400-e29b-41d4-a716-446655440000'); // ok(...)
 * validate('not-a-uuid');                            // err([{ path: [], message: 'Invalid UUID format' }])
 *
 * @param message - Custom error message
 * @returns A validator that checks if a string is a valid UUID
 */
export function uuid(message: string = 'Invalid UUID format'): Validator<string> {
  const uuidRegex = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
  return pattern(uuidRegex, message);
}

/**
 * Create a validator that ensures a string is a valid ISO 8601 date (YYYY-MM-DD).
 * Validates both format and calendar correctness (e.g., rejects Feb 30).
 *
 * @example
 * const validate = isoDate();
 * validate('2024-01-15'); // ok("2024-01-15")
 * validate('2024-02-30'); // err([{ path: [], message: 'Invalid ISO date format' }])
 *
 * @param message - Custom error message
 * @returns A validator that checks if a string is a valid ISO date
 */
export function isoDate(message: string = 'Invalid ISO date format'): Validator<string> {
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
  return (value, path = []) => {
    if (!isoDateRegex.test(value)) {
      return err([{ path, message }]);
    }
    const date = new Date(value + 'T00:00:00Z');
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      return err([{ path, message }]);
    }
    return ok(value);
  };
}

/**
 * Create a validator that ensures a string is a valid ISO 8601 / RFC 3339 time.
 * Format: `HH:mm:ss[.fractional][Z|±HH:mm]`. Timezone is optional.
 *
 * @example
 * const validate = isoTime();
 * validate('14:30:00');       // ok("14:30:00")
 * validate('14:30:00Z');      // ok("14:30:00Z")
 * validate('14:30:00+05:30'); // ok("14:30:00+05:30")
 * validate('25:00:00');       // err([{ path: [], message: 'Invalid ISO time format' }])
 *
 * @param message - Custom error message
 * @returns A validator that checks if a string is a valid ISO time
 */
export function isoTime(message: string = 'Invalid ISO time format'): Validator<string> {
  // eslint-disable-next-line security/detect-unsafe-regex
  const isoTimeRegex = /^(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))?$/;
  return (value, path = []) => {
    const match = isoTimeRegex.exec(value);
    if (!match) {
      return err([{ path, message }]);
    }
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);
    if (hours > 23 || minutes > 59 || seconds > 59) {
      return err([{ path, message }]);
    }
    if (match[4]) {
      const tzHours = Number(match[5]);
      const tzMinutes = Number(match[6]);
      if (tzHours > 23 || tzMinutes > 59) {
        return err([{ path, message }]);
      }
    }
    return ok(value);
  };
}

/**
 * Create a validator that ensures a string is a valid ISO 8601 / RFC 3339 datetime.
 * Format: `YYYY-MM-DDTHH:mm:ss[.fractional][Z|±HH:mm]`.
 *
 * @example
 * const validate = isoDateTime();
 * validate('2024-01-15T14:30:00Z');       // ok(...)
 * validate('2024-01-15T14:30:00+05:30');  // ok(...)
 * validate('2024-02-30T14:30:00Z');       // err([{ path: [], message: 'Invalid ISO datetime format' }])
 *
 * @param message - Custom error message
 * @returns A validator that checks if a string is a valid ISO datetime
 */
export function isoDateTime(message: string = 'Invalid ISO datetime format'): Validator<string> {
  // eslint-disable-next-line security/detect-unsafe-regex
  const isoDateTimeRegex = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))?$/;
  return (value, path = []) => {
    const match = isoDateTimeRegex.exec(value);
    if (!match) {
      return err([{ path, message }]);
    }
    // Validate date via round-trip
    const datePart = match[1]!;
    const date = new Date(datePart + 'T00:00:00Z');
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== datePart) {
      return err([{ path, message }]);
    }
    // Validate time bounds
    const hours = Number(match[2]);
    const minutes = Number(match[3]);
    const seconds = Number(match[4]);
    if (hours > 23 || minutes > 59 || seconds > 59) {
      return err([{ path, message }]);
    }
    // Validate timezone offset bounds
    if (match[5]) {
      const tzHours = Number(match[6]);
      const tzMinutes = Number(match[7]);
      if (tzHours > 23 || tzMinutes > 59) {
        return err([{ path, message }]);
      }
    }
    return ok(value);
  };
}

/**
 * Create a validator that ensures a string is a valid ISO 8601 duration.
 * Format: `PnYnMnDTnHnMnS` or `PnW`.
 *
 * @example
 * const validate = isoDuration();
 * validate('P1Y2M3D');       // ok("P1Y2M3D")
 * validate('PT1H30M');       // ok("PT1H30M")
 * validate('P4W');           // ok("P4W")
 * validate('P');             // err([{ path: [], message: 'Invalid ISO duration format' }])
 *
 * @param message - Custom error message
 * @returns A validator that checks if a string is a valid ISO duration
 */
export function isoDuration(message: string = 'Invalid ISO duration format'): Validator<string> {
  // eslint-disable-next-line security/detect-unsafe-regex
  const isoDurationRegex = /^P(?:\d+W|(?:\d+Y)?(?:\d+M)?(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d+)?S)?)?)$/;
  return (value, path = []) => {
    if (!isoDurationRegex.test(value) || value === 'P' || value.endsWith('T')) {
      return err([{ path, message }]);
    }
    return ok(value);
  };
}
