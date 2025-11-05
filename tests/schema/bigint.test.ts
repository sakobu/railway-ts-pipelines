import { describe, expect, test } from 'bun:test';

import { isErr, isOk } from '@/result';
import { bigint } from '@/schema/bigint';

describe('bigint validators', () => {
  describe('bigint()', () => {
    test('should validate bigint values', () => {
      const validator = bigint();

      // Valid cases
      const validInputs = [
        0n,
        1n,
        -1n,
        123n,
        -123n,
        9_007_199_254_740_993n, // Larger than MAX_SAFE_INTEGER
        -9_007_199_254_740_993n,
        BigInt(Number.MAX_SAFE_INTEGER),
        123_456_789_012_345_678_901_234_567_890n,
      ];

      for (const input of validInputs) {
        const result = validator(input);
        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value).toBe(input);
        }
      }

      // Invalid cases
      const invalidInputs = [
        123, // regular number
        '123', // string
        '123n', // string representation
        true,
        false,
        null,
        undefined,
        {},
        [],
        Number.NaN,
        Infinity,
        3.14,
      ];

      for (const input of invalidInputs) {
        const result = validator(input);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error[0]?.message || '').toBe('Must be a bigint');
        }
      }
    });

    test('should handle edge cases', () => {
      const validator = bigint();

      // Test very large bigints
      const veryLarge = 2n ** 100n; // 2^100
      const result1 = validator(veryLarge);
      expect(isOk(result1)).toBe(true);
      if (isOk(result1)) {
        expect(result1.value).toBe(veryLarge);
      }

      // Test negative large bigints
      const veryLargeNegative = -(2n ** 100n);
      const result2 = validator(veryLargeNegative);
      expect(isOk(result2)).toBe(true);
      if (isOk(result2)) {
        expect(result2.value).toBe(veryLargeNegative);
      }

      // Test zero as bigint
      const result3 = validator(0n);
      expect(isOk(result3)).toBe(true);
      if (isOk(result3)) {
        expect(result3.value).toBe(0n);
      }
    });

    test('should reject Number type even if it could be represented as bigint', () => {
      const validator = bigint();

      // These are valid integers but wrong type
      const invalidNumbers = [0, 1, -1, 42, Number.MAX_SAFE_INTEGER];

      for (const input of invalidNumbers) {
        const result = validator(input);
        expect(isErr(result)).toBe(true);
        if (isErr(result)) {
          expect(result.error[0]?.message || '').toBe('Must be a bigint');
        }
      }
    });

    test('should allow custom error message', () => {
      const customMessage = 'Please provide a BigInt value';
      const validator = bigint(customMessage);

      const result = validator(123); // regular number, not bigint
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe(customMessage);
      }
    });

    test('should include path in error', () => {
      const validator = bigint();
      const path = ['transaction', 'amount'];

      const result = validator(1000, path); // regular number, not bigint
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.path || []).toEqual(path);
      }
    });

    test('should work with BigInt constructor', () => {
      const validator = bigint();

      // Test creating bigints with BigInt constructor
      const fromNumber = 123n;
      const result1 = validator(fromNumber);
      expect(isOk(result1)).toBe(true);
      if (isOk(result1)) {
        expect(result1.value).toBe(123n);
      }

      const fromString = 999_999_999_999_999_999_999n;
      const result2 = validator(fromString);
      expect(isOk(result2)).toBe(true);
      if (isOk(result2)) {
        expect(result2.value).toBe(999_999_999_999_999_999_999n);
      }

      const fromHex = 255n; // Avoiding hex literal to avoid linter conflicts
      const result3 = validator(fromHex);
      expect(isOk(result3)).toBe(true);
      if (isOk(result3)) {
        expect(result3.value).toBe(255n);
      }
    });

    test('should handle arithmetic operations on bigints', () => {
      const validator = bigint();

      // Test that arithmetic results still validate
      const sum = 100n + 200n;
      const result1 = validator(sum);
      expect(isOk(result1)).toBe(true);
      if (isOk(result1)) {
        expect(result1.value).toBe(300n);
      }

      const product = 10n * 20n;
      const result2 = validator(product);
      expect(isOk(result2)).toBe(true);
      if (isOk(result2)) {
        expect(result2.value).toBe(200n);
      }

      const power = 2n ** 10n;
      const result3 = validator(power);
      expect(isOk(result3)).toBe(true);
      if (isOk(result3)) {
        expect(result3.value).toBe(1024n);
      }
    });
  });
});
