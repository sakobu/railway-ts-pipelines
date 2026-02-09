import { err, fromTry, mapErr, ok } from '../result';

import type { Validator } from './core';

/**
 * Create a validator that parses input into a number.
 * Accepts both numbers and string representations of numbers.
 *
 * @example
 * const validate = parseNumber();
 * validate('25');           // ok(25)
 * validate(42);             // ok(42)
 * validate('not a number'); // err([{ path: [], message: 'Must be a valid number' }])
 *
 * @param message - Custom error message
 * @returns A validator that parses and validates numbers
 */
export function parseNumber(message: string = 'Must be a valid number'): Validator<unknown, number> {
  return (value, path = []) => {
    if (typeof value === 'number') {
      return ok(value);
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '') {
        return err([{ path, message }]);
      }

      const num = Number(trimmed);
      if (!Number.isNaN(num)) {
        return ok(num);
      }
    }

    return err([{ path, message }]);
  };
}

/**
 * Create a validator that parses input into a BigInt.
 * Accepts BigInt values, strings, and integer numbers.
 *
 * @example
 * const validate = parseBigInt();
 * validate("9007199254740993"); // ok(9007199254740993n)
 * validate(123n);               // ok(123n)
 * validate(42);                 // ok(42n)
 *
 * @param message - Custom error message
 * @returns A validator that parses and validates BigInt values
 */
export function parseBigInt(message: string = 'Must be a valid BigInt'): Validator<unknown, bigint> {
  return (value, path = []) => {
    // Already a BigInt
    if (typeof value === 'bigint') {
      return ok(value);
    }

    // Try to convert string or number to BigInt
    if (typeof value === 'string' || typeof value === 'number') {
      try {
        // For numbers, check they're integers first
        if (typeof value === 'number' && !Number.isInteger(value)) {
          return err([
            {
              path,
              message: 'Cannot convert non-integer number to BigInt',
            },
          ]);
        }

        const bigIntValue = BigInt(value);
        return ok(bigIntValue);
      } catch {
        return err([{ path, message }]);
      }
    }

    return err([{ path, message }]);
  };
}

/**
 * Create a validator that parses input into enum values.
 * Handles string/number to enum conversions with flexible matching.
 *
 * @example
 * enum Status { Pending = "PENDING", Approved = "APPROVED" }
 * const validate = parseEnum(Status);
 * validate("PENDING");  // ok("PENDING")
 * validate("pending");  // ok("PENDING") — case-insensitive key match
 *
 * @param enumObject - The enum object to parse values into
 * @param message - Custom error message
 * @returns A validator that parses to enum values
 */
export function parseEnum<T extends Record<string, string | number>>(
  enumObject: T,
  message: string = `Must be a valid enum value`,
): Validator<unknown, T[keyof T]> {
  return (value, path = []) => {
    // Get only the actual enum values (filter out reverse mappings for numeric enums)
    const enumEntries = Object.entries(enumObject).filter(
      ([key]) => Number.isNaN(Number(key)) || !Number.isInteger(Number(key)),
    );
    // eslint-disable-next-line unicorn/prefer-set-has
    const enumValues = enumEntries.map(([, val]) => val);

    // Already a valid enum value
    if (enumValues.includes(value as T[keyof T])) {
      return ok(value as T[keyof T]);
    }

    // For strings
    if (typeof value === 'string') {
      // Try parsing as a number first for numeric enums
      const parsed = Number(value);
      if (!Number.isNaN(parsed) && enumValues.includes(parsed as T[keyof T])) {
        return ok(parsed as T[keyof T]);
      }

      // Try exact key match
      const exactEntry = enumEntries.find(([key]) => key === value);
      if (exactEntry) {
        return ok(exactEntry[1] as T[keyof T]);
      }

      // Try case-insensitive key match
      const lowerValue = value.toLowerCase();
      const caseInsensitiveEntry = enumEntries.find(([key]) => key.toLowerCase() === lowerValue);
      if (caseInsensitiveEntry) {
        return ok(caseInsensitiveEntry[1] as T[keyof T]);
      }
    }

    return err([
      {
        path,
        message,
      },
    ]);
  };
}

/**
 * Create a validator that parses input into a Date object.
 * Accepts Date objects, date strings, and numeric timestamps.
 *
 * @example
 * const validate = parseDate();
 * validate('1990-05-15');    // ok(Date)
 * validate(1621036800000);   // ok(Date)
 * validate('not a date');    // err([{ path: [], message: 'Must be a valid date' }])
 *
 * @param message - Custom error message
 * @returns A validator that parses and validates dates
 */
export function parseDate(message: string = 'Must be a valid date'): Validator<unknown, Date> {
  return (value, path = []) => {
    if (value instanceof Date) {
      return ok(value);
    }

    let dateValue: Date;

    if (typeof value === 'string') {
      dateValue = new Date(value);
    } else if (typeof value === 'number') {
      dateValue = new Date(value);
    } else {
      return err([{ path, message }]);
    }

    if (Number.isNaN(dateValue.getTime())) {
      return err([{ path, message }]);
    }

    return ok(dateValue);
  };
}

