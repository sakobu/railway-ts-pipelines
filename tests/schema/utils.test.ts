import { describe, test, expect } from 'bun:test';

import { ok, err, isOk, isErr } from '@/result';
import { object, required, string as stringSchema, number as numberSchema } from '@/schema';
import { chain, validate, formatErrors, transform, refine, refineAt, validateAndFormatResult } from '@/schema/utils';

import type { Validator, ValidationError } from '@/schema/core';

describe('utils - chain', () => {
  // Basic validators for testing
  const stringValidator: Validator<unknown, string> = (value) => {
    if (typeof value !== 'string') {
      const error: ValidationError = { path: [], message: 'Expected a string' };
      return err([error]);
    }
    return ok(value);
  };

  const minLengthValidator =
    (min: number): Validator<string, string> =>
    (value, path = []) => {
      if (value.length < min) {
        const error: ValidationError = { path, message: `Must be at least ${min} characters` };
        return err([error]);
      }
      return ok(value);
    };

  const toUpperCaseValidator: Validator<string, string> = (value) => {
    return ok(value.toUpperCase());
  };

  test('should pass through a valid value with single validator', () => {
    const validator = chain(stringValidator);
    const result = validator('test');

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBe('test');
    }
  });

  test('should handle multiple validators in sequence', () => {
    const validator = chain(stringValidator, minLengthValidator(3), toUpperCaseValidator);

    const result = validator('test');

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBe('TEST');
    }
  });

  test('should fail if first validator fails', () => {
    const validator = chain(stringValidator, minLengthValidator(3), toUpperCaseValidator);

    const result = validator(123);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      const error = result.error[0] || { path: [], message: '' };
      expect(error.message).toBe('Expected a string');
    }
  });

  test('should fail if middle validator fails', () => {
    const validator = chain(stringValidator, minLengthValidator(3), toUpperCaseValidator);

    const result = validator('ab'); // Too short for minLengthValidator

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      const error = result.error[0] || { path: [], message: '' };
      expect(error.message).toBe('Must be at least 3 characters');
    }
  });

  test('should maintain path information', () => {
    const minLengthWithPath =
      (min: number): Validator<string, string> =>
      (value, path = []) => {
        if (value.length < min) {
          const error: ValidationError = { path, message: `Must be at least ${min} characters` };
          return err([error]);
        }
        return ok(value);
      };

    const validator = chain(stringValidator, minLengthWithPath(3));

    const result = validator('ab', ['user', 'name']);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      const error = result.error[0] || { path: [], message: '' };
      expect(error.path).toEqual(['user', 'name']);
    }
  });
});

describe('utils - validate', () => {
  test('should run the validator on the provided value', () => {
    const stringValidator: Validator<unknown, string> = (value) => {
      if (typeof value !== 'string') {
        const error: ValidationError = { path: [], message: 'Expected a string' };
        return err([error]);
      }
      return ok(value);
    };

    // Valid case
    const validResult = validate('test', stringValidator);
    expect(isOk(validResult)).toBe(true);
    if (isOk(validResult)) {
      expect(validResult.value).toBe('test');
    }

    // Invalid case
    const invalidResult = validate(123, stringValidator);
    expect(isErr(invalidResult)).toBe(true);
    if (isErr(invalidResult)) {
      const error = invalidResult.error[0] || { path: [], message: '' };
      expect(error.message).toBe('Expected a string');
    }
  });
});

