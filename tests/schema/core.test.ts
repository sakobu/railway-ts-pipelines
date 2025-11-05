import { describe, test, expect } from 'bun:test';

import { isErr, isOk, ok, err } from '@/result';
import { array } from '@/schema/array';
import {
  object,
  required,
  optional,
  nullable,
  emptyAsOptional,
  literal,
  type Validator,
  type ValidationError,
} from '@/schema/core';
import { string } from '@/schema/string';

describe('core - object validator', () => {
  const stringValidator: Validator<unknown, string> = (value) => {
    if (typeof value !== 'string') {
      return err([{ path: [], message: 'Expected a string' }]);
    }
    return ok(value);
  };

  const numberValidator: Validator<unknown, number> = (value) => {
    if (typeof value !== 'number') {
      const error: ValidationError = { path: [], message: 'Expected a number' };
      return err([error]);
    }
    return ok(value);
  };

  test('should validate a valid object', () => {
    const schema = object({
      name: stringValidator,
      age: numberValidator,
    });

    const input = { name: 'John', age: 30 };
    const result = schema(input);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual(input);
    }
  });

  test('should reject non-object values', () => {
    const schema = object({
      name: stringValidator,
    });

    const invalidInputs = [null, 42, 'string', true, undefined];

    for (const input of invalidInputs) {
      const result = schema(input);
      expect(isErr(result)).toBe(true);

      if (isErr(result)) {
        expect(result.error[0]?.message || '').toContain('Expected an object');
      }
    }
  });

  test('should reject invalid field values', () => {
    const schema = object({
      name: stringValidator,
      age: numberValidator,
    });

    const input = { name: 123, age: 'thirty' };
    const result = schema(input);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.length).toBe(2);
    }
  });

  test('should reject extra fields in strict mode', () => {
    const schema = object(
      {
        name: stringValidator,
      },
      { strict: true },
    );

    const input = { name: 'John', extra: 'field' };
    const result = schema(input);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error[0]?.message || '').toContain('Unexpected field');
    }
  });

  test('should allow extra fields in non-strict mode', () => {
    const schema = object(
      {
        name: stringValidator,
      },
      { strict: false },
    );

    const input = { name: 'John', extra: 'field' };
    const result = schema(input);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual({ name: 'John' });
    }
  });

  test('should use default strict=true when options not provided', () => {
    const schema = object({
      name: stringValidator,
    });

    const input = { name: 'John', extra: 'field' };
    const result = schema(input);

    expect(isErr(result)).toBe(true);
  });

  test('should maintain path information', () => {
    const nestedSchema = object({
      name: (value, path = []) => {
        if (typeof value !== 'string') {
          const error: ValidationError = { path, message: 'Expected a string' };
          return err([error]);
        }
        return ok(value);
      },
    });

    const middleSchema = object({
      details: nestedSchema,
    });

    const schema = object({
      user: middleSchema,
    });

    const input = { user: { details: { name: 123 } } };
    const result = schema(input);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      const error = result.error[0] || { path: [], message: '' };
      expect(error.path).toEqual(['user', 'details', 'name']);
    }
  });
});

describe('core - required validator', () => {
  const stringValidator: Validator<unknown, string> = (value) => {
    if (typeof value !== 'string') {
      const error: ValidationError = { path: [], message: 'Expected a string' };
      return err([error]);
    }
    return ok(value);
  };

  test('should pass through valid values', () => {
    const validator = required(stringValidator);
    const result = validator('test');

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBe('test');
    }
  });

  test('should reject undefined values', () => {
    const validator = required(stringValidator);
    const result = validator(undefined);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error[0]?.message || '').toBe('Field is required');
    }
  });

  test('should reject null values', () => {
    const validator = required(stringValidator);
    const result = validator(null);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error[0]?.message || '').toBe('Field is required');
    }
  });

  test('should use custom error message', () => {
    const customMessage = 'This field cannot be empty';
    const validator = required(stringValidator, customMessage);
    const result = validator(undefined);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error[0]?.message || '').toBe(customMessage);
    }
  });

  test('should maintain path information', () => {
    const validator = required(stringValidator);
    const result = validator(undefined, ['user', 'name']);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      const error = result.error[0] || { path: [], message: '' };
      expect(error.path).toEqual(['user', 'name']);
    }
  });
});

