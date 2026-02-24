import { describe, expect, test } from 'bun:test';

import { isErr, isOk } from '@/result';
import {
  string,
  minLength,
  maxLength,
  pattern,
  nonEmpty,
  email,
  url,
  phoneNumber,
  uuid,
  isoDate,
  isoTime,
  isoDateTime,
  isoDuration,
} from '@/schema/string';

describe('string validators', () => {
  describe('string()', () => {
    test('should validate strings', () => {
      const validator = string();

      // Valid cases
      const validInputs = ['hello', '', '123', 'true'];
      for (const input of validInputs) {
        const result = validator(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(input);
        }
      }

      // Invalid cases
      const invalidInputs = [123, true, false, null, undefined, {}, []];
      for (const input of invalidInputs) {
        const result = validator(input);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error[0]?.message || '').toBe('Must be a string');
        }
      }
    });

    test('should allow custom error message', () => {
      const customMessage = 'Expected string value';
      const validator = string(customMessage);

      const result = validator(123);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe(customMessage);
      }
    });

    test('should include path in error', () => {
      const validator = string();
      const path = ['user', 'name'];

      const result = validator(123, path);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.path || []).toEqual(path);
      }
    });
  });

  describe('minLength()', () => {
    test('should validate minimum string length', () => {
      const min = 3;
      const validator = minLength(min);

      // Valid cases
      const validInputs = ['hello', '123', 'true', 'a'.repeat(min)];
      for (const input of validInputs) {
        const result = validator(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(input);
        }
      }

      // Invalid cases
      const invalidInputs = ['', 'a', 'ab'];
      for (const input of invalidInputs) {
        const result = validator(input);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error[0]?.message || '').toBe(`Must be at least ${min} characters`);
        }
      }
    });

    test('should allow custom error message', () => {
      const min = 5;
      const customMessage = `Minimum length is ${min}`;
      const validator = minLength(min, customMessage);

      const result = validator('test');
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe(customMessage);
      }
    });

    test('should include path in error', () => {
      const validator = minLength(3);
      const path = ['user', 'password'];

      const result = validator('ab', path);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.path || []).toEqual(path);
      }
    });
  });

  describe('maxLength()', () => {
    test('should validate maximum string length', () => {
      const max = 5;
      const validator = maxLength(max);

      // Valid cases
      const validInputs = ['', 'a', 'ab', 'abc', 'abcd', 'abcde'];
      for (const input of validInputs) {
        const result = validator(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(input);
        }
      }

      // Invalid cases
      const invalidInputs = ['abcdef', '1234567', 'a'.repeat(max + 1)];
      for (const input of invalidInputs) {
        const result = validator(input);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error[0]?.message || '').toBe(`Must be at most ${max} characters`);
        }
      }
    });

    test('should allow custom error message', () => {
      const max = 10;
      const customMessage = `Maximum length is ${max}`;
      const validator = maxLength(max, customMessage);

      const result = validator('abcdefghijk'); // 11 characters
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe(customMessage);
      }
    });

    test('should include path in error', () => {
      const validator = maxLength(5);
      const path = ['post', 'title'];

      const result = validator('This title is too long', path);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.path || []).toEqual(path);
      }
    });
  });

  describe('pattern()', () => {
    test('should validate string against a pattern', () => {
      const alphaNumericRegex = /^[a-zA-Z0-9]+$/;
      const validator = pattern(alphaNumericRegex);

      // Valid cases
      const validInputs = ['abc123', 'ABC', '123', 'a1B2c3'];
      for (const input of validInputs) {
        const result = validator(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(input);
        }
      }

      // Invalid cases
      const invalidInputs = ['', ' ', 'abc-123', 'hello world', 'special@char'];
      for (const input of invalidInputs) {
        const result = validator(input);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error[0]?.message || '').toBe('Invalid format');
        }
      }
    });

    test('should allow custom error message', () => {
      const numberRegex = /^\d+$/;
      const customMessage = 'Must contain only digits';
      const validator = pattern(numberRegex, customMessage);

      const result = validator('abc123');
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe(customMessage);
      }
    });

    test('should include path in error', () => {
      const usernameRegex = /^[a-z0-9_]+$/;
      const validator = pattern(usernameRegex);
      const path = ['user', 'username'];

      const result = validator('User Name', path);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.path || []).toEqual(path);
      }
    });
  });

  describe('nonEmpty()', () => {
    test('should validate non-empty strings', () => {
      const validator = nonEmpty();

      // Valid cases
      const validInputs = ['hello', '123', '  text  ', ' a '];
      for (const input of validInputs) {
        const result = validator(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(input);
        }
      }

      // Invalid cases
      const invalidInputs = ['', ' ', '   ', '\t', '\n'];
      for (const input of invalidInputs) {
        const result = validator(input);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error[0]?.message || '').toBe('Field must not be empty');
        }
      }
    });

    test('should allow custom error message', () => {
      const customMessage = 'This field is required';
      const validator = nonEmpty(customMessage);

      const result = validator('  ');
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe(customMessage);
      }
    });

    test('should include path in error', () => {
      const validator = nonEmpty();
      const path = ['user', 'description'];

      const result = validator('', path);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.path || []).toEqual(path);
      }
    });
  });

  describe('email()', () => {
    test('should validate email format', () => {
      const validator = email();

      // Valid cases
      const validInputs = ['test@example.com', 'user.name@domain.co.uk', 'user+tag@example.org', '123@domain.net'];
      for (const input of validInputs) {
        const result = validator(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(input);
        }
      }

      // Invalid cases
      const invalidInputs = [
        '',
        'not an email',
        'missing@domain',
        '@missing-user.com',
        'spaces in@domain.com',
        'missing.domain@',
        'two@@at.com',
      ];
      for (const input of invalidInputs) {
        const result = validator(input);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error[0]?.message || '').toBe('Invalid email format');
        }
      }
    });

    test('should allow custom error message', () => {
      const customMessage = 'Please enter a valid email address';
      const validator = email(customMessage);

      const result = validator('not-an-email');
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe(customMessage);
      }
    });

    test('should include path in error', () => {
      const validator = email();
      const path = ['user', 'email'];

      const result = validator('invalid@', path);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.path || []).toEqual(path);
      }
    });
  });

  describe('url()', () => {
    test('should validate URL format', () => {
      const validator = url();

      // Valid cases
      const validInputs = [
        'https://example.com',
        'http://example.com',
        'https://example.com/path?query=value',
        'https://sub.domain.example.com',
        'ftp://files.example.com',
        'https://example.com:8080',
        'https://example.com/path#fragment',
      ];
      for (const input of validInputs) {
        const result = validator(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(input);
        }
      }

      // Invalid cases
      const invalidInputs = ['', 'not a url', 'example.com', '://missing-scheme.com', 'http://', 'just-text'];
      for (const input of invalidInputs) {
        const result = validator(input);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error[0]?.message || '').toBe('Invalid URL format');
        }
      }
    });

    test('should allow custom error message', () => {
      const customMessage = 'Please enter a valid URL';
      const validator = url(customMessage);

      const result = validator('not-a-url');
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe(customMessage);
      }
    });

    test('should include path in error', () => {
      const validator = url();
      const path = ['profile', 'website'];

      const result = validator('invalid', path);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.path || []).toEqual(path);
      }
    });
  });

  describe('phoneNumber()', () => {
    test('should validate phone number format', () => {
      const validator = phoneNumber();

      // Valid cases - various phone number formats
      const validInputs = [
        '123-456-7890',
        '(555) 123-4567',
        '+1-555-123-4567',
        '+44 20 7123 1234',
        '555 123 4567',
        '1234567890',
        '+33 1 23 45 67 89',
        '(123) 456-7890',
      ];
      for (const input of validInputs) {
        const result = validator(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(input); // Should return original format
        }
      }

      // Invalid cases
      const invalidInputs = [
        '',
        'not a phone',
        '123', // too short
        'abc-def-ghij', // letters
        '12 34', // too short
        '+', // just a plus
        '123-456-789012345678901', // too long
        '@#$%^&*()',
        '((((((((', // all parens, no digits
        '--------', // all dashes, no digits
      ];
      for (const input of invalidInputs) {
        const result = validator(input);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error[0]?.message || '').toBe('Invalid phone number format');
        }
      }
    });

    test('should allow custom error message', () => {
      const customMessage = 'Please enter a valid phone number';
      const validator = phoneNumber(customMessage);

      const result = validator('not-a-phone');
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe(customMessage);
      }
    });

    test('should include path in error', () => {
      const validator = phoneNumber();
      const path = ['contact', 'phone'];

      const result = validator('invalid', path);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.path || []).toEqual(path);
      }
    });
  });

  describe('uuid()', () => {
    test('should validate UUID format', () => {
      const validator = uuid();

      const validInputs = [
        '550e8400-e29b-41d4-a716-446655440000',
        '00000000-0000-0000-0000-000000000000', // NIL UUID
        'f47ac10b-58cc-4372-a567-0e02b2c3d479', // v4
        '6ba7b810-9dad-11d1-80b4-00c04fd430c8', // v1
        'F47AC10B-58CC-4372-A567-0E02B2C3D479', // uppercase
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      ];
      for (const input of validInputs) {
        const result = validator(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(input);
        }
      }

      const invalidInputs = [
        '',
        'not-a-uuid',
        '550e8400e29b41d4a716446655440000', // missing hyphens
        '550e8400-e29b-41d4-a716-44665544000', // too short
        '550e8400-e29b-41d4-a716-4466554400000', // too long
        '550e8400-e29b-41d4-a716-44665544000g', // non-hex char
        'g50e8400-e29b-41d4-a716-446655440000', // non-hex char at start
      ];
      for (const input of invalidInputs) {
        const result = validator(input);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error[0]?.message || '').toBe('Invalid UUID format');
        }
      }
    });

    test('should allow custom error message', () => {
      const customMessage = 'Please enter a valid UUID';
      const validator = uuid(customMessage);

      const result = validator('not-a-uuid');
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe(customMessage);
      }
    });

    test('should include path in error', () => {
      const validator = uuid();
      const path = ['record', 'id'];

      const result = validator('invalid', path);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.path || []).toEqual(path);
      }
    });
  });

  describe('isoDate()', () => {
    test('should validate ISO date format', () => {
      const validator = isoDate();

      const validInputs = [
        '2024-01-01',
        '2024-12-31',
        '2024-02-29', // leap year
        '2000-02-29', // leap year (divisible by 400)
        '1999-06-15',
        '2024-04-30',
      ];
      for (const input of validInputs) {
        const result = validator(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(input);
        }
      }

      const invalidInputs = [
        '',
        '2024',
        '2024-01',
        '2024/01/01',
        '01-01-2024',
        '2023-02-29', // not a leap year
        '2024-00-01', // month 0
        '2024-13-01', // month 13
        '2024-01-00', // day 0
        '2024-01-32', // day 32
        '2024-04-31', // April has 30 days
        '2024-1-1', // single digit month/day
      ];
      for (const input of invalidInputs) {
        const result = validator(input);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error[0]?.message || '').toBe('Invalid ISO date format');
        }
      }
    });

    test('should allow custom error message', () => {
      const customMessage = 'Please enter a valid date';
      const validator = isoDate(customMessage);

      const result = validator('not-a-date');
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe(customMessage);
      }
    });

    test('should include path in error', () => {
      const validator = isoDate();
      const path = ['event', 'startDate'];

      const result = validator('invalid', path);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.path || []).toEqual(path);
      }
    });
  });

  describe('isoTime()', () => {
    test('should validate ISO time format', () => {
      const validator = isoTime();

      const validInputs = [
        '00:00:00',
        '23:59:59',
        '14:30:00',
        '14:30:00Z',
        '14:30:00+05:30',
        '14:30:00-08:00',
        '14:30:00.123',
        '14:30:00.123456Z',
        '14:30:00.1+01:00',
      ];
      for (const input of validInputs) {
        const result = validator(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(input);
        }
      }

      const invalidInputs = [
        '',
        '14:30',
        '24:00:00', // hour 24
        '23:60:00', // minute 60
        '23:59:60', // second 60
        '14:30:00+24:00', // tz hour 24
        '14:30:00+00:60', // tz minute 60
        '1:30:00', // single digit hour
        'not-a-time',
      ];
      for (const input of invalidInputs) {
        const result = validator(input);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error[0]?.message || '').toBe('Invalid ISO time format');
        }
      }
    });

    test('should allow custom error message', () => {
      const customMessage = 'Please enter a valid time';
      const validator = isoTime(customMessage);

      const result = validator('not-a-time');
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe(customMessage);
      }
    });

    test('should include path in error', () => {
      const validator = isoTime();
      const path = ['event', 'startTime'];

      const result = validator('invalid', path);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.path || []).toEqual(path);
      }
    });
  });

  describe('isoDateTime()', () => {
    test('should validate ISO datetime format', () => {
      const validator = isoDateTime();

      const validInputs = [
        '2024-01-15T14:30:00Z',
        '2024-01-15T14:30:00+05:30',
        '2024-01-15T14:30:00-08:00',
        '2024-01-15T14:30:00.123Z',
        '2024-01-15T00:00:00Z',
        '2024-01-15T23:59:59Z',
        '2024-02-29T12:00:00Z', // leap year
      ];
      for (const input of validInputs) {
        const result = validator(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(input);
        }
      }

      const invalidInputs = [
        '',
        '2024-01-15', // date only
        '2024-01-15 14:30:00Z', // space separator
        '2024-02-30T14:30:00Z', // invalid date
        '2023-02-29T14:30:00Z', // not a leap year
        '2024-01-15T24:00:00Z', // hour 24
        '2024-01-15T14:60:00Z', // minute 60
        '2024-01-15T14:30:60Z', // second 60
        '2024-01-15T14:30:00+24:00', // tz hour 24
        '2024-01-15T14:30:00+00:60', // tz minute 60
        'not-a-datetime',
      ];
      for (const input of invalidInputs) {
        const result = validator(input);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error[0]?.message || '').toBe('Invalid ISO datetime format');
        }
      }
    });

    test('should allow custom error message', () => {
      const customMessage = 'Please enter a valid datetime';
      const validator = isoDateTime(customMessage);

      const result = validator('not-a-datetime');
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe(customMessage);
      }
    });

    test('should include path in error', () => {
      const validator = isoDateTime();
      const path = ['event', 'createdAt'];

      const result = validator('invalid', path);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.path || []).toEqual(path);
      }
    });
  });

  describe('isoDuration()', () => {
    test('should validate ISO duration format', () => {
      const validator = isoDuration();

      const validInputs = [
        'P1Y',
        'P1M',
        'P1D',
        'PT1H',
        'PT1M',
        'PT1S',
        'P1Y2M3D',
        'PT1H30M',
        'P1Y2M3DT4H5M6S',
        'P4W',
        'PT0.5S', // fractional seconds
        'PT1.123S',
      ];
      for (const input of validInputs) {
        const result = validator(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(input);
        }
      }

      const invalidInputs = [
        '',
        'P', // bare P
        'PT', // bare PT
        '1Y2M3D', // missing P prefix
        'P1Y2M3DT', // trailing T with no time components
        'PW', // week without number
        'not-a-duration',
        'P1H', // H without T
      ];
      for (const input of invalidInputs) {
        const result = validator(input);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error[0]?.message || '').toBe('Invalid ISO duration format');
        }
      }
    });

    test('should allow custom error message', () => {
      const customMessage = 'Please enter a valid duration';
      const validator = isoDuration(customMessage);

      const result = validator('not-a-duration');
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe(customMessage);
      }
    });

    test('should include path in error', () => {
      const validator = isoDuration();
      const path = ['task', 'duration'];

      const result = validator('invalid', path);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.path || []).toEqual(path);
      }
    });
  });
});