describe('utils - formatErrors', () => {
  test('should format simple path errors', () => {
    const errors: ValidationError[] = [
      { path: ['name'], message: 'Name is required' },
      { path: ['email'], message: 'Invalid email format' },
    ];

    const formatted = formatErrors(errors);
    expect(formatted).toEqual({
      name: 'Name is required',
      email: 'Invalid email format',
    });
  });

  test('should format nested path errors with dot notation', () => {
    const errors: ValidationError[] = [
      { path: ['user', 'name'], message: 'Name is required' },
      { path: ['user', 'contact', 'email'], message: 'Invalid email format' },
    ];

    const formatted = formatErrors(errors);
    expect(formatted).toEqual({
      'user.name': 'Name is required',
      'user.contact.email': 'Invalid email format',
    });
  });

  test('should format array index paths with bracket notation', () => {
    const errors: ValidationError[] = [
      { path: ['users', '0', 'name'], message: 'Name is required' },
      { path: ['addresses', '1', 'zipCode'], message: 'Invalid zip code' },
    ];

    const formatted = formatErrors(errors);
    expect(formatted).toEqual({
      'users[0].name': 'Name is required',
      'addresses[1].zipCode': 'Invalid zip code',
    });
  });

  test('should handle empty path arrays', () => {
    const errors: ValidationError[] = [{ path: [], message: 'General error' }];

    const formatted = formatErrors(errors);
    expect(formatted).toEqual({
      _root: 'General error',
    });
  });

  test('should handle mixed path types', () => {
    const errors: ValidationError[] = [
      { path: ['users', '0', 'addresses', '1', 'street'], message: 'Street is required' },
      { path: ['config', 'settings', 'notifications'], message: 'Invalid setting' },
    ];

    const formatted = formatErrors(errors);
    expect(formatted).toEqual({
      'users[0].addresses[1].street': 'Street is required',
      'config.settings.notifications': 'Invalid setting',
    });
  });
});

describe('utils - transform', () => {
  test('should transform values successfully', () => {
    const toUpperCase = transform<string, string>((s) => s.toUpperCase());
    const result = toUpperCase('hello');

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBe('HELLO');
    }
  });

  test('should work with type conversions', () => {
    const numberToString = transform<number, string>((n) => n.toString());
    const result = numberToString(42);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBe('42');
    }
  });

  test('should work in chains after validation', () => {
    // Mock string and email validators for testing
    const stringValidator: Validator<unknown, string> = (value) => {
      if (typeof value !== 'string') {
        return err([{ path: [], message: 'Expected a string' }]);
      }
      return ok(value);
    };

    const emailValidator: Validator<string, string> = (value) => {
      if (!value.includes('@')) {
        return err([{ path: [], message: 'Invalid email' }]);
      }
      return ok(value);
    };

    const normalizeEmail = chain(
      stringValidator,
      emailValidator,
      transform((s: string) => s.toLowerCase().trim()),
    );

    const result = normalizeEmail('  USER@EXAMPLE.COM  ');

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBe('user@example.com');
    }
  });

  test('should compose multiple transforms', () => {
    const pipeline = chain(
      transform<string, string>((s) => s.toLowerCase()),
      transform<string, string>((s) => s.replaceAll('-', '_')),
      transform<string, string>((s) => `prefix_${s}`),
    );

    const result = pipeline('Hello-World');

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBe('prefix_hello_world');
    }
  });

  test('should handle object transformations', () => {
    interface Input {
      firstName: string;
      lastName: string;
    }

    interface Output {
      fullName: string;
    }

    const combineNames = transform<Input, Output>((input) => ({
      fullName: `${input.firstName} ${input.lastName}`,
    }));

    const result = combineNames({ firstName: 'John', lastName: 'Doe' });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual({ fullName: 'John Doe' });
    }
  });

  test('should work with array transformations', () => {
    const doubleNumbers = transform<number[], number[]>((nums) => nums.map((n) => n * 2));
    const result = doubleNumbers([1, 2, 3]);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual([2, 4, 6]);
    }
  });
});

