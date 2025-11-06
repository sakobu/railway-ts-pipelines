import { describe, expect, test } from 'bun:test';

import { err, isErr, isOk, ok } from '@/result';
import { boolean, chain, integer, max, min, number, object, required, string } from '@/schema';
import { tuple, tupleOf } from '@/schema/tuple';

import type { InferSchemaType, ValidationError, Validator } from '@/schema/core';

describe('tuple - heterogeneous tuple validator', () => {
  // Sample validators for testing
  const numberValidator: Validator<unknown, number> = (value, path = []) => {
    if (typeof value !== 'number') {
      const error: ValidationError = { path, message: 'Expected a number' };
      return err([error]);
    }
    return ok(value);
  };

  const stringValidator: Validator<unknown, string> = (value, path = []) => {
    if (typeof value !== 'string') {
      const error: ValidationError = { path, message: 'Expected a string' };
      return err([error]);
    }
    return ok(value);
  };

  const booleanValidator: Validator<unknown, boolean> = (value, path = []) => {
    if (typeof value !== 'boolean') {
      const error: ValidationError = { path, message: 'Expected a boolean' };
      return err([error]);
    }
    return ok(value);
  };

  test('should validate a valid heterogeneous tuple', () => {
    const validator = tuple([stringValidator, numberValidator, booleanValidator]);
    const result = validator(['hello', 42, true]);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual(['hello', 42, true]);
    }
  });

  test('should reject non-array values', () => {
    const validator = tuple([stringValidator, numberValidator]);
    const invalidInputs = [null, 42, 'string', true, undefined, {}];

    for (const input of invalidInputs) {
      const result = validator(input);
      expect(isErr(result)).toBe(true);

      if (isErr(result)) {
        const error = result.error[0] || { path: [], message: '' };
        expect(error.message).toBe('Expected an array');
      }
    }
  });

  test('should reject arrays with incorrect length', () => {
    const validator = tuple([stringValidator, numberValidator, booleanValidator]);

    // Too few elements
    const tooShort = validator(['hello', 42]);
    expect(isErr(tooShort)).toBe(true);
    if (isErr(tooShort)) {
      expect(tooShort.error[0]?.message).toBe('Expected tuple of length 3, got 2');
    }

    // Too many elements
    const tooLong = validator(['hello', 42, true, 'extra']);
    expect(isErr(tooLong)).toBe(true);
    if (isErr(tooLong)) {
      expect(tooLong.error[0]?.message).toBe('Expected tuple of length 3, got 4');
    }
  });

  test('should validate each element with correct validator', () => {
    const validator = tuple([stringValidator, numberValidator, booleanValidator]);

    // Wrong type at position 0
    const result1 = validator([42, 100, true]);
    expect(isErr(result1)).toBe(true);
    if (isErr(result1)) {
      expect(result1.error[0]?.path).toEqual(['0']);
      expect(result1.error[0]?.message).toBe('Expected a string');
    }

    // Wrong type at position 1
    const result2 = validator(['hello', 'wrong', true]);
    expect(isErr(result2)).toBe(true);
    if (isErr(result2)) {
      expect(result2.error[0]?.path).toEqual(['1']);
      expect(result2.error[0]?.message).toBe('Expected a number');
    }

    // Wrong type at position 2
    const result3 = validator(['hello', 42, 'wrong']);
    expect(isErr(result3)).toBe(true);
    if (isErr(result3)) {
      expect(result3.error[0]?.path).toEqual(['2']);
      expect(result3.error[0]?.message).toBe('Expected a boolean');
    }
  });

  test('should accumulate multiple validation errors', () => {
    const validator = tuple([stringValidator, numberValidator, booleanValidator]);
    const result = validator([42, 'wrong', 'also wrong']);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toHaveLength(3);
      expect(result.error[0]?.path).toEqual(['0']);
      expect(result.error[1]?.path).toEqual(['1']);
      expect(result.error[2]?.path).toEqual(['2']);
    }
  });

  test('should work with chain() for refined validation', () => {
    const validator = tuple([string(), chain(number(), integer(), min(0), max(100)), boolean()]);

    const valid = validator(['test', 50, true]);
    expect(isOk(valid)).toBe(true);

    const invalid = validator(['test', 150, true]);
    expect(isErr(invalid)).toBe(true);
    if (isErr(invalid)) {
      expect(invalid.error[0]?.path).toEqual(['1']);
      expect(invalid.error[0]?.message).toContain('100');
    }
  });

  test('should properly track nested paths', () => {
    const validator = tuple([stringValidator, numberValidator]);
    const result = validator(['valid', 'invalid'], ['parent', 'field']);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error[0]?.path).toEqual(['parent', 'field', '1']);
    }
  });

  test('should handle empty tuple', () => {
    const validator = tuple([]);
    const result = validator([]);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual([]);
    }
  });

  test('should work in object schemas', () => {
    const schema = object({
      id: required(string()),
      coordinates: required(tuple([number(), number()])),
    });

    const valid = schema({ id: 'point1', coordinates: [10.5, 20.3] });
    expect(isOk(valid)).toBe(true);

    const invalid = schema({ id: 'point1', coordinates: [10.5, 'wrong'] });
    expect(isErr(invalid)).toBe(true);
    if (isErr(invalid)) {
      expect(invalid.error[0]?.path).toEqual(['coordinates', '1']);
    }
  });

  test('should infer correct types', () => {
    const schema = tuple([string(), number(), boolean()]);
    type Inferred = InferSchemaType<typeof schema>;

    // Type test - this will fail at compile time if types are wrong
    const result = schema(['test', 42, true]);
    if (isOk(result)) {
      const _typeTest: Inferred = result.value;
      expect(_typeTest).toEqual(['test', 42, true]);
    }
  });
});

