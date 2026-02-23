import { describe, test, expect } from 'bun:test';

import { isErr, isOk, ok, err } from '@/result';
import { array } from '@/schema/array';
import { object, required } from '@/schema/core';
import { number } from '@/schema/number';
import { string } from '@/schema/string';
import { tuple, tupleOf } from '@/schema/tuple';
import { validate, validateAndFormatResult } from '@/schema/utils';

import type { AsyncValidator, Validator } from '@/schema/core';

// Helper: async delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper: always-failing sync validator
const failWith = (msg: string): Validator<unknown, never> => {
  return (_value, path = []) => err([{ path, message: msg }]);
};

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

describe('abortEarly', () => {
  describe('object + abortEarly', () => {
    test('stops on first field error', () => {
      const schema = object({
        a: failWith('a failed'),
        b: failWith('b failed'),
        c: failWith('c failed'),
      });

      const result = validate({}, schema, { abortEarly: true });
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toHaveLength(1);
        expect(result.error[0]!.message).toBe('a failed');
      }
    });

    test('collects all errors without abortEarly', () => {
      const schema = object({
        a: failWith('a failed'),
        b: failWith('b failed'),
        c: failWith('c failed'),
      });

      const result = validate({}, schema);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toHaveLength(3);
      }
    });

    test('strict mode reports only first extra key with abortEarly', () => {
      const schema = object({ name: required(string()) });

      const result = validate({ name: 'ok', extra1: 1, extra2: 2 }, schema, { abortEarly: true });
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toHaveLength(1);
        expect(result.error[0]!.message).toMatch(/Unexpected field/);
      }
    });

    test('strict mode reports all extra keys without abortEarly', () => {
      const schema = object({ name: required(string()) });

      const result = validate({ name: 'ok', extra1: 1, extra2: 2 }, schema);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toHaveLength(2);
      }
    });

    test('happy path unaffected by abortEarly', () => {
      const schema = object({
        name: required(string()),
        age: required(number()),
      });

      const result = validate({ name: 'John', age: 30 }, schema, { abortEarly: true });
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual({ name: 'John', age: 30 });
      }
    });

    test('nested objects propagate abortEarly', () => {
      const inner = object({
        x: failWith('x failed'),
        y: failWith('y failed'),
      });
      const outer = object({ nested: inner });

      const result = validate({ nested: {} }, outer, { abortEarly: true });
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toHaveLength(1);
        expect(result.error[0]!.path).toEqual(['nested', 'x']);
      }
    });
  });

  describe('array + abortEarly', () => {
    test('stops on first item error', () => {
      const schema = array(number());

      const result = validate(['a', 'b', 'c'], schema, { abortEarly: true });
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toHaveLength(1);
        expect(result.error[0]!.path).toEqual(['0']);
      }
    });

    test('collects all item errors without abortEarly', () => {
      const schema = array(number());

      const result = validate(['a', 'b', 'c'], schema);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toHaveLength(3);
      }
    });

    test('happy path unaffected by abortEarly', () => {
      const schema = array(number());

      const result = validate([1, 2, 3], schema, { abortEarly: true });
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual([1, 2, 3]);
      }
    });
  });

  describe('tuple + abortEarly', () => {
    test('stops on first position error', () => {
      const schema = tuple([failWith('pos0'), failWith('pos1'), failWith('pos2')]);

      const result = validate([1, 2, 3], schema, { abortEarly: true });
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toHaveLength(1);
        expect(result.error[0]!.message).toBe('pos0');
      }
    });

    test('collects all errors without abortEarly', () => {
      const schema = tuple([failWith('pos0'), failWith('pos1'), failWith('pos2')]);

      const result = validate([1, 2, 3], schema);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toHaveLength(3);
      }
    });
  });

  describe('tupleOf + abortEarly', () => {
    test('stops on first element error', () => {
      const schema = tupleOf(number(), 3);

      const result = validate(['a', 'b', 'c'], schema, { abortEarly: true });
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toHaveLength(1);
        expect(result.error[0]!.path).toEqual(['0']);
      }
    });

    test('collects all errors without abortEarly', () => {
      const schema = tupleOf(number(), 3);

      const result = validate(['a', 'b', 'c'], schema);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toHaveLength(3);
      }
    });
  });

  describe('async + abortEarly', () => {
    test('sync error prevents launching new async fields', async () => {
      let asyncCalled = false;
      const asyncValidator: AsyncValidator<unknown, string> = async (value) => {
        asyncCalled = true;
        await delay(1);
        return ok(String(value));
      };

      const schema = object({
        a: failWith('sync fail'),
        b: asyncValidator,
      });

      const result = await validate({}, schema, { abortEarly: true });
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toHaveLength(1);
        expect(result.error[0]!.message).toBe('sync fail');
      }
      expect(asyncCalled).toBe(false);
    });

    test('all-async fields launched in parallel (no sync trigger to break)', async () => {
      const schema = object({
        a: asyncString(),
        b: asyncString(),
      });

      const result = await validate({ a: 123, b: 456 }, schema, { abortEarly: true });
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        // Both were launched since no sync error triggered early bail
        expect(result.error.length).toBeGreaterThanOrEqual(1);
      }
    });

    test('nested async objects propagate abortEarly', async () => {
      const inner = object({
        x: asyncString(),
        y: asyncString(),
      });
      const outer = object({ nested: inner });

      const result = await validate({ nested: { x: 123, y: 456 } }, outer, { abortEarly: true });
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('validate() overloads', () => {
    test('validate(value, validator, options)', () => {
      const schema = object({ a: failWith('fail'), b: failWith('fail') });
      const result = validate({}, schema, { abortEarly: true });
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toHaveLength(1);
      }
    });

    test('validate(value, validator, path, options)', () => {
      const schema = object({ a: failWith('fail') });
      const result = validate({}, schema, ['root'], { abortEarly: true });
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toHaveLength(1);
        expect(result.error[0]!.path).toEqual(['root', 'a']);
      }
    });

    test('backward compat: validate(value, validator)', () => {
      const schema = object({ a: failWith('fail'), b: failWith('fail') });
      const result = validate({}, schema);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toHaveLength(2);
      }
    });

    test('backward compat: validate(value, validator, path)', () => {
      const schema = object({ a: failWith('fail') });
      const result = validate({}, schema, ['root']);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]!.path).toEqual(['root', 'a']);
      }
    });
  });

  describe('validateAndFormatResult + abortEarly', () => {
    test('returns only first error with abortEarly', () => {
      const schema = object({
        a: failWith('a failed'),
        b: failWith('b failed'),
      });

      const result = validateAndFormatResult({}, schema, { abortEarly: true });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(Object.keys(result.errors)).toHaveLength(1);
      }
    });

    test('returns all errors without abortEarly', () => {
      const schema = object({
        a: failWith('a failed'),
        b: failWith('b failed'),
      });

      const result = validateAndFormatResult({}, schema);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(Object.keys(result.errors)).toHaveLength(2);
      }
    });

    test('happy path unaffected', () => {
      const schema = object({ name: required(string()) });

      const result = validateAndFormatResult({ name: 'test' }, schema, { abortEarly: true });
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data).toEqual({ name: 'test' });
      }
    });

    test('async + abortEarly', async () => {
      const schema = object({
        a: asyncString(),
        b: asyncString(),
      });

      const result = await validateAndFormatResult({ a: 123, b: 456 }, schema, { abortEarly: true });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(Object.keys(result.errors).length).toBeGreaterThanOrEqual(1);
      }
    });
  });
});
