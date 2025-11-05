import { describe, expect, test } from 'bun:test';

import { isErr, isOk, ok, err } from '@/result';
import {
  number,
  min,
  max,
  between,
  integer,
  positive,
  negative,
  nonZero,
  divisibleBy,
  precision,
  finite,
} from '@/schema/number';

import type { ValidationError, Validator } from '@/schema/core';

describe('number - validators', () => {
  // Custom number validator for testing
  const numberValidator: Validator<unknown, number> = (value, path = []) => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      const error: ValidationError = { path, message: 'Expected a valid number' };
      return err([error]);
    }
    return ok(value);
  };

  // Test our custom validator first to establish the pattern
  describe('numberValidator', () => {
    test('should validate valid numbers', () => {
      // Valid cases
      const validInputs = [42, 0, -1, 3.14, Number.MAX_SAFE_INTEGER];
      for (const input of validInputs) {
        const result = numberValidator(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(input);
        }
      }

      // Invalid cases
      const invalidInputs = [
        '42', // string
        Number.NaN, // NaN
        null,
        undefined,
        {},
        [],
        true,
        false,
      ];

      for (const input of invalidInputs) {
        const result = numberValidator(input);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error[0]?.message || '').toBe('Expected a valid number');
        }
      }
    });

    test('should include path in error', () => {
      const path = ['user', 'age'];
      const result = numberValidator('not a number', path);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.path || []).toEqual(path);
      }
    });
  });

  describe('number()', () => {
    test('should validate numbers', () => {
      const validator = number();

      // Valid cases
      const validInputs = [0, 42, -1, 3.14, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER];
      for (const input of validInputs) {
        const result = validator(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(input);
        }
      }

      // Invalid cases
      const invalidInputs = [
        '42', // string
        null,
        undefined,
        true,
        false,
        {},
        [],
        Number.NaN, // NaN is technically a number type but not a valid number
      ];

      for (const input of invalidInputs) {
        const result = validator(input);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error[0]?.message || '').toBe('Must be a number');
        }
      }
    });

    test('should allow custom error message', () => {
      const customMessage = 'Please provide a valid number';
      const validator = number(customMessage);

      const result = validator('not a number');
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe(customMessage);
      }
    });

    test('should include path in error', () => {
      const validator = number();
      const path = ['user', 'age'];

      const result = validator('not a number', path);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.path || []).toEqual(path);
      }
    });
  });

  describe('min()', () => {
    test('should validate numbers above minimum', () => {
      const minimum = 10;
      const validator = min(minimum);

      // Valid cases
      const validInputs = [10, 11, 100, 10.1];
      for (const input of validInputs) {
        const result = validator(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(input);
        }
      }

      // Invalid cases
      const invalidInputs = [9, 9.99, 0, -10];
      for (const input of invalidInputs) {
        const result = validator(input);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error[0]?.message || '').toBe(`Must be at least ${minimum}`);
        }
      }
    });

    test('should allow custom error message', () => {
      const minimum = 18;
      const customMessage = `Age must be at least ${minimum}`;
      const validator = min(minimum, customMessage);

      const result = validator(16);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe(customMessage);
      }
    });

    test('should include path in error', () => {
      const validator = min(21);
      const path = ['user', 'age'];

      const result = validator(18, path);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.path || []).toEqual(path);
      }
    });
  });

  describe('max()', () => {
    test('should validate numbers below maximum', () => {
      const maximum = 100;
      const validator = max(maximum);

      // Valid cases
      const validInputs = [100, 99, 0, -10, 99.9];
      for (const input of validInputs) {
        const result = validator(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(input);
        }
      }

      // Invalid cases
      const invalidInputs = [101, 100.1, 1000];
      for (const input of invalidInputs) {
        const result = validator(input);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error[0]?.message || '').toBe(`Must be at most ${maximum}`);
        }
      }
    });

    test('should allow custom error message', () => {
      const maximum = 5;
      const customMessage = `You can select at most ${maximum} items`;
      const validator = max(maximum, customMessage);

      const result = validator(6);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe(customMessage);
      }
    });

    test('should include path in error', () => {
      const validator = max(5);
      const path = ['cart', 'items'];

      const result = validator(10, path);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.path || []).toEqual(path);
      }
    });
  });

  describe('between()', () => {
    test('should validate numbers in range', () => {
      const minimum = 1;
      const maximum = 10;
      const validator = between(minimum, maximum);

      // Valid cases
      const validInputs = [1, 5, 10, 1.5, 9.9];
      for (const input of validInputs) {
        const result = validator(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(input);
        }
      }

      // Invalid cases - below minimum
      const belowMinimum = [0, -1, 0.9];
      for (const input of belowMinimum) {
        const result = validator(input);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error[0]?.message || '').toBe(`Must be between ${minimum} and ${maximum}`);
        }
      }

      // Invalid cases - above maximum
      const aboveMaximum = [11, 10.1, 100];
      for (const input of aboveMaximum) {
        const result = validator(input);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error[0]?.message || '').toBe(`Must be between ${minimum} and ${maximum}`);
        }
      }
    });

    test('should allow custom error message', () => {
      const minimum = 1;
      const maximum = 5;
      const customMessage = `Rating must be between ${minimum} and ${maximum} stars`;
      const validator = between(minimum, maximum, customMessage);

      const result = validator(6);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe(customMessage);
      }
    });

    test('should include path in error', () => {
      const validator = between(1, 5);
      const path = ['review', 'rating'];

      const result = validator(6, path);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.path || []).toEqual(path);
      }
    });
  });

  describe('integer()', () => {
    test('should validate integers', () => {
      const validator = integer();

      // Valid cases
      const validInputs = [0, 1, -1, 1000, Number.MAX_SAFE_INTEGER];
      for (const input of validInputs) {
        const result = validator(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(input);
        }
      }

      // Invalid cases
      const invalidInputs = [0.1, 1.5, -1.5, Math.PI];
      for (const input of invalidInputs) {
        const result = validator(input);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error[0]?.message || '').toBe('Must be an integer');
        }
      }
    });

    test('should allow custom error message', () => {
      const customMessage = 'Please enter a whole number';
      const validator = integer(customMessage);

      const result = validator(3.14);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe(customMessage);
      }
    });

    test('should include path in error', () => {
      const validator = integer();
      const path = ['product', 'quantity'];

      const result = validator(1.5, path);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.path || []).toEqual(path);
      }
    });
  });

  describe('positive()', () => {
    test('should validate positive numbers', () => {
      const validator = positive();

      // Valid cases
      const validInputs = [1, 0.1, 1000, Number.MAX_VALUE];
      for (const input of validInputs) {
        const result = validator(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(input);
        }
      }

      // Invalid cases
      const invalidInputs = [0, -0.1, -1, -1000];
      for (const input of invalidInputs) {
        const result = validator(input);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error[0]?.message || '').toBe('Must be a positive number');
        }
      }
    });

    test('should allow custom error message', () => {
      const customMessage = 'Amount must be greater than zero';
      const validator = positive(customMessage);

      const result = validator(0);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe(customMessage);
      }
    });

    test('should include path in error', () => {
      const validator = positive();
      const path = ['payment', 'amount'];

      const result = validator(-10, path);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.path || []).toEqual(path);
      }
    });
  });

  describe('negative()', () => {
    test('should validate negative numbers', () => {
      const validator = negative();

      // Valid cases
      const validInputs = [-1, -0.1, -1000, -Number.MAX_VALUE];
      for (const input of validInputs) {
        const result = validator(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(input);
        }
      }

      // Invalid cases
      const invalidInputs = [0, 0.1, 1, 1000];
      for (const input of invalidInputs) {
        const result = validator(input);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error[0]?.message || '').toBe('Must be a negative number');
        }
      }
    });

    test('should allow custom error message', () => {
      const customMessage = 'Value must be less than zero';
      const validator = negative(customMessage);

      const result = validator(0);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe(customMessage);
      }
    });

    test('should include path in error', () => {
      const validator = negative();
      const path = ['account', 'balance'];

      const result = validator(100, path);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.path || []).toEqual(path);
      }
    });
  });

  describe('nonZero()', () => {
    test('should validate non-zero numbers', () => {
      const validator = nonZero();

      // Valid cases
      const validInputs = [1, -1, 0.1, -0.1, 1000, -1000];
      for (const input of validInputs) {
        const result = validator(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(input);
        }
      }

      // Invalid case - zero
      const result = validator(0);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe('Must not be zero');
      }
    });

    test('should allow custom error message', () => {
      const customMessage = 'Please enter a non-zero value';
      const validator = nonZero(customMessage);

      const result = validator(0);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe(customMessage);
      }
    });

    test('should include path in error', () => {
      const validator = nonZero();
      const path = ['calculation', 'factor'];

      const result = validator(0, path);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.path || []).toEqual(path);
      }
    });
  });

  describe('divisibleBy()', () => {
    test('should validate numbers divisible by a divisor', () => {
      const divisor = 5;
      const validator = divisibleBy(divisor);

      // Valid cases
      const validInputs = [0, 5, 10, -5, -10, 100];
      for (const input of validInputs) {
        const result = validator(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(input);
        }
      }

      // Invalid cases
      const invalidInputs = [1, 2, 3, 4, 6, 7, 11, -1, -2, -3];
      for (const input of invalidInputs) {
        const result = validator(input);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error[0]?.message || '').toBe(`Must be divisible by ${divisor}`);
        }
      }
    });

    test('should allow custom error message', () => {
      const divisor = 2;
      const customMessage = 'Please enter an even number';
      const validator = divisibleBy(divisor, customMessage);

      const result = validator(3);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe(customMessage);
      }
    });

    test('should include path in error', () => {
      const validator = divisibleBy(10);
      const path = ['payment', 'amount'];

      const result = validator(25, path);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.path || []).toEqual(path);
      }
    });
  });

  describe('precision()', () => {
    test('should validate numbers with specified precision', () => {
      const maxDecimalPlaces = 2;
      const validator = precision(maxDecimalPlaces);

      // Valid cases
      const validInputs = [1, 1.1, 1.12, 0, -1, -1.1, -1.12, 100, 100.9];
      for (const input of validInputs) {
        const result = validator(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(input);
        }
      }

      // Invalid cases
      const invalidInputs = [1.123, 0.001, -1.999, 3.141_59];
      for (const input of invalidInputs) {
        const result = validator(input);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error[0]?.message || '').toBe(`Must have at most ${maxDecimalPlaces} decimal places`);
        }
      }
    });

    test('should allow custom error message', () => {
      const maxDecimalPlaces = 2;
      const customMessage = `Currency must have at most ${maxDecimalPlaces} decimal places`;
      const validator = precision(maxDecimalPlaces, customMessage);

      const result = validator(9.999);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe(customMessage);
      }
    });

    test('should include path in error', () => {
      const validator = precision(2);
      const path = ['product', 'price'];

      const result = validator(10.999, path);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.path || []).toEqual(path);
      }
    });
  });

  describe('finite()', () => {
    test('should pass for finite numbers', () => {
      const validator = finite();

      // Valid cases
      const validInputs = [0, 42, -999.99, Number.MAX_VALUE, Number.MIN_VALUE, -Number.MAX_VALUE];
      for (const input of validInputs) {
        const result = validator(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(input);
        }
      }
    });

    test('should fail for Infinity', () => {
      const validator = finite();
      const result = validator(Infinity);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe('Must be a finite number');
      }
    });

    test('should fail for -Infinity', () => {
      const validator = finite();
      const result = validator(-Infinity);

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe('Must be a finite number');
      }
    });

    test('should allow custom error message', () => {
      const customMessage = 'Result must be a finite value';
      const validator = finite(customMessage);

      const result = validator(Infinity);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe(customMessage);
      }
    });

    test('should include path in error', () => {
      const validator = finite();
      const path = ['calculation', 'result'];

      const result = validator(Infinity, path);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.path || []).toEqual(path);
      }
    });
  });
});