describe('utils - refine', () => {
  test('should pass when predicate returns true', () => {
    const isEven = refine<number>((n) => n % 2 === 0, 'Must be even');
    const result = isEven(4);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBe(4);
    }
  });

  test('should fail when predicate returns false', () => {
    const isEven = refine<number>((n) => n % 2 === 0, 'Must be even');
    const result = isEven(3);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error[0]?.message).toBe('Must be even');
    }
  });

  test('should use default message when not provided', () => {
    const isPositive = refine<number>((n) => n > 0);
    const result = isPositive(-5);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error[0]?.message).toBe('Custom validation failed');
    }
  });

  test('should work in chains for multiple refinements', () => {
    // Mock number validator for testing
    const numberValidator: Validator<unknown, number> = (value) => {
      if (typeof value !== 'number') {
        return err([{ path: [], message: 'Expected a number' }]);
      }
      return ok(value);
    };

    const validator = chain(
      numberValidator,
      refine((n: number) => n > 0, 'Must be positive'),
      refine((n: number) => n < 100, 'Must be less than 100'),
      refine((n: number) => n % 2 === 0, 'Must be even'),
    );

    // Test valid value
    const validResult = validator(50);
    expect(isOk(validResult)).toBe(true);
    if (isOk(validResult)) {
      expect(validResult.value).toBe(50);
    }

    // Test negative number (fails first refine)
    const negativeResult = validator(-5);
    expect(isErr(negativeResult)).toBe(true);
    if (isErr(negativeResult)) {
      expect(negativeResult.error[0]?.message).toBe('Must be positive');
    }

    // Test too large (fails second refine)
    const largeResult = validator(150);
    expect(isErr(largeResult)).toBe(true);
    if (isErr(largeResult)) {
      expect(largeResult.error[0]?.message).toBe('Must be less than 100');
    }

    // Test odd number (fails third refine)
    const oddResult = validator(51);
    expect(isErr(oddResult)).toBe(true);
    if (isErr(oddResult)) {
      expect(oddResult.error[0]?.message).toBe('Must be even');
    }
  });

  test('should handle complex business logic', () => {
    const passwordValidator = refine<string>((password) => {
      const hasUpperCase = /[A-Z]/.test(password);
      const hasLowerCase = /[a-z]/.test(password);
      const hasNumber = /[0-9]/.test(password);
      const hasSpecialChar = /[!@#$%^&*]/.test(password);
      return hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar;
    }, 'Password must contain uppercase, lowercase, number, and special character');

    const validPassword = 'Test123!';
    const validResult = passwordValidator(validPassword);
    expect(isOk(validResult)).toBe(true);

    const invalidPassword = 'weak';
    const invalidResult = passwordValidator(invalidPassword);
    expect(isErr(invalidResult)).toBe(true);
  });

  test('should handle object refinements', () => {
    interface DateRange {
      start: Date;
      end: Date;
    }

    const dateRangeValidator = refine<DateRange>(
      ({ start, end }) => start <= end,
      'Start date must be before or equal to end date',
    );

    const validRange: DateRange = {
      start: new Date('2024-01-01'),
      end: new Date('2024-12-31'),
    };
    const validResult = dateRangeValidator(validRange);
    expect(isOk(validResult)).toBe(true);

    const invalidRange: DateRange = {
      start: new Date('2024-12-31'),
      end: new Date('2024-01-01'),
    };
    const invalidResult = dateRangeValidator(invalidRange);
    expect(isErr(invalidResult)).toBe(true);
    if (isErr(invalidResult)) {
      expect(invalidResult.error[0]?.message).toBe('Start date must be before or equal to end date');
    }
  });

  test('should preserve path information', () => {
    const isEven = refine<number>((n) => n % 2 === 0, 'Must be even');
    const result = isEven(3, ['items', '0', 'value']);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error[0]?.path).toEqual(['items', '0', 'value']);
      expect(result.error[0]?.message).toBe('Must be even');
    }
  });
});