/**
 * Create a validator that parses input into a boolean.
 * Accepts booleans, 0/1, and strings like 'true'/'false', 'yes'/'no'.
 *
 * @example
 * const validate = parseBool();
 * validate('yes');   // ok(true)
 * validate('false'); // ok(false)
 * validate(1);       // ok(true)
 * validate('maybe'); // err([{ path: [], message: 'Must be a valid boolean value' }])
 *
 * @param message - Custom error message
 * @returns A validator that parses and validates booleans
 */
export function parseBool(message: string = 'Must be a valid boolean value'): Validator<unknown, boolean> {
  return (value, path = []) => {
    if (typeof value === 'boolean') {
      return ok(value);
    }

    if (typeof value === 'string') {
      const normalized = value.toLowerCase().trim();
      if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
        return ok(true);
      }
      if (normalized === 'false' || normalized === '0' || normalized === 'no') {
        return ok(false);
      }
    }

    if (typeof value === 'number') {
      if (value === 1) return ok(true);
      if (value === 0) return ok(false);
    }

    return err([{ path, message }]);
  };
}

/**
 * Create a validator that parses input into a string.
 * Accepts strings and any value convertible to string, except null and undefined.
 *
 * @example
 * const validate = parseString();
 * validate(12345);   // ok("12345")
 * validate('hello'); // ok("hello")
 * validate(null);    // err([{ path: [], message: 'Must be convertible to string' }])
 *
 * @param message - Custom error message
 * @returns A validator that parses and validates strings
 */
export function parseString(message: string = 'Must be convertible to string'): Validator<unknown, string> {
  return (value, path = []) => {
    if (typeof value === 'string') {
      return ok(value);
    }

    if (value === null || value === undefined) {
      return err([{ path, message }]);
    }

    return ok(String(value));
  };
}

/**
 * Create a validator that parses JSON strings into objects.
 * Accepts JSON strings or already-parsed objects.
 *
 * @example
 * const validate = parseJSON();
 * validate('{"name":"John"}'); // ok({ name: "John" })
 * validate({ name: 'John' }); // ok({ name: "John" })
 * validate('{invalid}');       // err([{ path: [], message: 'Must be valid JSON' }])
 *
 * @param message - Custom error message
 * @returns A validator that parses and validates JSON
 */
export function parseJSON(message: string = 'Must be valid JSON'): Validator<unknown, unknown> {
  return (value, path = []) => {
    if (typeof value === 'string') {
      return mapErr(
        fromTry(() => JSON.parse(value)),
        () => [{ path, message }],
      );
    }

    if (typeof value === 'object' && value !== null) {
      return ok(value);
    }

    return err([{ path, message }]);
  };
}

/**
 * Create a validator that parses ISO date strings (YYYY-MM-DD) into Date objects.
 * Performs strict validation of the date format and validity.
 *
 * @example
 * const validate = parseISODate();
 * validate('2021-05-15'); // ok(Date)
 * validate('15/05/2021'); // err([{ path: [], message: 'Must be a valid ISO date string' }])
 * validate('2021-02-30'); // err(...) — invalid calendar date
 *
 * @param message - Custom error message
 * @returns A validator that parses and validates ISO date strings
 */
export function parseISODate(message: string = 'Must be a valid ISO date string'): Validator<unknown, Date> {
  return (value, path = []) => {
    if (typeof value !== 'string') {
      return err([{ path, message }]);
    }

    if (!/^\d{4}-\d{2}-\d{2}/.test(value)) {
      return err([{ path, message }]);
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return err([{ path, message }]);
    }

    const originalMonth = value.slice(5, 7);
    const originalDay = value.slice(8, 10);
    const parsedMonth = String(date.getUTCMonth() + 1).padStart(2, '0');
    const parsedDay = String(date.getUTCDate()).padStart(2, '0');

    if (originalMonth !== parsedMonth || originalDay !== parsedDay) {
      return err([{ path, message }]);
    }

    return ok(date);
  };
}

/**
 * Create a validator that parses string URLs into URL objects.
 *
 * @example
 * const validate = parseURL();
 * validate('https://example.com'); // ok(URL)
 * validate('not-a-url');           // err([{ path: [], message: 'Must be a valid URL' }])
 *
 * @param message - Custom error message
 * @returns A validator that parses and validates URLs
 */
export function parseURL(message: string = 'Must be a valid URL'): Validator<unknown, URL> {
  return (value, path = []) => {
    if (typeof value !== 'string') {
      return err([{ path, message }]);
    }

    try {
      return ok(new URL(value));
    } catch {
      return err([{ path, message }]);
    }
  };
}
