import { describe, test, expect } from 'bun:test';

import { isErr, isOk, ok, err } from '@/result';
import { array, oneOf, stringEnum, minItems, maxItems, notEmpty, unique } from '@/schema/array';

import type { Validator, ValidationError } from '@/schema/core';

describe('array - array validator', () => {
  // Sample item validator for testing
  const numberValidator: Validator<unknown, number> = (value) => {
    if (typeof value !== 'number') {
      const error: ValidationError = { path: [], message: 'Expected a number' };
      return err([error]);
    }
    return ok(value);
  };

  test('should pass valid arrays', () => {
    const validator = array(numberValidator);
    const result = validator([1, 2, 3]);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual([1, 2, 3]);
    }
  });

  test('should reject non-array values', () => {
    const validator = array(numberValidator);
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

  test('should validate array items and collect errors', () => {
    // Create a path-aware validator that properly uses the path parameter
    const pathAwareNumberValidator: Validator<unknown, number> = (value, path = []) => {
      if (typeof value !== 'number') {
        const error: ValidationError = { path, message: 'Expected a number' };
        return err([error]);
      }
      return ok(value);
    };

    const validator = array(pathAwareNumberValidator);
    const result = validator([1, 'two', 3, 'four']);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.length).toBe(2); // Two invalid items

      // Check that errors contain the correct paths
      const paths = result.error.map((err) => err.path);
      expect(paths).toContainEqual(['1']); // Index 1 ("two")
      expect(paths).toContainEqual(['3']); // Index 3 ("four")
    }
  });

  test('should maintain parent path in error reports', () => {
    // Create a path-aware validator that properly uses the path parameter
    const pathAwareNumberValidator: Validator<unknown, number> = (value, path = []) => {
      if (typeof value !== 'number') {
        const error: ValidationError = { path, message: 'Expected a number' };
        return err([error]);
      }
      return ok(value);
    };

    const validator = array(pathAwareNumberValidator);
    const result = validator([1, 'two'], ['items']);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      const error = result.error[0] || { path: [], message: '' };
      expect(error.path).toEqual(['items', '1']); // Parent path + index
    }
  });

  test('should transform array items if validator transforms', () => {
    // A validator that doubles numbers
    const doubleNumberValidator: Validator<number, number> = (value) => {
      return ok(value * 2);
    };

    const validator = array(doubleNumberValidator);
    const result = validator([1, 2, 3]);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual([2, 4, 6]);
    }
  });
});

describe('array - oneOf validator', () => {
  test('should pass values included in allowed list', () => {
    const validator = oneOf(['red', 'green', 'blue']);
    const result = validator('green');

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBe('green');
    }
  });

  test('should reject values not in allowed list', () => {
    const validator = oneOf(['red', 'green', 'blue']);
    const result = validator('yellow');

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      const error = result.error[0] || { path: [], message: '' };
      expect(error.message).toContain('Value must be one of');
    }
  });

  test('should accept custom error message', () => {
    const customMessage = 'Invalid color selection';
    const validator = oneOf(['red', 'green', 'blue'], customMessage);
    const result = validator('yellow');

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      const error = result.error[0] || { path: [], message: '' };
      expect(error.message).toBe(customMessage);
    }
  });

  test('should work with non-string values', () => {
    const validator = oneOf([1, 2, 3]);

    // Valid case
    const validResult = validator(2);
    expect(isOk(validResult)).toBe(true);

    // Invalid case
    const invalidResult = validator(4);
    expect(isErr(invalidResult)).toBe(true);
  });

  test('should maintain path information', () => {
    const validator = oneOf(['red', 'green', 'blue']);
    const result = validator('yellow', ['theme', 'color']);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      const error = result.error[0] || { path: [], message: '' };
      expect(error.path).toEqual(['theme', 'color']);
    }
  });
});

describe('array - stringEnum validator', () => {
  test('should pass string values in enum', () => {
    const validator = stringEnum(['admin', 'user', 'guest']);
    const result = validator('admin');

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBe('admin');
    }
  });

  test('should reject non-string values', () => {
    const validator = stringEnum(['admin', 'user', 'guest']);
    const result = validator(123);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      const error = result.error[0] || { path: [], message: '' };
      expect(error.message).toBe('Value must be a string');
    }
  });

  test('should reject string values not in enum', () => {
    const validator = stringEnum(['admin', 'user', 'guest']);
    const result = validator('moderator');

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      const error = result.error[0] || { path: [], message: '' };
      expect(error.message).toContain('Value must be one of');
    }
  });

  test('should accept custom error message', () => {
    const customMessage = 'Invalid role';
    const validator = stringEnum(['admin', 'user', 'guest'], customMessage);
    const result = validator('moderator');

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      const error = result.error[0] || { path: [], message: '' };
      expect(error.message).toBe(customMessage);
    }
  });

  test('should maintain path information', () => {
    const validator = stringEnum(['admin', 'user', 'guest']);
    const result = validator('moderator', ['user', 'role']);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      const error = result.error[0] || { path: [], message: '' };
      expect(error.path).toEqual(['user', 'role']);
    }
  });
});