describe('utils - refineAt', () => {
  test('should pass when predicate returns true with string path', () => {
    interface Data {
      value: number;
      min: number;
    }
    const validator = refineAt<Data>('value', (data) => data.value >= data.min, 'Value must be at least min');
    const result = validator({ value: 10, min: 5 });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual({ value: 10, min: 5 });
    }
  });

  test('should fail when predicate returns false with string path', () => {
    interface Data {
      value: number;
      min: number;
    }
    const validator = refineAt<Data>('value', (data) => data.value >= data.min, 'Value must be at least min');
    const result = validator({ value: 3, min: 5 });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error[0]?.path).toEqual(['value']);
      expect(result.error[0]?.message).toBe('Value must be at least min');
    }
  });

  test('should work with array path', () => {
    interface Data {
      nested: { field: string };
    }
    const validator = refineAt<Data>(
      ['nested', 'field'],
      (data) => data.nested.field.length > 0,
      'Field cannot be empty',
    );
    const result = validator({ nested: { field: '' } });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error[0]?.path).toEqual(['nested', 'field']);
      expect(result.error[0]?.message).toBe('Field cannot be empty');
    }
  });

  test('should preserve parent path when provided', () => {
    interface Data {
      value: number;
    }
    const validator = refineAt<Data>('value', (data) => data.value > 0, 'Value must be positive');
    const result = validator({ value: -5 }, ['user', 'settings']);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error[0]?.path).toEqual(['user', 'settings', 'value']);
      expect(result.error[0]?.message).toBe('Value must be positive');
    }
  });

  test('should combine parent path with array targetPath', () => {
    interface Data {
      config: { timeout: number };
    }
    const validator = refineAt<Data>(['config', 'timeout'], (data) => data.config.timeout < 1000, 'Timeout too high');
    const result = validator({ config: { timeout: 2000 } }, ['server']);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error[0]?.path).toEqual(['server', 'config', 'timeout']);
      expect(result.error[0]?.message).toBe('Timeout too high');
    }
  });

  test('should work with formatErrors for proper error display', () => {
    interface Data {
      value: number;
      max: number;
    }
    const validator = refineAt<Data>('value', (data) => data.value <= data.max, 'Value must be at most max');
    const result = validator({ value: 100, max: 50 });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      const formatted = formatErrors(result.error);
      expect(formatted).toEqual({
        value: 'Value must be at most max',
      });
    }
  });

  test('should work with nested formatErrors paths', () => {
    interface Data {
      settings: { limit: number };
    }
    const validator = refineAt<Data>(
      ['settings', 'limit'],
      (data) => data.settings.limit > 0,
      'Limit must be positive',
    );
    const result = validator({ settings: { limit: 0 } }, ['config']);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      const formatted = formatErrors(result.error);
      expect(formatted).toEqual({
        'config.settings.limit': 'Limit must be positive',
      });
    }
  });

  test('should handle cross-field validation in object schemas', () => {
    interface RangeData {
      min: number;
      max: number;
    }
    const validator = refineAt<RangeData>('max', (data) => data.max > data.min, 'Max must be greater than min');

    // Valid case
    const validResult = validator({ min: 10, max: 20 });
    expect(isOk(validResult)).toBe(true);

    // Invalid case
    const invalidResult = validator({ min: 20, max: 10 });
    expect(isErr(invalidResult)).toBe(true);
    if (isErr(invalidResult)) {
      expect(invalidResult.error[0]?.path).toEqual(['max']);
      expect(invalidResult.error[0]?.message).toBe('Max must be greater than min');
    }
  });

  test('should work in chains with object validators', () => {
    interface FormData {
      password: string;
      confirmPassword: string;
    }

    const formSchema = chain(
      object({
        password: required(stringSchema()),
        confirmPassword: required(stringSchema()),
      }),
      refineAt<FormData>('confirmPassword', (data) => data.password === data.confirmPassword, 'Passwords must match'),
    );

    // Valid case
    const validData = { password: 'secret123', confirmPassword: 'secret123' };
    const validResult = formSchema(validData);
    expect(isOk(validResult)).toBe(true);

    // Invalid case
    const invalidData = { password: 'secret123', confirmPassword: 'different' };
    const invalidResult = formSchema(invalidData);
    expect(isErr(invalidResult)).toBe(true);
    if (isErr(invalidResult)) {
      expect(invalidResult.error[0]?.path).toEqual(['confirmPassword']);
      expect(invalidResult.error[0]?.message).toBe('Passwords must match');
    }
  });

  test('error path should be an array, not a string', () => {
    interface Data {
      field: string;
    }
    const validator = refineAt<Data>('field', (data) => data.field.length > 0, 'Field required');
    const result = validator({ field: '' });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      const path = result.error[0]?.path;
      // Critical: path must be an array for formatErrors to work
      expect(Array.isArray(path)).toBe(true);
      expect(path).toEqual(['field']);
    }
  });
});

