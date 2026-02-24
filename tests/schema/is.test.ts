import { describe, test, expect } from 'bun:test';

import { err, ok } from '@/result';
import { array } from '@/schema/array';
import { object, optional, required } from '@/schema/core';
import { number } from '@/schema/number';
import { string, minLength, nonEmpty } from '@/schema/string';
import { chain, is } from '@/schema/utils';

import type { AsyncValidator, Validator } from '@/schema/core';

// Helper: async delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper: async validator that simulates I/O
const asyncString = (): AsyncValidator<unknown, string> => {
  return async (value, path = []) => {
    await delay(1);
    if (typeof value !== 'string') {
      return err([{ path, message: 'Must be a string' }]);
    }
    return ok(value);
  };
};

describe('is()', () => {
  describe('sync validators', () => {
    test('returns true for valid primitive', () => {
      expect(is('hello', string())).toBe(true);
    });

    test('returns false for invalid primitive', () => {
      expect(is(42, string())).toBe(false);
    });

    test('returns true for valid number', () => {
      expect(is(42, number())).toBe(true);
    });

    test('returns false for invalid number', () => {
      expect(is('not a number', number())).toBe(false);
    });

    test('works with chained validators', () => {
      const validator = chain(string(), nonEmpty(), minLength(5));
      expect(is('hello', validator)).toBe(true);
      expect(is('hi', validator)).toBe(false);
      expect(is('', validator)).toBe(false);
    });

    test('works with valid objects', () => {
      const schema = object({
        name: required(string()),
        age: required(number()),
      });
      expect(is({ name: 'John', age: 30 }, schema)).toBe(true);
    });

    test('returns false for invalid objects', () => {
      const schema = object({
        name: required(string()),
        age: required(number()),
      });
      expect(is({ name: 'John', age: 'not a number' }, schema)).toBe(false);
    });

    test('works with nested objects', () => {
      const schema = object({
        user: required(
          object({
            name: required(string()),
          }),
        ),
      });
      expect(is({ user: { name: 'John' } }, schema)).toBe(true);
      expect(is({ user: { name: 42 } }, schema)).toBe(false);
    });

    test('works with arrays', () => {
      const schema = array(number());
      expect(is([1, 2, 3], schema)).toBe(true);
      expect(is([1, 'two', 3], schema)).toBe(false);
    });

    test('works with optional fields', () => {
      const schema = object({
        name: required(string()),
        bio: optional(string()),
      });
      expect(is({ name: 'John' }, schema)).toBe(true);
      expect(is({ name: 'John', bio: 'hello' }, schema)).toBe(true);
    });

    test('strict mode rejects extra fields', () => {
      const schema = object({ name: required(string()) });
      expect(is({ name: 'John', extra: true }, schema)).toBe(false);
    });
  });

  describe('async validators', () => {
    test('returns Promise<boolean> for async validator', async () => {
      const result = is('hello', asyncString());
      expect(result).toBeInstanceOf(Promise);
      expect(await result).toBe(true);
    });

    test('resolves to false for invalid async value', async () => {
      expect(await is(42, asyncString())).toBe(false);
    });

    test('works with async object fields', async () => {
      const schema = object({
        name: asyncString(),
      });
      expect(await is({ name: 'John' }, schema)).toBe(true);
      expect(await is({ name: 42 }, schema)).toBe(false);
    });
  });

  describe('type-level', () => {
    test('sync validator returns plain boolean', () => {
      const result: boolean = is('hello', string());
      expect(typeof result).toBe('boolean');
    });

    test('async validator returns Promise<boolean>', () => {
      const result: boolean | Promise<boolean> = is('hello', asyncString());
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe('short-circuit behavior', () => {
    test('does not call subsequent validators after first failure (sync)', () => {
      let secondCalled = false;
      const alwaysFail: Validator<unknown, string> = (_value, path = []) =>
        err([{ path, message: 'fail' }]);
      const spy: Validator<unknown, string> = (value) => {
        secondCalled = true;
        return ok(String(value));
      };

      const schema = object({
        a: alwaysFail,
        b: spy,
      });

      is({}, schema);
      expect(secondCalled).toBe(false);
    });

    test('sync error prevents launching async fields', async () => {
      let asyncCalled = false;
      const asyncValidator: AsyncValidator<unknown, string> = async (value) => {
        asyncCalled = true;
        await delay(1);
        return ok(String(value));
      };

      const alwaysFail: Validator<unknown, string> = (_value, path = []) =>
        err([{ path, message: 'fail' }]);

      const schema = object({
        a: alwaysFail,
        b: asyncValidator,
      });

      const result = is({}, schema);
      // Sync error means no promise is returned
      expect(typeof result).toBe('boolean');
      expect(result).toBe(false);
      expect(asyncCalled).toBe(false);
    });
  });
});
