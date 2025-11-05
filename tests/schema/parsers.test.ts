import { describe, expect, test } from 'bun:test';

import { isErr, isOk, ok, err } from '@/result';
import {
  parseNumber,
  parseBigInt,
  parseEnum,
  parseString,
  parseDate,
  parseBool,
  parseJSON,
  parseISODate,
  parseURL,
} from '@/schema/parsers';

import type { ValidationError, Validator } from '@/schema/core';

describe('parsers', () => {
  // Custom string parser for testing
  const stringParser: Validator<unknown, string> = (value, path = []) => {
    if (typeof value !== 'string') {
      const error: ValidationError = { path, message: 'Expected a string' };
      return err([error]);
    }
    return ok(value);
  };

  // Test our custom parser to establish the pattern
  describe('stringParser', () => {
    test('should validate strings', () => {
      // Valid cases
      const validInputs = ['hello', '', '123', 'true'];
      for (const input of validInputs) {
        const result = stringParser(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(input);
        }
      }

      // Invalid cases
      const invalidInputs = [123, true, false, null, undefined, {}, []];
      for (const input of invalidInputs) {
        const result = stringParser(input);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error[0]?.message || '').toBe('Expected a string');
        }
      }
    });

    test('should include path in error', () => {
      const path = ['user', 'name'];
      const result = stringParser(123, path);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.path || []).toEqual(path);
      }
    });
  });

  describe('parseNumber()', () => {
    test('should parse valid numbers', () => {
      const validator = parseNumber();

      // Valid cases - already numbers
      const numericInputs = [0, 42, -1, 3.14, Number.MAX_SAFE_INTEGER];
      for (const input of numericInputs) {
        const result = validator(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(input);
        }
      }

      // Valid cases - strings that can be parsed as numbers
      const validStringInputs = [
        { input: '42', expected: 42 },
        { input: '-10', expected: -10 },
        { input: '3.14', expected: 3.14 },
        { input: '0', expected: 0 },
        { input: ' 123 ', expected: 123 }, // with spaces
      ];

      for (const { input, expected } of validStringInputs) {
        const result = validator(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(expected);
        }
      }

      // Invalid cases
      const invalidInputs = ['not a number', '12x', '', ' ', true, false, null, undefined, {}, []];

      for (const input of invalidInputs) {
        const result = validator(input);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error[0]?.message || '').toBe('Must be a valid number');
        }
      }
    });

    test('should allow custom error message', () => {
      const customMessage = 'Please provide a numeric value';
      const validator = parseNumber(customMessage);

      const result = validator('not a number');
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe(customMessage);
      }
    });

    test('should include path in error', () => {
      const validator = parseNumber();
      const path = ['product', 'price'];

      const result = validator('not a number', path);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.path || []).toEqual(path);
      }
    });
  });

  describe('parseBigInt()', () => {
    test('should parse string to BigInt', () => {
      const validator = parseBigInt();
      const result = validator('9007199254740993');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(9_007_199_254_740_993n);
      }
    });

    test('should pass through existing BigInt', () => {
      const validator = parseBigInt();
      const bigIntValue = 123n;
      const result = validator(bigIntValue);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(bigIntValue);
      }
    });

    test('should convert integer numbers to BigInt', () => {
      const validator = parseBigInt();
      const result = validator(42);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(42n);
      }
    });

    test('should reject non-integer numbers', () => {
      const validator = parseBigInt();
      const result = validator(3.14);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toContain('non-integer');
      }
    });

    test('should reject invalid string formats', () => {
      const validator = parseBigInt();
      expect(isErr(validator('not a number'))).toBe(true);
      expect(isErr(validator('3.14'))).toBe(true);
    });

    test('should convert empty string to 0n', () => {
      const validator = parseBigInt();
      const result = validator('');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(0n);
      }
    });

    test('should handle hex and octal strings', () => {
      const validator = parseBigInt();
      const hexResult = validator('0xFF');
      expect(isOk(hexResult)).toBe(true);
      if (isOk(hexResult)) {
        expect(hexResult.value).toBe(255n);
      }

      const octalResult = validator('0o77');
      expect(isOk(octalResult)).toBe(true);
      if (isOk(octalResult)) {
        expect(octalResult.value).toBe(63n);
      }
    });

    test('should handle binary strings', () => {
      const validator = parseBigInt();
      const binaryResult = validator('0b1111');
      expect(isOk(binaryResult)).toBe(true);
      if (isOk(binaryResult)) {
        expect(binaryResult.value).toBe(15n);
      }
    });

    test('should reject null and undefined', () => {
      const validator = parseBigInt();
      expect(isErr(validator(null))).toBe(true);
      expect(isErr(validator(undefined))).toBe(true);
    });

    test('should reject other non-convertible types', () => {
      const validator = parseBigInt();
      expect(isErr(validator({}))).toBe(true);
      expect(isErr(validator([]))).toBe(true);
      expect(isErr(validator(true))).toBe(true);
      expect(isErr(validator(false))).toBe(true);
    });

    test('should allow custom error message', () => {
      const customMessage = 'Please provide a valid BigInt value';
      const validator = parseBigInt(customMessage);

      const result = validator('invalid');
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe(customMessage);
      }
    });

    test('should include path in error', () => {
      const validator = parseBigInt();
      const path = ['data', 'largeNumber'];

      const result = validator('not a number', path);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.path || []).toEqual(path);
      }
    });
  });

  describe('parseEnum()', () => {
    enum StringEnum {
      Pending = 'PENDING',
      Approved = 'APPROVED',
      Rejected = 'REJECTED',
    }

    enum NumericEnum {
      Low = 0,
      Medium = 1,
      High = 2,
    }

    describe('with string enums', () => {
      test('should parse exact enum values', () => {
        const parser = parseEnum(StringEnum);
        const result = parser('PENDING');
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(StringEnum.Pending);
        }
      });

      test('should parse by key name', () => {
        const parser = parseEnum(StringEnum);
        const result = parser('Pending');
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(StringEnum.Pending);
        }
      });

      test('should parse case-insensitively', () => {
        const parser = parseEnum(StringEnum);
        const result = parser('pending');
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(StringEnum.Pending);
        }
      });

      test('should reject invalid values', () => {
        const parser = parseEnum(StringEnum);
        expect(isErr(parser('INVALID'))).toBe(true);
        expect(isErr(parser(123))).toBe(true);
      });

      test('should pass through existing enum values', () => {
        const parser = parseEnum(StringEnum);
        const result = parser(StringEnum.Approved);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(StringEnum.Approved);
        }
      });
    });

    describe('with numeric enums', () => {
      test('should parse numeric values', () => {
        const parser = parseEnum(NumericEnum);
        const result = parser(1);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(NumericEnum.Medium);
        }
      });

      test('should parse numeric strings', () => {
        const parser = parseEnum(NumericEnum);
        const result = parser('2');
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(NumericEnum.High);
        }
      });

      test('should parse by key name', () => {
        const parser = parseEnum(NumericEnum);
        const result = parser('Low');
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(NumericEnum.Low);
        }
      });

      test('should parse case-insensitive key names', () => {
        const parser = parseEnum(NumericEnum);
        const result = parser('medium');
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(NumericEnum.Medium);
        }
      });

      test('should reject out-of-range numbers', () => {
        const parser = parseEnum(NumericEnum);
        expect(isErr(parser(3))).toBe(true);
        expect(isErr(parser(-1))).toBe(true);
      });
    });

    test('should reject null and undefined', () => {
      const parser = parseEnum(StringEnum);
      expect(isErr(parser(null))).toBe(true);
      expect(isErr(parser(undefined))).toBe(true);
    });

    test('should reject other non-convertible types', () => {
      const parser = parseEnum(StringEnum);
      expect(isErr(parser({}))).toBe(true);
      expect(isErr(parser([]))).toBe(true);
      expect(isErr(parser(true))).toBe(true);
      expect(isErr(parser(false))).toBe(true);
    });

    test('should allow custom error message', () => {
      const customMessage = 'Please select a valid status';
      const parser = parseEnum(StringEnum, customMessage);

      const result = parser('INVALID');
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe(customMessage);
      }
    });

    test('should include path in error', () => {
      const parser = parseEnum(StringEnum);
      const path = ['user', 'status'];

      const result = parser('INVALID', path);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.path || []).toEqual(path);
      }
    });
  });

  describe('parseString()', () => {
    test('should parse values to strings', () => {
      const validator = parseString();

      // Valid cases - already strings
      const stringInputs = ['hello', '', 'true', '123'];
      for (const input of stringInputs) {
        const result = validator(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(input);
        }
      }

      // Valid cases - values that can be converted to strings
      const convertibleInputs = [
        { input: 42, expected: '42' },
        { input: true, expected: 'true' },
        { input: false, expected: 'false' },
        { input: 0, expected: '0' },
        { input: [], expected: '' },
        { input: {}, expected: '[object Object]' },
      ];

      for (const { input, expected } of convertibleInputs) {
        const result = validator(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(expected);
        }
      }

      // Invalid cases
      const invalidInputs = [null, undefined];
      for (const input of invalidInputs) {
        const result = validator(input);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error[0]?.message || '').toBe('Must be convertible to string');
        }
      }
    });

    test('should allow custom error message', () => {
      const customMessage = 'Cannot convert to string';
      const validator = parseString(customMessage);

      const result = validator(null);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe(customMessage);
      }
    });

    test('should include path in error', () => {
      const validator = parseString();
      const path = ['user', 'name'];

      const result = validator(null, path);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.path || []).toEqual(path);
      }
    });
  });

  describe('parseDate()', () => {
    test('should parse valid dates', () => {
      const validator = parseDate();
      const referenceDate = new Date('2023-05-15T12:00:00Z');

      // Valid cases - already Date objects
      const result1 = validator(referenceDate);
      expect(isOk(result1)).toBe(true);
      if (isOk(result1)) {
        expect(result1.value).toEqual(referenceDate);
      }

      // Valid cases - strings that can be parsed as dates
      const validStringInputs = ['2023-05-15', '2023-05-15T12:00:00Z', 'May 15, 2023'];

      for (const input of validStringInputs) {
        const result = validator(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value instanceof Date).toBe(true);
          expect(Number.isNaN(result.value.getTime())).toBe(false);
        }
      }

      // Valid cases - numbers (timestamps)
      const timestamp = referenceDate.getTime();
      const result2 = validator(timestamp);
      expect(isOk(result2)).toBe(true);
      if (isOk(result2)) {
        expect(result2.value.getTime()).toBe(timestamp);
      }

      // Invalid cases
      const invalidInputs = [
        'not a date',
        '2023-99-99', // invalid date format
        true,
        false,
        null,
        undefined,
        {},
        [],
      ];

      for (const input of invalidInputs) {
        const result = validator(input);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error[0]?.message || '').toBe('Must be a valid date');
        }
      }
    });

    test('should allow custom error message', () => {
      const customMessage = 'Please provide a valid date';
      const validator = parseDate(customMessage);

      const result = validator('not a date');
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe(customMessage);
      }
    });

    test('should include path in error', () => {
      const validator = parseDate();
      const path = ['user', 'birthdate'];

      const result = validator('not a date', path);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.path || []).toEqual(path);
      }
    });
  });

  describe('parseBool()', () => {
    test('should parse values to booleans', () => {
      const validator = parseBool();

      // Valid cases - already booleans
      const booleanInputs = [true, false];
      for (const input of booleanInputs) {
        const result = validator(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(input);
        }
      }

      // Valid cases - strings that can be parsed as true
      const trueStringInputs = ['true', 'TRUE', 'True', 'yes', 'YES', 'Yes', '1', ' true '];
      for (const input of trueStringInputs) {
        const result = validator(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(true);
        }
      }

      // Valid cases - strings that can be parsed as false
      const falseStringInputs = ['false', 'FALSE', 'False', 'no', 'NO', 'No', '0', ' false '];
      for (const input of falseStringInputs) {
        const result = validator(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(false);
        }
      }

      // Valid cases - numbers
      const result1 = validator(1);
      expect(isOk(result1)).toBe(true);
      if (isOk(result1)) {
        expect(result1.value).toBe(true);
      }

      const result0 = validator(0);
      expect(isOk(result0)).toBe(true);
      if (isOk(result0)) {
        expect(result0.value).toBe(false);
      }

      // Invalid cases
      const invalidInputs = ['not a boolean', 'truthy', 'falsy', 2, -1, null, undefined, {}, []];

      for (const input of invalidInputs) {
        const result = validator(input);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error[0]?.message || '').toBe('Must be a valid boolean value');
        }
      }
    });

    test('should allow custom error message', () => {
      const customMessage = "Please enter 'yes' or 'no'";
      const validator = parseBool(customMessage);

      const result = validator('maybe');
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe(customMessage);
      }
    });

    test('should include path in error', () => {
      const validator = parseBool();
      const path = ['user', 'agreeToTerms'];

      const result = validator('maybe', path);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.path || []).toEqual(path);
      }
    });
  });

  describe('parseJSON()', () => {
    test('should parse valid JSON strings', () => {
      const validator = parseJSON();

      // Valid cases - JSON strings
      const validJsonInputs = [
        { input: '{"name":"John"}', expected: { name: 'John' } },
        { input: '[1,2,3]', expected: [1, 2, 3] },
        { input: '"hello"', expected: 'hello' },
        { input: '42', expected: 42 },
        { input: 'true', expected: true },
      ];

      for (const { input, expected } of validJsonInputs) {
        const result = validator(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toEqual(expected);
        }
      }

      // Valid cases - already objects
      const validObjectInputs = [{ name: 'John' }, [1, 2, 3]];

      for (const input of validObjectInputs) {
        const result = validator(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toEqual(input);
        }
      }

      // Invalid cases
      const invalidInputs = [
        '{invalid json}', // malformed JSON
        "{'name': 'John'}", // single quotes not valid in JSON
        '[1, 2,', // incomplete JSON
        true,
        false,
        42,
        null, // Based on the implementation, null is treated as invalid
        undefined,
      ];

      for (const input of invalidInputs) {
        const result = validator(input);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error[0]?.message || '').toBe('Must be valid JSON');
        }
      }
    });

    test('should allow custom error message', () => {
      const customMessage = 'Please provide valid JSON data';
      const validator = parseJSON(customMessage);

      const result = validator('{invalid]');
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe(customMessage);
      }
    });

    test('should include path in error', () => {
      const validator = parseJSON();
      const path = ['api', 'payload'];

      const result = validator('{invalid]', path);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.path || []).toEqual(path);
      }
    });
  });

  describe('parseISODate()', () => {
    test('should parse valid ISO date strings', () => {
      const validator = parseISODate();

      // Valid cases - ISO date strings
      const validIsoDateInputs = [
        '2023-05-15',
        '2023-01-01',
        '2023-12-31',
        '2023-05-15T12:00:00Z',
        '2023-05-15T12:00:00.000Z',
      ];

      for (const input of validIsoDateInputs) {
        const result = validator(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value instanceof Date).toBe(true);
          expect(Number.isNaN(result.value.getTime())).toBe(false);

          // Check that the date components match what we expect
          const inputDate = new Date(input);
          expect(result.value.getUTCFullYear()).toBe(inputDate.getUTCFullYear());
          expect(result.value.getUTCMonth()).toBe(inputDate.getUTCMonth());
          expect(result.value.getUTCDate()).toBe(inputDate.getUTCDate());
        }
      }

      // Invalid cases
      const invalidInputs = [
        '2023/05/15', // wrong format
        '15-05-2023', // wrong format
        '2023-13-01', // invalid month
        '2023-01-32', // invalid day
        '2023-02-30', // invalid day for month
        '05-15-2023', // wrong format
        'not a date',
        'May 15, 2023', // not ISO format
        '20230515', // missing separators
        true,
        false,
        42,
        null,
        undefined,
        {},
        [],
        new Date(), // must be string
      ];

      for (const input of invalidInputs) {
        const result = validator(input);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error[0]?.message || '').toBe('Must be a valid ISO date string');
        }
      }
    });

    test('should allow custom error message', () => {
      const customMessage = 'Please provide a date in YYYY-MM-DD format';
      const validator = parseISODate(customMessage);

      const result = validator('05/15/2023');
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe(customMessage);
      }
    });

    test('should include path in error', () => {
      const validator = parseISODate();
      const path = ['event', 'date'];

      const result = validator('05/15/2023', path);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.path || []).toEqual(path);
      }
    });
  });

  describe('parseURL()', () => {
    test('should parse valid URLs', () => {
      const validator = parseURL();

      // Valid cases - URL strings
      const validUrlInputs = [
        'https://example.com',
        'http://localhost:3000',
        'https://sub.example.com/path?query=value#hash',
        'ftp://example.com',
        'file:///path/to/file.txt',
      ];

      for (const input of validUrlInputs) {
        const result = validator(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value instanceof URL).toBe(true);
          // URLs are normalized, so we can't directly compare the string
          expect(result.value.toString()).toBeTruthy();
        }
      }

      // Invalid cases
      const invalidInputs = [
        'not a url',
        'example.com', // missing protocol
        'http://', // missing domain
        '',
        ' ',
        true,
        false,
        42,
        null,
        undefined,
        {},
        [],
      ];

      for (const input of invalidInputs) {
        const result = validator(input);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error[0]?.message || '').toBe('Must be a valid URL');
        }
      }
    });

    test('should allow custom error message', () => {
      const customMessage = 'Please enter a valid web address';
      const validator = parseURL(customMessage);

      const result = validator('not a url');
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe(customMessage);
      }
    });

    test('should include path in error', () => {
      const validator = parseURL();
      const path = ['website', 'url'];

      const result = validator('not a url', path);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.path || []).toEqual(path);
      }
    });
  });
});