describe('utils - validateAndFormatResult', () => {
  // Create a simple schema for testing
  const userSchema = object({
    name: required(stringSchema()),
    age: required(numberSchema()),
  });

  test('should return valid result for correct input', () => {
    const input = { name: 'John', age: 30 };
    const result = validateAndFormatResult(input, userSchema);

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data).toEqual({ name: 'John', age: 30 });
      expect(result.data.name).toBe('John');
      expect(result.data.age).toBe(30);
    }
  });

  test('should return invalid result with formatted errors for incorrect input', () => {
    const input = { name: 123, age: 'not a number' };
    const result = validateAndFormatResult(input, userSchema);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toBeDefined();
      expect(typeof result.errors).toBe('object');
      // Should have formatted error messages
      expect(Object.keys(result.errors).length).toBeGreaterThan(0);
    }
  });

  test('should format nested path errors correctly', () => {
    const nestedSchema = object({
      user: required(
        object({
          name: required(stringSchema()),
          contact: required(
            object({
              email: required(stringSchema()),
            }),
          ),
        }),
      ),
    });

    const input = { user: { name: 123, contact: { email: 456 } } };
    const result = validateAndFormatResult(input, nestedSchema);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      // Errors should be formatted with dot notation
      expect(result.errors['user.name']).toBeDefined();
      expect(result.errors['user.contact.email']).toBeDefined();
    }
  });

  test('should handle missing required fields', () => {
    const input = { name: 'John' }; // Missing 'age'
    const result = validateAndFormatResult(input, userSchema);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors['age']).toBeDefined();
    }
  });

  test('should work with empty object as input', () => {
    const input = {};
    const result = validateAndFormatResult(input, userSchema);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors['name']).toBeDefined();
      expect(result.errors['age']).toBeDefined();
    }
  });

  test('should maintain type safety for valid results', () => {
    const input = { name: 'Alice', age: 25 };
    const result = validateAndFormatResult(input, userSchema);

    if (result.valid) {
      // TypeScript should know these properties exist
      const name: string = result.data.name;
      const age: number = result.data.age;
      expect(name).toBe('Alice');
      expect(age).toBe(25);
    }
  });

  test('should maintain type safety for invalid results', () => {
    const input = { name: 123, age: 'invalid' };
    const result = validateAndFormatResult(input, userSchema);

    if (!result.valid) {
      // TypeScript should know errors property exists
      const errors: Record<string, string> = result.errors;
      expect(typeof errors).toBe('object');
    }
  });

  test('should handle unknown input type', () => {
    const input: unknown = 'not an object';
    const result = validateAndFormatResult(input, userSchema);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toBeDefined();
    }
  });

  test('should be equivalent to manual validate + match + formatErrors pattern', () => {
    const input = { name: 'Bob', age: 40 };

    // Using the helper
    const helperResult = validateAndFormatResult(input, userSchema);

    // Using manual pattern
    const validationResult = validate(input, userSchema);
    const manualResult = isOk(validationResult)
      ? { valid: true as const, data: validationResult.value }
      : { valid: false as const, errors: formatErrors(validationResult.error) };

    expect(helperResult).toEqual(manualResult);
  });
});