describe('minItems', () => {
  test('should pass when array has minimum items', () => {
    const validator = minItems(2);
    const result = validator([1, 2, 3]);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual([1, 2, 3]);
    }
  });

  test('should pass when array has exactly minimum items', () => {
    const validator = minItems(3);
    const result = validator([1, 2, 3]);
    expect(isOk(result)).toBe(true);
  });

  test('should fail when array has fewer than minimum items', () => {
    const validator = minItems(3);
    const result = validator([1, 2]);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error[0]?.message || '').toBe('Array must have at least 3 items');
    }
  });

  test('should use custom error message', () => {
    const customMessage = 'Need at least 2 items';
    const validator = minItems(2, customMessage);
    const result = validator([1]);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error[0]?.message || '').toBe(customMessage);
    }
  });

  test('should include path in error', () => {
    const validator = minItems(2);
    const path = ['data', 'items'];
    const result = validator([1], path);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error[0]?.path || []).toEqual(path);
    }
  });
});

describe('maxItems', () => {
  test('should pass when array has maximum items or fewer', () => {
    const validator = maxItems(3);
    const result = validator([1, 2]);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual([1, 2]);
    }
  });

  test('should pass when array has exactly maximum items', () => {
    const validator = maxItems(3);
    const result = validator([1, 2, 3]);
    expect(isOk(result)).toBe(true);
  });

  test('should fail when array has more than maximum items', () => {
    const validator = maxItems(2);
    const result = validator([1, 2, 3]);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error[0]?.message || '').toBe('Array must have at most 2 items');
    }
  });

  test('should use custom error message', () => {
    const customMessage = 'Cannot exceed 3 items';
    const validator = maxItems(3, customMessage);
    const result = validator([1, 2, 3, 4]);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error[0]?.message || '').toBe(customMessage);
    }
  });

  test('should include path in error', () => {
    const validator = maxItems(2);
    const path = ['data', 'items'];
    const result = validator([1, 2, 3], path);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error[0]?.path || []).toEqual(path);
    }
  });
});

describe('notEmpty', () => {
  test('should pass when array is not empty', () => {
    const validator = notEmpty();
    const result = validator([1]);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual([1]);
    }
  });

  test('should pass with multiple items', () => {
    const validator = notEmpty();
    const result = validator([1, 2, 3]);
    expect(isOk(result)).toBe(true);
  });

  test('should fail when array is empty', () => {
    const validator = notEmpty();
    const result = validator([]);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error[0]?.message || '').toBe('Array must not be empty');
    }
  });

  test('should use custom error message', () => {
    const customMessage = 'Please provide at least one item';
    const validator = notEmpty(customMessage);
    const result = validator([]);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error[0]?.message || '').toBe(customMessage);
    }
  });

  test('should include path in error', () => {
    const validator = notEmpty();
    const path = ['data', 'items'];
    const result = validator([], path);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error[0]?.path || []).toEqual(path);
    }
  });
});

describe('unique', () => {
  test('should pass when array has unique primitive values', () => {
    const validator = unique();
    const result = validator([1, 2, 3]);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual([1, 2, 3]);
    }
  });

  test('should pass with strings', () => {
    const validator = unique<string>();
    const result = validator(['a', 'b', 'c']);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual(['a', 'b', 'c']);
    }
  });

  test('should fail when array has duplicate primitive values', () => {
    const validator = unique<number>();
    const result = validator([1, 2, 2, 3]);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error[0]?.message || '').toBe('Array must contain unique values');
      expect(result.error[0]?.path || []).toEqual(['2']); // Third element (index 2) is the duplicate
    }
  });

  test('should fail with duplicate strings', () => {
    const validator = unique<string>();
    const result = validator(['apple', 'banana', 'apple']);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error[0]?.path || []).toEqual(['2']);
    }
  });

  test('should work with custom key extractor for objects', () => {
    const validator = unique<{ id: number; name: string }>('Duplicate ID found', (item) => item.id);

    const validResult = validator([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ]);
    expect(isOk(validResult)).toBe(true);

    const invalidResult = validator([
      { id: 1, name: 'Alice' },
      { id: 1, name: 'Charlie' }, // Same ID
    ]);
    expect(isErr(invalidResult)).toBe(true);
    if (isErr(invalidResult)) {
      expect(invalidResult.error[0]?.message || '').toBe('Duplicate ID found');
      expect(invalidResult.error[0]?.path || []).toEqual(['1']);
    }
  });

  test('should use custom error message', () => {
    const customMessage = 'Values must be unique';
    const validator = unique(customMessage);
    const result = validator([1, 1]);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error[0]?.message || '').toBe(customMessage);
    }
  });

  test('should include parent path in error', () => {
    const validator = unique<number>();
    const path = ['data', 'values'];
    const result = validator([1, 2, 1], path);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error[0]?.path || []).toEqual(['data', 'values', '2']);
    }
  });

  test('should handle empty arrays', () => {
    const validator = unique();
    const result = validator([]);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual([]);
    }
  });

  test('should handle single-element arrays', () => {
    const validator = unique();
    const result = validator([42]);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual([42]);
    }
  });

  test('should detect first duplicate occurrence', () => {
    const validator = unique<number>();
    const result = validator([1, 2, 3, 2, 3]);
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      // Should report index 3 (second occurrence of 2) as the first duplicate
      expect(result.error[0]?.path || []).toEqual(['3']);
    }
  });
});
