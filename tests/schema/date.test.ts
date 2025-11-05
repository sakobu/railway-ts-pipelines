import { describe, expect, test } from 'bun:test';

import { isErr, isOk, ok, err } from '@/result';
import { date, dateRange, futureDate, pastDate, todayOrFuture } from '@/schema/date';
import { chain } from '@/schema/utils';

import type { ValidationError, Validator } from '@/schema/core';

// Helper function to mock Date for testing date validators
const createDateMock = (mockDateString = '2023-06-15T12:00:00.000Z') => {
  const originalDate = globalThis.Date;
  const mockDate = new Date(mockDateString);

  // Override the Date constructor with our mock version
  globalThis.Date = class extends Date {
    constructor(...args: [string | number | Date] | []) {
      super();
      if (args.length === 0) {
        return new originalDate(mockDate.getTime());
      }
      return new originalDate(...args);
    }
  } as any;

  return () => {
    globalThis.Date = originalDate;
  };
};

describe('date - validators', () => {
  // Custom date validator for testing
  const dateValidator: Validator<unknown, Date> = (value, path = []) => {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      const error: ValidationError = { path, message: 'Expected a valid date' };
      return err([error]);
    }
    return ok(value);
  };

  // Test our custom validator first to establish the pattern
  describe('dateValidator', () => {
    test('should validate valid dates', () => {
      // Valid case
      const validDate = new Date('2023-01-01');
      const validResult = dateValidator(validDate);
      expect(isOk(validResult)).toBe(true);
      if (isOk(validResult)) {
        expect(validResult.value).toEqual(validDate);
      }

      // Invalid cases
      const invalidInputs = [
        '2023-01-01', // string date
        123, // number
        new Date('invalid'), // invalid date
        null,
        undefined,
        {},
        [],
      ];

      for (const input of invalidInputs) {
        const result = dateValidator(input);
        expect(isErr(result)).toBe(true);

        if (isErr(result)) {
          expect(result.error[0]?.message || '').toBe('Expected a valid date');
        }
      }
    });

    test('should include path in error', () => {
      const path = ['user', 'birthdate'];
      const result = dateValidator('not a date', path);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.path || []).toEqual(path);
      }
    });
  });

  describe('date()', () => {
    test('should pass for valid Date objects', () => {
      const validator = date();
      const now = new Date();
      const result = validator(now);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(now);
      }
    });

    test('should fail for non-Date values', () => {
      const validator = date();
      expect(isErr(validator('2024-01-01'))).toBe(true);
      expect(isErr(validator(1_234_567_890))).toBe(true);
      expect(isErr(validator(null))).toBe(true);
      expect(isErr(validator(undefined))).toBe(true);
    });

    test('should fail for Invalid Date', () => {
      const validator = date();
      const invalidDate = new Date('invalid');
      const result = validator(invalidDate);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe('Invalid Date');
      }
    });

    test('should work in chains with other date validators', () => {
      const validator = chain(date(), futureDate());
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(isOk(validator(tomorrow))).toBe(true);
    });

    test('should use custom error message', () => {
      const validator = date('Must be a valid Date instance');
      const result = validator('not a date');
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe('Must be a valid Date instance');
      }
    });

    test('should include path in error', () => {
      const validator = date();
      const path = ['event', 'startDate'];
      const result = validator('not a date', path);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.path || []).toEqual(path);
      }
    });
  });

  describe('dateRange()', () => {
    test('should validate dates within range', () => {
      const min = new Date('2023-01-01');
      const max = new Date('2023-12-31');
      const validator = dateRange(min, max);

      // Valid case - within range
      const withinRange = new Date('2023-06-15');
      const validResult = validator(withinRange);
      expect(isOk(validResult)).toBe(true);
      if (isOk(validResult)) {
        expect(validResult.value).toEqual(withinRange);
      }

      // Invalid cases - outside range
      const beforeMin = new Date('2022-12-31');
      const beforeResult = validator(beforeMin);
      expect(isErr(beforeResult)).toBe(true);
      if (isErr(beforeResult)) {
        expect(beforeResult.error[0]?.message || '').toBe(
          `Must be between ${min.toISOString().split('T')[0]} and ${max.toISOString().split('T')[0]}`,
        );
      }

      const afterMax = new Date('2024-01-01');
      const afterResult = validator(afterMax);
      expect(isErr(afterResult)).toBe(true);
      if (isErr(afterResult)) {
        expect(afterResult.error[0]?.message || '').toBe(
          `Must be between ${min.toISOString().split('T')[0]} and ${max.toISOString().split('T')[0]}`,
        );
      }
    });

    test('should allow custom error message', () => {
      const min = new Date('2023-01-01');
      const max = new Date('2023-12-31');
      const customMessage = 'Date must be in 2023';
      const validator = dateRange(min, max, customMessage);

      const invalidDate = new Date('2022-06-15');
      const result = validator(invalidDate);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe(customMessage);
      }
    });

    test('should include path in error', () => {
      const min = new Date('2023-01-01');
      const max = new Date('2023-12-31');
      const validator = dateRange(min, max);
      const path = ['event', 'date'];

      const invalidDate = new Date('2022-06-15');
      const result = validator(invalidDate, path);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.path || []).toEqual(path);
      }
    });
  });

  describe('pastDate()', () => {
    test('should validate past dates', () => {
      const restoreDate = createDateMock();

      try {
        const validator = pastDate();

        // Valid case - date in past
        const pastDateValue = new Date('2023-01-01');
        const validResult = validator(pastDateValue);
        expect(isOk(validResult)).toBe(true);
        if (isOk(validResult)) {
          expect(validResult.value).toEqual(pastDateValue);
        }

        // Invalid cases - current or future dates
        const currentDate = new Date();
        const currentResult = validator(currentDate);
        expect(isErr(currentResult)).toBe(true);
        if (isErr(currentResult)) {
          expect(currentResult.error[0]?.message || '').toBe('Must be a date in the past');
        }

        const futureDate = new Date('2023-12-31');
        const futureResult = validator(futureDate);
        expect(isErr(futureResult)).toBe(true);
        if (isErr(futureResult)) {
          expect(futureResult.error[0]?.message || '').toBe('Must be a date in the past');
        }
      } finally {
        restoreDate();
      }
    });

    test('should allow custom error message', () => {
      const restoreDate = createDateMock();

      try {
        const customMessage = 'Please enter a date in the past';
        const validator = pastDate(customMessage);

        const futureDate = new Date('2023-12-31');
        const result = validator(futureDate);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error[0]?.message || '').toBe(customMessage);
        }
      } finally {
        restoreDate();
      }
    });

    test('should include path in error', () => {
      const restoreDate = createDateMock();

      try {
        const validator = pastDate();
        const path = ['user', 'birthdate'];

        const futureDate = new Date('2023-12-31');
        const result = validator(futureDate, path);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error[0]?.path || []).toEqual(path);
        }
      } finally {
        restoreDate();
      }
    });
  });

  describe('futureDate()', () => {
    test('should validate future dates', () => {
      const restoreDate = createDateMock();

      try {
        const validator = futureDate();

        // Valid case - date in future
        const futureDateValue = new Date('2023-12-31');
        const validResult = validator(futureDateValue);
        expect(isOk(validResult)).toBe(true);
        if (isOk(validResult)) {
          expect(validResult.value).toEqual(futureDateValue);
        }

        // Invalid cases - current or past dates
        const currentDate = new Date();
        const currentResult = validator(currentDate);
        expect(isErr(currentResult)).toBe(true);
        if (isErr(currentResult)) {
          expect(currentResult.error[0]?.message || '').toBe('Must be a date in the future');
        }

        const pastDateValue = new Date('2023-01-01');
        const pastResult = validator(pastDateValue);
        expect(isErr(pastResult)).toBe(true);
        if (isErr(pastResult)) {
          expect(pastResult.error[0]?.message || '').toBe('Must be a date in the future');
        }
      } finally {
        restoreDate();
      }
    });

    test('should allow custom error message', () => {
      const restoreDate = createDateMock();

      try {
        const customMessage = 'Please enter a future date';
        const validator = futureDate(customMessage);

        const pastDateValue = new Date('2023-01-01');
        const result = validator(pastDateValue);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error[0]?.message || '').toBe(customMessage);
        }
      } finally {
        restoreDate();
      }
    });

    test('should include path in error', () => {
      const restoreDate = createDateMock();

      try {
        const validator = futureDate();
        const path = ['event', 'date'];

        const pastDateValue = new Date('2023-01-01');
        const result = validator(pastDateValue, path);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error[0]?.path || []).toEqual(path);
        }
      } finally {
        restoreDate();
      }
    });
  });

  describe('todayOrFuture()', () => {
    test('should validate today or future dates', () => {
      const restoreDate = createDateMock();

      try {
        const validator = todayOrFuture();
        const today = new Date('2023-06-15T00:00:00.000Z');

        // Valid cases - today or future
        const todayResult = validator(today);
        expect(isOk(todayResult)).toBe(true);
        if (isOk(todayResult)) {
          expect(todayResult.value).toEqual(today);
        }

        const tomorrow = new Date('2023-06-16');
        const tomorrowResult = validator(tomorrow);
        expect(isOk(tomorrowResult)).toBe(true);
        if (isOk(tomorrowResult)) {
          expect(tomorrowResult.value).toEqual(tomorrow);
        }

        // Invalid case - past date
        const yesterday = new Date('2023-06-14');
        const yesterdayResult = validator(yesterday);
        expect(isErr(yesterdayResult)).toBe(true);
        if (isErr(yesterdayResult)) {
          expect(yesterdayResult.error[0]?.message || '').toBe('Must be today or a future date');
        }
      } finally {
        restoreDate();
      }
    });

    test('should allow custom error message', () => {
      const restoreDate = createDateMock();

      try {
        const customMessage = "Please enter today's date or a future date";
        const validator = todayOrFuture(customMessage);

        const pastDate = new Date('2023-06-14');
        const result = validator(pastDate);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error[0]?.message || '').toBe(customMessage);
        }
      } finally {
        restoreDate();
      }
    });

    test('should include path in error', () => {
      const restoreDate = createDateMock();

      try {
        const validator = todayOrFuture();
        const path = ['event', 'date'];

        const pastDate = new Date('2023-06-14');
        const result = validator(pastDate, path);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error[0]?.path || []).toEqual(path);
        }
      } finally {
        restoreDate();
      }
    });
  });
});