describe('core - optional validator', () => {
  const stringValidator: Validator<unknown, string> = (value) => {
    if (typeof value !== 'string') {
      const error: ValidationError = { path: [], message: 'Expected a string' };
      return err([error]);
    }
    return ok(value);
  };

  test('should pass through valid values', () => {
    const validator = optional(stringValidator);
    const result = validator('test');

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBe('test');
    }
  });

  test('should return undefined for undefined values', () => {
    const validator = optional(stringValidator);
    const result = validator(undefined);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBeUndefined();
    }
  });

  test('should return undefined for null values', () => {
    const validator = optional(stringValidator);
    const result = validator(null);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBeUndefined();
    }
  });

  test('should validate non-null/undefined values', () => {
    const validator = optional(stringValidator);
    const result = validator(123);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      const error = result.error[0] || { path: [], message: '' };
      expect(error.message).toBe('Expected a string');
    }
  });

  test('should maintain path information', () => {
    // Define a validator that properly handles path parameter
    const pathAwareValidator: Validator<unknown, string> = (value, path = []) => {
      if (typeof value !== 'string') {
        const error: ValidationError = { path, message: 'Expected a string' };
        return err([error]);
      }
      return ok(value);
    };

    const validator = optional(pathAwareValidator);
    const result = validator(123, ['user', 'name']);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      const error = result.error[0] || { path: [], message: '' };
      expect(error.path).toEqual(['user', 'name']);
    }
  });
});

describe('core - nullable validator', () => {
  test('should accept null values', () => {
    const validator = nullable();
    const result = validator(null);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBeNull();
    }
  });

  test('should reject non-null values', () => {
    const validator = nullable();
    const invalidInputs = [undefined, 42, 'string', true, [], {}, 0, false, ''];

    for (const input of invalidInputs) {
      const result = validator(input);
      expect(isErr(result)).toBe(true);

      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe('Must be null');
      }
    }
  });

  test('should use custom error message', () => {
    const customMessage = 'Value must be explicitly null';
    const validator = nullable(customMessage);
    const result = validator('not null');

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error[0]?.message || '').toBe(customMessage);
    }
  });

  test('should maintain path information', () => {
    const validator = nullable();
    const result = validator('not null', ['config', 'resetToken']);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      const error = result.error[0] || { path: [], message: '' };
      expect(error.path).toEqual(['config', 'resetToken']);
    }
  });

  test('should work in object schemas', () => {
    const schema = object({
      deletedAt: nullable(),
      resetToken: nullable('Reset token must be null when not in use'),
    });

    const validInput = { deletedAt: null, resetToken: null };
    const result = schema(validInput);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.deletedAt).toBeNull();
      expect(result.value.resetToken).toBeNull();
    }

    const invalidInput = { deletedAt: undefined, resetToken: 'some-token' };
    const invalidResult = schema(invalidInput);

    expect(isErr(invalidResult)).toBe(true);
    if (isErr(invalidResult)) {
      expect(invalidResult.error.length).toBe(2);
    }
  });
});