describe('tupleOf - homogeneous tuple validator', () => {
  const numberValidator: Validator<unknown, number> = (value, path = []) => {
    if (typeof value !== 'number') {
      const error: ValidationError = { path, message: 'Expected a number' };
      return err([error]);
    }
    return ok(value);
  };

  test('should validate a valid homogeneous tuple of length 1', () => {
    const validator = tupleOf(numberValidator, 1);
    const result = validator([42]);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual([42]);
    }
  });

  test('should validate a valid homogeneous tuple of length 3', () => {
    const validator = tupleOf(numberValidator, 3);
    const result = validator([1, 2, 3]);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual([1, 2, 3]);
    }
  });

  test('should validate a valid homogeneous tuple of length 10', () => {
    const validator = tupleOf(numberValidator, 10);
    const result = validator([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    }
  });

  test('should reject non-array values', () => {
    const validator = tupleOf(numberValidator, 3);
    const invalidInputs = [null, 42, 'string', true, undefined, {}];

    for (const input of invalidInputs) {
      const result = validator(input);
      expect(isErr(result)).toBe(true);

      if (isErr(result)) {
        const error = result.error[0] || { path: [], message: '' };
        expect(error.message).toBe('Expected an array');
      }
    }
  });

  test('should reject arrays with incorrect length', () => {
    const validator = tupleOf(numberValidator, 3);

    // Too few elements
    const tooShort = validator([1, 2]);
    expect(isErr(tooShort)).toBe(true);
    if (isErr(tooShort)) {
      expect(tooShort.error[0]?.message).toBe('Expected tuple of length 3, got 2');
    }

    // Too many elements
    const tooLong = validator([1, 2, 3, 4]);
    expect(isErr(tooLong)).toBe(true);
    if (isErr(tooLong)) {
      expect(tooLong.error[0]?.message).toBe('Expected tuple of length 3, got 4');
    }
  });

  test('should validate each element', () => {
    const validator = tupleOf(numberValidator, 3);

    // One invalid element
    const result1 = validator([1, 'wrong', 3]);
    expect(isErr(result1)).toBe(true);
    if (isErr(result1)) {
      expect(result1.error[0]?.path).toEqual(['1']);
      expect(result1.error[0]?.message).toBe('Expected a number');
    }
  });

  test('should accumulate multiple validation errors', () => {
    const validator = tupleOf(numberValidator, 3);
    const result = validator(['a', 'b', 'c']);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error).toHaveLength(3);
      expect(result.error[0]?.path).toEqual(['0']);
      expect(result.error[1]?.path).toEqual(['1']);
      expect(result.error[2]?.path).toEqual(['2']);
    }
  });

  test('should work with chain() for refined validation - Vector3', () => {
    const MAX = 1_000_000_000;
    const vector3Validator = tupleOf(chain(number(), min(-MAX), max(MAX)), 3);

    const valid = vector3Validator([100, -200, 300]);
    expect(isOk(valid)).toBe(true);

    const invalid = vector3Validator([100, 2_000_000_000, 300]);
    expect(isErr(invalid)).toBe(true);
    if (isErr(invalid)) {
      expect(invalid.error[0]?.path).toEqual(['1']);
      expect(invalid.error[0]?.message).toContain('1000000000');
    }
  });

  test('should work with chain() for refined validation - RGB', () => {
    const rgbValidator = tupleOf(chain(number(), integer(), min(0), max(255)), 3);

    const valid = rgbValidator([255, 128, 64]);
    expect(isOk(valid)).toBe(true);

    const invalid = rgbValidator([255, 300, 64]);
    expect(isErr(invalid)).toBe(true);
    if (isErr(invalid)) {
      expect(invalid.error[0]?.path).toEqual(['1']);
      expect(invalid.error[0]?.message).toContain('255');
    }
  });

  test('should properly track nested paths', () => {
    const validator = tupleOf(numberValidator, 2);
    const result = validator([1, 'invalid'], ['parent', 'field']);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error[0]?.path).toEqual(['parent', 'field', '1']);
    }
  });

  test('should work in object schemas - 3D position/velocity', () => {
    const vector3Schema = tupleOf(number(), 3);
    const schema = object({
      position: required(vector3Schema),
      velocity: required(vector3Schema),
    });

    const valid = schema({
      position: [100, 200, 300],
      velocity: [1.5, -2.3, 0.5],
    });
    expect(isOk(valid)).toBe(true);

    const invalid = schema({
      position: [100, 200], // Wrong length
      velocity: [1.5, -2.3, 0.5],
    });
    expect(isErr(invalid)).toBe(true);
    if (isErr(invalid)) {
      expect(invalid.error[0]?.path).toEqual(['position']);
      expect(invalid.error[0]?.message).toBe('Expected tuple of length 3, got 2');
    }
  });

  test('should infer correct types for different lengths', () => {
    const tuple2 = tupleOf(number(), 2);
    const tuple3 = tupleOf(number(), 3);
    const tuple10 = tupleOf(number(), 10);

    type Tuple2 = InferSchemaType<typeof tuple2>;
    type Tuple3 = InferSchemaType<typeof tuple3>;
    type Tuple10 = InferSchemaType<typeof tuple10>;

    // Type tests - will fail at compile time if types are wrong
    const result2 = tuple2([1, 2]);
    if (isOk(result2)) {
      const _typeTest: Tuple2 = result2.value;
      expect(_typeTest.length).toBe(2);
    }

    const result3 = tuple3([1, 2, 3]);
    if (isOk(result3)) {
      const _typeTest: Tuple3 = result3.value;
      expect(_typeTest.length).toBe(3);
    }

    const result10 = tuple10([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    if (isOk(result10)) {
      const _typeTest: Tuple10 = result10.value;
      expect(_typeTest.length).toBe(10);
    }
  });

  test('should handle edge case - length 0 (empty tuple)', () => {
    const validator = tupleOf(numberValidator, 0);
    const result = validator([]);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual([]);
    }
  });

  test('should work with complex nested schemas', () => {
    const positionSchema = tupleOf(number(), 3);
    const velocitySchema = tupleOf(number(), 3);
    const rgbSchema = tupleOf(chain(number(), integer(), min(0), max(255)), 3);

    const complexSchema = object({
      id: required(string()),
      position: required(positionSchema),
      velocity: required(velocitySchema),
      color: required(rgbSchema),
    });

    type Complex = InferSchemaType<typeof complexSchema>;

    const valid = complexSchema({
      id: 'spacecraft-1',
      position: [100, 200, 300],
      velocity: [1.5, -2.3, 0.5],
      color: [255, 128, 64],
    });

    expect(isOk(valid)).toBe(true);
    if (isOk(valid)) {
      const _typeTest: Complex = valid.value;
      expect(_typeTest.id).toBe('spacecraft-1');
      expect(_typeTest.position).toEqual([100, 200, 300]);
      expect(_typeTest.velocity).toEqual([1.5, -2.3, 0.5]);
      expect(_typeTest.color).toEqual([255, 128, 64]);
    }
  });
});

