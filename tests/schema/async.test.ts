import { describe, test, expect } from 'bun:test';

import { isOk, isErr, ok, err } from '@/result';
import { array } from '@/schema/array';
import { object, required, optional, emptyAsOptional } from '@/schema/core';
import { number } from '@/schema/number';
import { string } from '@/schema/string';
import { tuple, tupleOf } from '@/schema/tuple';
import { discriminatedUnion } from '@/schema/union';
import { chainAsync, validate, validateAndFormatResult, refine, refineAsync, refineAtAsync } from '@/schema/utils';

import type { Validator, AsyncValidator, MaybeAsyncValidator } from '@/schema/core';

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

describe('Async Schema Validation', () => {
  describe('Type-level tests', () => {
    test('AsyncValidator returns Promise<Result>', () => {
      const asyncValidator: AsyncValidator<string, string> = async (value) => {
        return ok(value);
      };
      const result = asyncValidator('hello');
      expect(result).toBeInstanceOf(Promise);
    });

    test('Validator is assignable to MaybeAsyncValidator', () => {
      const syncValidator: Validator<string, string> = (value) => ok(value);
      const maybeAsync: MaybeAsyncValidator<string, string> = syncValidator;
      const result = maybeAsync('hello');
      expect(isOk(result as ReturnType<Validator<string, string>>)).toBe(true);
    });
  });

  describe('chainAsync', () => {
    test('chains all sync validators (returns Promise)', async () => {
      const v = chainAsync(
        string(),
        refine<string>((s) => s.length > 0, 'empty'),
      );
      const result = await v('hello');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) expect(result.value).toBe('hello');
    });

    test('chains mixed sync + async validators', async () => {
      const asyncUpper: AsyncValidator<string, string> = async (value) => {
        await delay(1);
        return ok(value.toUpperCase());
      };
      const v = chainAsync(string(), asyncUpper);
      const result = await v('hello');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) expect(result.value).toBe('HELLO');
    });

    test('short-circuits on sync failure before async step', async () => {
      let asyncCalled = false;
      const asyncStep: AsyncValidator<string, string> = async (value) => {
        asyncCalled = true;
        return ok(value);
      };
      const v = chainAsync(string(), asyncStep);
      const result = await v(42);
      expect(isErr(result)).toBe(true);
      expect(asyncCalled).toBe(false);
    });

    test('single validator', async () => {
      const v = chainAsync(string());
      const result = await v('test');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) expect(result.value).toBe('test');
    });

    test('async failure in chain', async () => {
      const failAsync: AsyncValidator<string, string> = async (_, path = []) => {
        await delay(1);
        return err([{ path, message: 'Async fail' }]);
      };
      const v = chainAsync(string(), failAsync);
      const result = await v('hello');
      expect(isErr(result)).toBe(true);
      if (isErr(result)) expect(result.error[0]!.message).toBe('Async fail');
    });
  });

  describe('refineAsync', () => {
    test('async predicate passes', async () => {
      const v = refineAsync<string>(async (s) => s.length > 0, 'empty');
      const result = await v('hello');
      expect(isOk(result)).toBe(true);
    });

    test('async predicate fails', async () => {
      const v = refineAsync<string>(async (s) => s.length > 5, 'Too short');
      const result = await v('hi');
      expect(isErr(result)).toBe(true);
      if (isErr(result)) expect(result.error[0]!.message).toBe('Too short');
    });

    test('custom message', async () => {
      const v = refineAsync<number>(async (n) => n > 0, 'Must be positive');
      const result = await v(-1);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) expect(result.error[0]!.message).toBe('Must be positive');
    });

    test('composable in chainAsync', async () => {
      const v = chainAsync(
        string(),
        refineAsync<string>(async (s) => {
          await delay(1);
          return s !== 'taken';
        }, 'Already taken'),
      );
      const result = await v('taken');
      expect(isErr(result)).toBe(true);
      if (isErr(result)) expect(result.error[0]!.message).toBe('Already taken');
    });
  });

  describe('refineAtAsync', () => {
    test('targets specific path', async () => {
      const v = refineAtAsync<{ a: number }>('a', async (obj) => obj.a > 0, 'Must be positive');
      const result = await v({ a: -1 });
      expect(isErr(result)).toBe(true);
      if (isErr(result)) expect(result.error[0]!.path).toEqual(['a']);
    });

    test('merges with parent path', async () => {
      const v = refineAtAsync<{ a: number }>('a', async (obj) => obj.a > 0, 'Must be positive');
      const result = await v({ a: -1 }, ['parent']);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) expect(result.error[0]!.path).toEqual(['parent', 'a']);
    });

    test('array targetPath', async () => {
      const v = refineAtAsync<{ nested: { field: number } }>(
        ['nested', 'field'],
        async (obj) => obj.nested.field > 0,
        'Bad value',
      );
      const result = await v({ nested: { field: -1 } });
      expect(isErr(result)).toBe(true);
      if (isErr(result)) expect(result.error[0]!.path).toEqual(['nested', 'field']);
    });

    test('success path returns ok', async () => {
      const v = refineAtAsync<{ a: number }>('a', async (obj) => obj.a > 0, 'Must be positive');
      const result = await v({ a: 5 });
      expect(isOk(result)).toBe(true);
      if (isOk(result)) expect(result.value).toEqual({ a: 5 });
    });
  });

  describe('object() with async fields', () => {
    test('all sync fields returns Result (NOT Promise)', () => {
      const schema = object({
        name: required(string()),
        age: required(number()),
      });
      const result = schema({ name: 'Alice', age: 30 });
      // Sync path — should NOT be a Promise
      expect(result).not.toBeInstanceOf(Promise);
      expect(isOk(result as ReturnType<Validator<unknown, unknown>>)).toBe(true);
    });

    test('one async field returns Promise', async () => {
      const schema = object({
        name: required(asyncString()),
        age: required(number()),
      });
      const result = schema({ name: 'Alice', age: 30 });
      expect(result).toBeInstanceOf(Promise);
      const resolved = await result;
      expect(isOk(resolved)).toBe(true);
      if (isOk(resolved)) {
        expect(resolved.value).toEqual({ name: 'Alice', age: 30 });
      }
    });

    test('multiple async fields run in parallel', async () => {
      const slowValidator = (ms: number): AsyncValidator<unknown, string> => {
        return async (value, path = []) => {
          await delay(ms);
          if (typeof value !== 'string') return err([{ path, message: 'not a string' }]);
          return ok(value);
        };
      };

      const schema = object({
        a: required(slowValidator(50)),
        b: required(slowValidator(50)),
        c: required(slowValidator(50)),
      });

      const start = performance.now();
      const result = await schema({ a: 'x', b: 'y', c: 'z' });
      const elapsed = performance.now() - start;

      expect(isOk(result)).toBe(true);
      // If parallel: ~50ms. If sequential: ~150ms. Allow generous margin.
      expect(elapsed).toBeLessThan(120);
    });

    test('async field failure', async () => {
      const failAsync: AsyncValidator<unknown, string> = async (_, path = []) => {
        return err([{ path, message: 'async fail' }]);
      };
      const schema = object({
        name: required(failAsync),
      });
      const result = await schema({ name: 'test' });
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]!.message).toBe('async fail');
      }
    });

    test('strict mode with async', async () => {
      const schema = object({
        name: required(asyncString()),
      });
      const result = await schema({ name: 'Alice', extra: 'field' });
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.some((e) => e.message.includes('Unexpected field'))).toBe(true);
      }
    });
  });

  describe('required/optional/emptyAsOptional with async validators', () => {
    test('required: null short-circuits sync', () => {
      const v = required(asyncString());
      const result = v(null);
      // null check is sync even with async inner validator
      expect(result).not.toBeInstanceOf(Promise);
      expect(isErr(result as ReturnType<Validator<unknown, unknown>>)).toBe(true);
    });

    test('required: undefined short-circuits sync', () => {
      const v = required(asyncString());
      const result = v(undefined);
      expect(result).not.toBeInstanceOf(Promise);
      expect(isErr(result as ReturnType<Validator<unknown, unknown>>)).toBe(true);
    });

    test('required: value delegation returns Promise', async () => {
      const v = required(asyncString());
      const result = v('hello');
      expect(result).toBeInstanceOf(Promise);
      const resolved = await result;
      expect(isOk(resolved)).toBe(true);
    });

    test('optional: null returns sync ok(undefined)', () => {
      const v = optional(asyncString());
      const result = v(null);
      expect(result).not.toBeInstanceOf(Promise);
      const syncResult = result as Awaited<ReturnType<typeof v>>;
      expect(isOk(syncResult)).toBe(true);
      if (isOk(syncResult)) {
        expect(syncResult.value).toBeUndefined();
      }
    });

    test('optional: value delegation returns Promise', async () => {
      const v = optional(asyncString());
      const result = v('hello');
      expect(result).toBeInstanceOf(Promise);
      const resolved = await result;
      expect(isOk(resolved)).toBe(true);
    });

    test('emptyAsOptional: empty string returns sync ok(undefined)', () => {
      const v = emptyAsOptional(asyncString());
      const result = v('');
      expect(result).not.toBeInstanceOf(Promise);
    });

    test('emptyAsOptional: value delegation returns Promise', async () => {
      const v = emptyAsOptional(asyncString());
      const result = v('hello');
      expect(result).toBeInstanceOf(Promise);
      const resolved = await result;
      expect(isOk(resolved)).toBe(true);
    });
  });

  describe('array() with async', () => {
    test('all elements pass', async () => {
      const v = array(asyncString());
      const result = await v(['a', 'b', 'c']);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) expect(result.value).toEqual(['a', 'b', 'c']);
    });

    test('some elements fail (collect all errors)', async () => {
      const v = array(asyncString());
      const result = await v(['a', 42, 'c', 99]);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toHaveLength(2);
        expect(result.error[0]!.path).toEqual(['1']);
        expect(result.error[1]!.path).toEqual(['3']);
      }
    });

    test('empty array returns sync ok([])', () => {
      const v = array(asyncString());
      const result = v([]);
      // No async validators invoked, should be sync
      expect(result).not.toBeInstanceOf(Promise);
      expect(isOk(result as ReturnType<Validator<unknown, unknown>>)).toBe(true);
    });

    test('preserves element ordering with async', async () => {
      const slowReverseDelay: AsyncValidator<unknown, string> = async (value, path = []) => {
        if (typeof value !== 'string') return err([{ path, message: 'not string' }]);
        // Later indices resolve faster
        await delay(10 - value.length);
        return ok(value);
      };
      const v = array(slowReverseDelay);
      const result = await v(['aaa', 'bb', 'c']);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) expect(result.value).toEqual(['aaa', 'bb', 'c']);
    });
  });

  describe('tuple() with async', () => {
    test('async validators per position (parallel)', async () => {
      const v = tuple([asyncString(), number()]);
      const result = await v(['hello', 42]);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual(['hello', 42]);
      }
    });

    test('wrong length returns sync error', () => {
      const v = tuple([asyncString(), number()]);
      const result = v([1, 2, 3]);
      // Length check is sync
      expect(result).not.toBeInstanceOf(Promise);
      expect(isErr(result as ReturnType<Validator<unknown, unknown>>)).toBe(true);
    });

    test('all sync validators returns sync Result', () => {
      const v = tuple([string(), number()]);
      const result = v(['hello', 42]);
      expect(result).not.toBeInstanceOf(Promise);
      expect(isOk(result as ReturnType<Validator<unknown, unknown>>)).toBe(true);
    });

    test('async element failure collects errors', async () => {
      const v = tuple([asyncString(), number()]);
      const result = await v([123, 42]);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toHaveLength(1);
        expect(result.error[0]!.path).toEqual(['0']);
        expect(result.error[0]!.message).toBe('Must be a string');
      }
    });
  });

  describe('tupleOf() with async', () => {
    test('async validator with fixed length', async () => {
      const v = tupleOf(asyncString(), 3);
      const result = await v(['a', 'b', 'c']);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) expect(result.value).toEqual(['a', 'b', 'c']);
    });

    test('wrong length returns sync error', () => {
      const v = tupleOf(asyncString(), 2);
      const result = v(['a']);
      expect(result).not.toBeInstanceOf(Promise);
      expect(isErr(result as ReturnType<Validator<unknown, unknown>>)).toBe(true);
    });

    test('async element failure collects errors', async () => {
      const v = tupleOf(asyncString(), 3);
      const result = await v(['a', 42, 'c']);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toHaveLength(1);
        expect(result.error[0]!.path).toEqual(['1']);
        expect(result.error[0]!.message).toBe('Must be a string');
      }
    });
  });

  describe('discriminatedUnion() with async branch', () => {
    test('selects async branch (returns Promise)', async () => {
      const schema = discriminatedUnion('type', {
        user: object({
          type: required(string()),
          name: required(asyncString()),
        }),
      });
      const result = await schema({ type: 'user', name: 'Alice' });
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual({ type: 'user', name: 'Alice' });
      }
    });

    test('missing discriminant returns sync error', () => {
      const schema = discriminatedUnion('type', {
        user: object({ type: required(string()) }),
      });
      const result = schema({ noType: true });
      // Discriminant check is sync
      expect(result).not.toBeInstanceOf(Promise);
      expect(isErr(result as ReturnType<Validator<unknown, unknown>>)).toBe(true);
    });

    test('sync branch returns sync Result', () => {
      const schema = discriminatedUnion('type', {
        user: object({ type: required(string()) }),
      });
      const result = schema({ type: 'user' });
      expect(result).not.toBeInstanceOf(Promise);
      expect(isOk(result as ReturnType<Validator<unknown, unknown>>)).toBe(true);
    });
  });

  describe('validateAndFormatResult with async schema', () => {
    test('valid input returns Promise resolving to valid result', async () => {
      const schema = object({
        name: required(asyncString()),
        age: required(number()),
      });
      const result = validateAndFormatResult({ name: 'Alice', age: 30 }, schema);
      expect(result).toBeInstanceOf(Promise);
      const resolved = await result;
      expect(resolved.valid).toBe(true);
      if (resolved.valid) {
        expect(resolved.data).toEqual({ name: 'Alice', age: 30 });
      }
    });

    test('invalid input returns Promise resolving to invalid result with formatted errors', async () => {
      const schema = object({
        name: required(asyncString()),
        age: required(number()),
      });
      const result = validateAndFormatResult({ name: 123, age: 'not a number' }, schema);
      expect(result).toBeInstanceOf(Promise);
      const resolved = await result;
      expect(resolved.valid).toBe(false);
      if (!resolved.valid) {
        expect(resolved.errors).toBeDefined();
        expect('name' in resolved.errors).toBe(true);
      }
    });
  });

  describe('Full integration', () => {
    test('validate with object + required + chainAsync + refineAsync end-to-end', async () => {
      const takenUsernames = new Set(['admin', 'root']);
      const checkAvailability = async (username: string): Promise<boolean> => {
        await delay(5);
        return !takenUsernames.has(username);
      };

      const userSchema = object({
        username: required(chainAsync(string(), refineAsync<string>(checkAvailability, 'Username is taken'))),
        age: required(number()),
      });

      // Valid case
      const validResult = await validate({ username: 'alice', age: 25 }, userSchema);
      expect(isOk(validResult)).toBe(true);
      if (isOk(validResult)) {
        expect(validResult.value).toEqual({ username: 'alice', age: 25 });
      }

      // Taken username
      const takenResult = await validate({ username: 'admin', age: 25 }, userSchema);
      expect(isErr(takenResult)).toBe(true);
      if (isErr(takenResult)) {
        expect(takenResult.error[0]!.message).toBe('Username is taken');
        expect(takenResult.error[0]!.path).toEqual(['username']);
      }

      // Missing field
      const missingResult = await validate({ age: 25 }, userSchema);
      expect(isErr(missingResult)).toBe(true);
    });

    test('nested async object validation', async () => {
      const addressSchema = object({
        city: required(asyncString()),
        zip: required(string()),
      });

      const userSchema = object({
        name: required(string()),
        address: required(addressSchema),
      });

      const result = await validate({ name: 'Alice', address: { city: 'NY', zip: '10001' } }, userSchema);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual({
          name: 'Alice',
          address: { city: 'NY', zip: '10001' },
        });
      }
    });

    test('array of async objects', async () => {
      const itemSchema = object({
        id: required(asyncString()),
      });
      const v = array(itemSchema);
      const result = await v([{ id: 'a' }, { id: 'b' }]);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual([{ id: 'a' }, { id: 'b' }]);
      }
    });
  });
});