describe('core - emptyAsOptional validator', () => {
  test('should treat empty string as undefined', () => {
    const validator = emptyAsOptional(string());
    const result = validator('');

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBeUndefined();
    }
  });

  test('should treat empty array as undefined', () => {
    const validator = emptyAsOptional(array(string()));
    const result = validator([]);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBeUndefined();
    }
  });

  test('should treat empty object as undefined', () => {
    const addressSchema = object({
      street: required(string()),
      city: required(string()),
    });

    const validator = emptyAsOptional(addressSchema);
    const result = validator({});

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBeUndefined();
    }
  });

  test('should pass through non-empty values', () => {
    const validator = emptyAsOptional(string());

    const result1 = validator('hello');
    expect(isOk(result1)).toBe(true);
    if (isOk(result1)) {
      expect(result1.value).toBe('hello');
    }

    const arrayValidator = emptyAsOptional(array(string()));
    const result2 = arrayValidator(['item1', 'item2']);
    expect(isOk(result2)).toBe(true);
    if (isOk(result2)) {
      expect(result2.value).toEqual(['item1', 'item2']);
    }

    const objValidator = emptyAsOptional(object({ name: required(string()) }));
    const result3 = objValidator({ name: 'John' });
    expect(isOk(result3)).toBe(true);
    if (isOk(result3)) {
      expect(result3.value).toEqual({ name: 'John' });
    }
  });

  test('should treat null as undefined', () => {
    const validator = emptyAsOptional(string());
    const result = validator(null);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBeUndefined();
    }
  });

  test('should treat undefined as undefined', () => {
    const validator = emptyAsOptional(string());
    const result = validator(undefined);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBeUndefined();
    }
  });

  test('should validate non-empty values according to underlying validator', () => {
    const validator = emptyAsOptional(string());
    const result = validator(123); // Invalid: not a string

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error[0]?.message || '').toBe('Must be a string');
    }
  });

  test('should maintain path information', () => {
    const validator = emptyAsOptional(string());
    const result = validator(123, ['user', 'bio']);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      const error = result.error[0] || { path: [], message: '' };
      expect(error.path).toEqual(['user', 'bio']);
    }
  });

  test('should work in object schemas', () => {
    const schema = object({
      username: required(string()),
      bio: emptyAsOptional(string()),
      tags: emptyAsOptional(array(string())),
      address: emptyAsOptional(
        object({
          street: required(string()),
          city: required(string()),
        }),
      ),
    });

    // Test with all empty values
    const input1 = {
      username: 'john',
      bio: '',
      tags: [],
      address: {},
    };
    const result1 = schema(input1);

    expect(isOk(result1)).toBe(true);
    if (isOk(result1)) {
      expect(result1.value).toEqual({
        username: 'john',
        bio: undefined,
        tags: undefined,
        address: undefined,
      });
    }

    // Test with non-empty values
    const input2 = {
      username: 'jane',
      bio: 'My bio',
      tags: ['tag1', 'tag2'],
      address: { street: '123 Main St', city: 'NYC' },
    };
    const result2 = schema(input2);

    expect(isOk(result2)).toBe(true);
    if (isOk(result2)) {
      expect(result2.value).toEqual({
        username: 'jane',
        bio: 'My bio',
        tags: ['tag1', 'tag2'],
        address: { street: '123 Main St', city: 'NYC' },
      });
    }
  });

  test('should distinguish between empty object and object with whitespace-only values', () => {
    const schema = object({
      data: emptyAsOptional(
        object({
          value: required(string()),
        }),
      ),
    });

    // Empty object should become undefined
    const result1 = schema({ data: {} });
    expect(isOk(result1)).toBe(true);
    if (isOk(result1)) {
      expect(result1.value.data).toBeUndefined();
    }

    // Object with properties should be validated normally
    const result2 = schema({ data: { value: '   ' } }); // Whitespace is not empty for the field itself
    expect(isOk(result2)).toBe(true);
    if (isOk(result2)) {
      expect(result2.value.data).toEqual({ value: '   ' });
    }
  });
});

