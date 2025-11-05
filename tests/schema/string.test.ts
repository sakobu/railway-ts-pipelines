import { describe, expect, test } from 'bun:test';

import { isErr, isOk } from '@/result';
import { string, minLength, maxLength, pattern, nonEmpty, email, phoneNumber } from '@/schema/string';

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
          expect(result.error[0]?.message || '').toBe('String must not be empty');
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
});