describe('tuple type inference with InferSchemaType', () => {
  test('should infer heterogeneous tuple types correctly', () => {
    const schema = tuple([string(), number(), boolean()]);
    type Inferred = InferSchemaType<typeof schema>;

    // Type-level test: These assignments should not cause TypeScript errors
    const result = schema(['test', 42, true]);
    if (isOk(result)) {
      const typedValue: Inferred = result.value;
      expect(typedValue[0]).toBe('test'); // string
      expect(typedValue[1]).toBe(42); // number
      expect(typedValue[2]).toBe(true); // boolean
    }
  });

  test('should infer homogeneous tuple types correctly', () => {
    const schema = tupleOf(number(), 3);
    type Inferred = InferSchemaType<typeof schema>;

    const result = schema([1, 2, 3]);
    if (isOk(result)) {
      const typedValue: Inferred = result.value;
      expect(typedValue).toEqual([1, 2, 3]);
      expect(typedValue.length).toBe(3);
    }
  });

  test('should infer nested tuple types in objects', () => {
    const schema = object({
      position: required(tupleOf(number(), 3)),
      metadata: required(tuple([string(), number()])),
    });

    type Inferred = InferSchemaType<typeof schema>;

    const result = schema({
      position: [1, 2, 3],
      metadata: ['label', 42],
    });

    if (isOk(result)) {
      const typedValue: Inferred = result.value;
      expect(typedValue.position).toEqual([1, 2, 3]);
      expect(typedValue.metadata).toEqual(['label', 42]);
    }
  });
});