describe('core - literal validator', () => {
  test('should validate exact string matches', () => {
    const validator = literal('active');

    // Valid case
    const validResult = validator('active');
    expect(isOk(validResult)).toBe(true);
    if (isOk(validResult)) {
      expect(validResult.value).toBe('active');
    }

    // Invalid cases
    const invalidInputs = ['Active', 'ACTIVE', 'inactive', '', ' active', 'active ', 123, true, null, undefined];
    for (const input of invalidInputs) {
      const result = validator(input);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe("Value must be 'active'");
      }
    }
  });

  test('should validate exact number matches', () => {
    const validator = literal(42);

    // Valid case
    const validResult = validator(42);
    expect(isOk(validResult)).toBe(true);
    if (isOk(validResult)) {
      expect(validResult.value).toBe(42);
    }

    // Invalid cases
    const invalidInputs = [41, 43, '42', 42.0001, -42, null, undefined];
    for (const input of invalidInputs) {
      const result = validator(input);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe("Value must be '42'");
      }
    }
  });

  test('should validate exact boolean matches', () => {
    const validator = literal(true);

    // Valid case
    const validResult = validator(true);
    expect(isOk(validResult)).toBe(true);
    if (isOk(validResult)) {
      expect(validResult.value).toBe(true);
    }

    // Invalid cases
    const invalidInputs = [false, 'true', 1, 0, null, undefined];
    for (const input of invalidInputs) {
      const result = validator(input);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe("Value must be 'true'");
      }
    }
  });

  test('should validate null literal', () => {
    const validator = literal(null);

    // Valid case
    const validResult = validator(null);
    expect(isOk(validResult)).toBe(true);
    if (isOk(validResult)) {
      expect(validResult.value).toBeNull();
    }

    // Invalid cases
    const invalidInputs = [undefined, 'null', 0, false, ''];
    for (const input of invalidInputs) {
      const result = validator(input);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe("Value must be 'null'");
      }
    }
  });

  test('should validate undefined literal', () => {
    const validator = literal(undefined);

    // Valid case
    const validResult = validator(undefined);
    expect(isOk(validResult)).toBe(true);
    if (isOk(validResult)) {
      expect(validResult.value).toBeUndefined();
    }

    // Invalid cases
    const invalidInputs = [null, 'undefined', 0, false, ''];
    for (const input of invalidInputs) {
      const result = validator(input);
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error[0]?.message || '').toBe("Value must be 'undefined'");
      }
    }
  });

  test('should allow custom error message', () => {
    const customMessage = "Status must be 'pending'";
    const validator = literal('pending', customMessage);

    const result = validator('completed');
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error[0]?.message || '').toBe(customMessage);
    }
  });

  test('should include path in error', () => {
    const validator = literal('admin');
    const path = ['user', 'role'];

    const result = validator('user', path);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error[0]?.path || []).toEqual(path);
    }
  });

  test('should work with discriminated unions', () => {
    // Simulating discriminated union usage
    const typeValidators = {
      text: literal('text'),
      image: literal('image'),
      video: literal('video'),
    };

    // Test each type
    expect(isOk(typeValidators.text('text'))).toBe(true);
    expect(isOk(typeValidators.image('image'))).toBe(true);
    expect(isOk(typeValidators.video('video'))).toBe(true);

    // Cross-check that they reject other values
    expect(isErr(typeValidators.text('image'))).toBe(true);
    expect(isErr(typeValidators.image('video'))).toBe(true);
    expect(isErr(typeValidators.video('text'))).toBe(true);
  });

  test('should handle empty string literal', () => {
    const validator = literal('');

    // Valid case
    const validResult = validator('');
    expect(isOk(validResult)).toBe(true);
    if (isOk(validResult)) {
      expect(validResult.value).toBe('');
    }

    // Invalid cases
    const invalidInputs = [' ', '  ', null, undefined, 0];
    for (const input of invalidInputs) {
      const result = validator(input);
      expect(isErr(result)).toBe(true);
    }
  });

  test('should handle zero literal', () => {
    const validator = literal(0);

    // Valid case
    const validResult = validator(0);
    expect(isOk(validResult)).toBe(true);
    if (isOk(validResult)) {
      expect(validResult.value).toBe(0);
    }

    // Invalid cases
    const invalidInputs = [false, '0', null, undefined, ''];
    for (const input of invalidInputs) {
      const result = validator(input);
      expect(isErr(result)).toBe(true);
    }
  });
});
