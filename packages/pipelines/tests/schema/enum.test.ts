import { describe, expect, test } from 'bun:test';

import { isErr, isOk } from '@/result';
import { enumValue } from '@/schema/enum';

describe('enum validators', () => {
  // Define test enums
  enum StringStatus {
    Pending = 'PENDING',
    Approved = 'APPROVED',
    Rejected = 'REJECTED',
    Cancelled = 'CANCELLED',
  }

  enum NumericPriority {
    Low = 0,
    Medium = 1,
    High = 2,
    Critical = 3,
  }

  enum MixedEnum {
    First = 0,
    Second = 'SECOND',
    Third = 2,
    Fourth = 'FOURTH',
  }

  describe('enumValue() with string enums', () => {
    test('should validate valid string enum values', () => {
      const validator = enumValue(StringStatus);

      // Valid cases
      const validInputs = [StringStatus.Pending, StringStatus.Approved, StringStatus.Rejected, StringStatus.Cancelled];

      for (const input of validInputs) {
        const result = validator(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(input);
        }
      }
    });

    test('should reject invalid string enum values', () => {
      const validator = enumValue(StringStatus);

      // Invalid cases
      const invalidInputs = [
        'pending', // wrong case
        'UNKNOWN', // not in enum
        'ACTIVE', // not in enum
        '', // empty string
        123, // wrong type
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
          expect(result.error[0]?.message || '').toContain('Value must be one of:');
        }
      }
    });

    test('should handle excluded values', () => {
      const validator = enumValue(StringStatus, undefined, [StringStatus.Rejected, StringStatus.Cancelled]);

      // Valid cases (not excluded)
      const validInputs = [StringStatus.Pending, StringStatus.Approved];
      for (const input of validInputs) {
        const result = validator(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(input);
        }
      }

      // Invalid cases (excluded)
      const excludedInputs = [StringStatus.Rejected, StringStatus.Cancelled];
      for (const input of excludedInputs) {
        const result = validator(input);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error[0]?.message || '').toContain('Selected value is excluded');
        }
      }
    });
  });

  describe('enumValue() with numeric enums', () => {
    test('should validate valid numeric enum values', () => {
      const validator = enumValue(NumericPriority);

      // Valid cases
      const validInputs = [0, 1, 2, 3];

      for (const input of validInputs) {
        const result = validator(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(input);
        }
      }
    });

    test('should reject invalid numeric enum values', () => {
      const validator = enumValue(NumericPriority);

      // Invalid cases
      const invalidInputs = [
        -1, // not in enum
        4, // not in enum
        100, // not in enum
        1.5, // decimal
        '0', // string representation
        '1', // string representation
        true,
        false,
        null,
        undefined,
      ];

      for (const input of invalidInputs) {
        const result = validator(input);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error[0]?.message || '').toContain('Value must be one of:');
        }
      }
    });

    test('should handle excluded numeric values', () => {
      const validator = enumValue(NumericPriority, undefined, [2, 3]); // Exclude High and Critical

      // Valid cases (not excluded)
      const validInputs = [0, 1];
      for (const input of validInputs) {
        const result = validator(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(input);
        }
      }

      // Invalid cases (excluded)
      const excludedInputs = [2, 3];
      for (const input of excludedInputs) {
        const result = validator(input);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error[0]?.message || '').toContain('Selected value is excluded');
        }
      }
    });
  });

  describe('enumValue() with mixed enums', () => {
    test('should validate valid mixed enum values', () => {
      const validator = enumValue(MixedEnum);

      // Valid cases (both string and numeric values)
      const validInputs = [MixedEnum.First, MixedEnum.Second, MixedEnum.Third, MixedEnum.Fourth];

      for (const input of validInputs) {
        const result = validator(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(input);
        }
      }
    });

    test('should reject invalid mixed enum values', () => {
      const validator = enumValue(MixedEnum);

      // Invalid cases
      const invalidInputs = [
        1, // not 0 or 2
        3, // not in enum
        'THIRD', // not in enum
        null,
        undefined,
      ];

      for (const input of invalidInputs) {
        const result = validator(input);
        expect(isErr(result)).toBe(true);
      }
    });
  });

  describe('enumValue() with custom error message', () => {
    test('should use custom error message for invalid values', () => {
      const customMessage = 'Please select a valid status';
      const validator = enumValue(StringStatus, customMessage);

      const result = validator('INVALID');
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe(customMessage);
      }
    });

    test('should use custom error message for excluded values', () => {
      const customMessage = 'This status is not allowed';
      const validator = enumValue(StringStatus, customMessage, [StringStatus.Rejected]);

      const result = validator(StringStatus.Rejected);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe(customMessage);
      }
    });
  });

  describe('enumValue() with path information', () => {
    test('should include path in error for invalid values', () => {
      const validator = enumValue(StringStatus);
      const path = ['form', 'status'];

      const result = validator('INVALID', path);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.path || []).toEqual(path);
      }
    });

    test('should include path in error for excluded values', () => {
      const validator = enumValue(StringStatus, undefined, [StringStatus.Rejected]);
      const path = ['order', 'status'];

      const result = validator(StringStatus.Rejected, path);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.path || []).toEqual(path);
      }
    });
  });

  describe('enumValue() edge cases', () => {
    test('should handle single-value enum', () => {
      enum SingleValue {
        Only = 'ONLY_VALUE',
      }

      const validator = enumValue(SingleValue);

      // Valid case
      const result = validator(SingleValue.Only);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(SingleValue.Only);
      }

      // Invalid case
      const invalidResult = validator('OTHER');
      expect(isErr(invalidResult)).toBe(true);
    });

    test('should handle enum with numeric string-like values', () => {
      enum ConfusingEnum {
        Zero = '0',
        One = '1',
        Two = '2',
      }

      const validator = enumValue(ConfusingEnum);

      // Valid cases (string values)
      const validInputs = [ConfusingEnum.Zero, ConfusingEnum.One, ConfusingEnum.Two];
      for (const input of validInputs) {
        const result = validator(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(input);
        }
      }

      // Invalid cases (actual numbers)
      const invalidInputs = [0, 1, 2];
      for (const input of invalidInputs) {
        const result = validator(input);
        expect(isErr(result)).toBe(true);
      }
    });

    test('should handle negative numeric enum values', () => {
      enum Temperature {
        Freezing = -10,
        Cold = 0,
        Warm = 20,
        Hot = 30,
      }

      const validator = enumValue(Temperature);

      // Valid cases
      const validInputs = [-10, 0, 20, 30];
      for (const input of validInputs) {
        const result = validator(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(input);
        }
      }

      // Invalid cases
      const invalidInputs = [-5, 10, 25];
      for (const input of invalidInputs) {
        const result = validator(input);
        expect(isErr(result)).toBe(true);
      }
    });

    test('should handle const enum values', () => {
      const ConstStatus = {
        Active: 'ACTIVE',
        Inactive: 'INACTIVE',
        Pending: 'PENDING',
      } as const;

      const validator = enumValue(ConstStatus);

      // Valid cases
      const validInputs = [ConstStatus.Active, ConstStatus.Inactive, ConstStatus.Pending];
      for (const input of validInputs) {
        const result = validator(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(input);
        }
      }

      // Invalid case
      const result = validator('DELETED');
      expect(isErr(result)).toBe(true);
    });

    test('should exclude all values when all are in excluded list', () => {
      const validator = enumValue(StringStatus, undefined, [
        StringStatus.Pending,
        StringStatus.Approved,
        StringStatus.Rejected,
        StringStatus.Cancelled,
      ]);

      // All values should be rejected as excluded
      const allValues = [StringStatus.Pending, StringStatus.Approved, StringStatus.Rejected, StringStatus.Cancelled];
      for (const input of allValues) {
        const result = validator(input);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error[0]?.message || '').toContain('Selected value is excluded');
        }
      }
    });

    test('should validate enum values are case-sensitive', () => {
      const validator = enumValue(StringStatus);

      // Valid case
      const validResult = validator(StringStatus.Pending);
      expect(isOk(validResult)).toBe(true);

      // Invalid cases (wrong case)
      const invalidCases = ['pending', 'Pending', 'PeNdInG'];
      for (const input of invalidCases) {
        const result = validator(input);
        expect(isErr(result)).toBe(true);
      }
    });
  });
});
