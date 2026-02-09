import { describe, test, expect } from 'bun:test';

import { err, ok } from '@/result';
import { object, required } from '@/schema/core';
import { number } from '@/schema/number';
import { string } from '@/schema/string';
import { toStandardSchema } from '@/schema/standard';

import type { StandardSchemaV1 } from '@/schema/standard';
import type { AsyncValidator, Validator } from '@/schema/core';

describe('Standard Schema', () => {
  describe('toStandardSchema', () => {
    test('returns object with ~standard property', () => {
      const validator: Validator<unknown, string> = (value, path = []) =>
        typeof value === 'string' ? ok(value) : err([{ path, message: 'Expected string' }]);

      const schema = toStandardSchema(validator);
      expect(schema['~standard']).toBeDefined();
    });

    test('~standard.version is 1', () => {
      const schema = toStandardSchema(string());
      expect(schema['~standard'].version).toBe(1);
    });

    test('~standard.vendor is railway-ts', () => {
      const schema = toStandardSchema(string());
      expect(schema['~standard'].vendor).toBe('railway-ts');
    });

    test('sync validator: valid input returns { value }', () => {
      const schema = toStandardSchema(string());
      const result = schema['~standard'].validate('hello');
      expect(result).toEqual({ value: 'hello' });
    });

    test('sync validator: invalid input returns { issues }', () => {
      const schema = toStandardSchema(string());
      const result = schema['~standard'].validate(123);
      expect(result).toEqual({
        issues: [{ message: 'Must be a string', path: [] }],
      });
    });

    test('async validator: valid input returns Promise<{ value }>', async () => {
      const asyncValidator: AsyncValidator<unknown, string> = async (value, path = []) => {
        if (typeof value !== 'string') return err([{ path, message: 'Must be a string' }]);
        return ok(value);
      };

      const schema = toStandardSchema(asyncValidator);
      const result = await schema['~standard'].validate('hello');
      expect(result).toEqual({ value: 'hello' });
    });

    test('async validator: invalid input returns Promise<{ issues }>', async () => {
      const asyncValidator: AsyncValidator<unknown, string> = async (value, path = []) => {
        if (typeof value !== 'string') return err([{ path, message: 'Must be a string' }]);
        return ok(value);
      };

      const schema = toStandardSchema(asyncValidator);
      const result = await schema['~standard'].validate(42);
      expect(result).toEqual({
        issues: [{ message: 'Must be a string', path: [] }],
      });
    });

    test('error mapping: path and message propagate correctly', () => {
      const validator: Validator<unknown, string> = (_value, path = []) =>
        err([{ path: [...path, 'field'], message: 'bad value' }]);

      const schema = toStandardSchema(validator);
      const result = schema['~standard'].validate('anything');
      expect(result).toEqual({
        issues: [{ message: 'bad value', path: ['field'] }],
      });
    });

    test('nested object schema: paths propagate through issues', () => {
      const userSchema = object({
        name: required(string()),
        age: required(number()),
      });

      const schema = toStandardSchema(userSchema);
      const result = schema['~standard'].validate({ name: 123, age: 'not a number' });

      expect('issues' in result).toBe(true);
      if ('issues' in result) {
        const paths = result.issues!.map((i) => i.path);
        expect(paths).toContainEqual(['name']);
        expect(paths).toContainEqual(['age']);
      }
    });

    test('nested object schema: valid input returns { value }', () => {
      const userSchema = object({
        name: required(string()),
        age: required(number()),
      });

      const schema = toStandardSchema(userSchema);
      const result = schema['~standard'].validate({ name: 'Alice', age: 30 });

      expect(result).toEqual({
        value: { name: 'Alice', age: 30 },
      });
    });

    test('multiple validation errors are all included in issues', () => {
      const validator: Validator<unknown, unknown> = (_value, path = []) =>
        err([
          { path: [...path, 'a'], message: 'error a' },
          { path: [...path, 'b'], message: 'error b' },
        ]);

      const schema = toStandardSchema(validator);
      const result = schema['~standard'].validate({});

      expect('issues' in result).toBe(true);
      if ('issues' in result) {
        expect(result.issues).toHaveLength(2);
        expect(result.issues![0]!.message).toBe('error a');
        expect(result.issues![1]!.message).toBe('error b');
      }
    });

    test('type inference: InferOutput resolves correctly', () => {
      const userSchema = object({
        name: required(string()),
        age: required(number()),
      });

      const schema = toStandardSchema(userSchema);

      // This is a compile-time check — if it compiles, the types work
      type Output = StandardSchemaV1.InferOutput<typeof schema>;
      const _check: Output = { name: 'Alice', age: 30 };
      expect(_check).toBeDefined();
    });

    test('sync validator that throws returns issues instead of propagating', () => {
      const throwingValidator: Validator<unknown, string> = () => {
        throw new Error('unexpected boom');
      };

      const schema = toStandardSchema(throwingValidator);
      const result = schema['~standard'].validate('anything');

      expect(result).toEqual({
        issues: [{ message: 'unexpected boom' }],
      });
    });

    test('async validator that rejects returns issues instead of propagating', async () => {
      const rejectingValidator: AsyncValidator<unknown, string> = async () => {
        throw new Error('async boom');
      };

      const schema = toStandardSchema(rejectingValidator);
      const result = await schema['~standard'].validate('anything');

      expect(result).toEqual({
        issues: [{ message: 'async boom' }],
      });
    });

    test('sync validator that throws non-Error returns stringified message', () => {
      const throwingValidator: Validator<unknown, string> = () => {
        // eslint-disable-next-line no-throw-literal
        throw 'raw string error';
      };

      const schema = toStandardSchema(throwingValidator);
      const result = schema['~standard'].validate('anything');

      expect(result).toEqual({
        issues: [{ message: 'raw string error' }],
      });
    });

    test('type inference: InferInput resolves to unknown', () => {
      const schema = toStandardSchema(string());

      // Compile-time check: input type should be unknown
      type Input = StandardSchemaV1.InferInput<typeof schema>;
      const _check: Input = 'anything' as unknown;
      expect(_check).toBeDefined();
    });
  });
});
