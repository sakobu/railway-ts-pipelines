import { describe, test, expect } from 'bun:test';

import { union, discriminatedUnion, withCommonFields, object, required, type Validator } from '@/index';
import { isErr, isOk, ok, err } from '@/result';

const stringValidator: Validator<unknown, string> = (value) => {
  if (typeof value !== 'string') {
    return err([{ path: [], message: 'Expected a string' }]);
  }
  return ok(value);
};

const numberValidator: Validator<unknown, number> = (value) => {
  if (typeof value !== 'number') {
    return err([{ path: [], message: 'Expected a number' }]);
  }
  return ok(value);
};

const booleanValidator: Validator<unknown, boolean> = (value) => {
  if (typeof value !== 'boolean') {
    return err([{ path: [], message: 'Expected a boolean' }]);
  }
  return ok(value);
};

describe('union validator', () => {
  test('should validate with a single validator', () => {
    const validator = union([stringValidator]);
    const result = validator('test');

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBe('test');
    }
  });

  test('should validate with the first matching validator', () => {
    const validator = union([stringValidator, numberValidator, booleanValidator]);
    const result = validator('test');

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBe('test');
    }
  });

  test('should validate with a later validator when earlier ones fail', () => {
    const validator = union([stringValidator, numberValidator, booleanValidator]);
    const result = validator(42);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBe(42);
    }
  });

  test('should fail when all validators fail', () => {
    const validator = union([stringValidator, numberValidator, booleanValidator]);
    const result = validator({});

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.length).toBeGreaterThan(0);
    }
  });

  test('should collect all errors when collectAllErrors is true', () => {
    const validator = union([stringValidator, numberValidator], { collectAllErrors: true });
    const result = validator({});

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.length).toBe(2);
    }
  });

  test('should only collect first error when collectAllErrors is false', () => {
    const validator = union([stringValidator, numberValidator], { collectAllErrors: false });
    const result = validator({});

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.length).toBe(1);
    }
  });

  test('should add error prefix when provided', () => {
    const validator = union([stringValidator], { errorPrefix: 'Union validation failed' });
    const result = validator(42);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error[0]?.message || '').toContain('Union validation failed');
    }
  });

  test('should handle empty validator array', () => {
    const validator = union([], {});
    const result = validator('anything');

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error[0]?.message || '').toContain('No validators provided');
    }
  });

  test('should maintain path information', () => {
    const pathAwareValidator: Validator<unknown, string> = (value, path = []) => {
      if (typeof value !== 'string') {
        return err([{ path, message: 'Expected a string' }]);
      }
      return ok(value);
    };

    const validator = union([pathAwareValidator]);
    const result = validator(42, ['user', 'name']);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      const error = result.error[0] || { path: [], message: '' };
      expect(error.path).toEqual(['user', 'name']);
    }
  });
});

describe('discriminatedUnion validator', () => {
  const textSchema = object({
    type: required(stringValidator),
    content: required(stringValidator),
  });

  const imageSchema = object({
    type: required(stringValidator),
    url: required(stringValidator),
  });

  test('should validate with the correct schema based on discriminant', () => {
    const validator = discriminatedUnion<any>('type', {
      text: textSchema,
      image: imageSchema,
    });

    const textResult = validator({ type: 'text', content: 'Hello' });
    expect(isOk(textResult)).toBe(true);
    if (isOk(textResult)) {
      expect(textResult.value).toEqual({ type: 'text', content: 'Hello' });
    }

    const imageResult = validator({ type: 'image', url: 'http://example.com/img.png' });
    expect(isOk(imageResult)).toBe(true);
    if (isOk(imageResult)) {
      expect(imageResult.value).toEqual({ type: 'image', url: 'http://example.com/img.png' });
    }
  });

  test('should fail with unknown discriminant value', () => {
    const validator = discriminatedUnion<any>('type', {
      text: textSchema,
      image: imageSchema,
    });

    const result = validator({ type: 'video', url: 'http://example.com/video.mp4' });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error[0]?.message || '').toContain('Invalid discriminant value');
    }
  });

  test('should fail with missing discriminant field', () => {
    const validator = discriminatedUnion<any>('type', {
      text: textSchema,
      image: imageSchema,
    });

    const result = validator({ content: 'No type field' });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error[0]?.message || '').toContain('Missing or invalid discriminant field');
    }
  });

  test('should fail with non-object value', () => {
    const validator = discriminatedUnion<any>('type', {
      text: textSchema,
      image: imageSchema,
    });

    const result = validator('not an object');

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error[0]?.message || '').toBe('Expected an object');
    }
  });

  test('should use custom fallback message', () => {
    const customMessage = 'Unknown message type';
    const validator = discriminatedUnion<any>(
      'type',
      {
        text: textSchema,
        image: imageSchema,
      },
      customMessage,
    );

    const result = validator({ type: 'video' });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error[0]?.message || '').toContain(customMessage);
    }
  });

  test('should maintain path information', () => {
    const validator = discriminatedUnion<any>('type', {
      text: textSchema,
      image: imageSchema,
    });

    const result = validator({ type: 'video' }, ['messages', '0']);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      const error = result.error[0] || { path: [], message: '' };
      expect(error.path).toEqual(['messages', '0', 'type']);
    }
  });
});

describe('withCommonFields validator', () => {
  test('should validate both common and specific fields', () => {
    // Create very simple validators for testing that match the actual behavior
    const simpleCommonSchema: Validator<unknown, { id: string }> = (value) => {
      if (typeof value !== 'object' || value === null) {
        return err([{ path: [], message: 'Expected an object' }]);
      }
      const obj = value as Record<string, unknown>;
      if (typeof obj['id'] !== 'string') {
        return err([{ path: [], message: 'Expected id to be a string' }]);
      }
      return ok({ id: obj['id'] as string });
    };

    const simpleSpecificSchema: Validator<unknown, { name: string }> = (value) => {
      if (typeof value !== 'object' || value === null) {
        return err([{ path: [], message: 'Expected an object' }]);
      }
      const obj = value as Record<string, unknown>;
      if (typeof obj['name'] !== 'string') {
        return err([{ path: [], message: 'Expected name to be a string' }]);
      }
      return ok({ name: obj['name'] as string });
    };

    const validator = withCommonFields(simpleCommonSchema, simpleSpecificSchema);
    const input = { id: '123', name: 'John' };

    const result = validator(input);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual({ id: '123', name: 'John' });
    }
  });

  test('should maintain path information', () => {
    // Create very simple validators that handle paths correctly
    const pathAwareCommonSchema: Validator<unknown, { id: string }> = (value, path = []) => {
      if (typeof value !== 'object' || value === null) {
        return err([{ path, message: 'Expected an object' }]);
      }
      const obj = value as Record<string, unknown>;
      if (typeof obj['id'] !== 'string') {
        return err([{ path, message: 'Expected id to be a string' }]);
      }
      return ok({ id: obj['id'] as string });
    };

    const pathAwareSpecificSchema: Validator<unknown, { name: string }> = (value) => {
      if (typeof value !== 'object' || value === null) {
        return err([{ path: [], message: 'Expected an object' }]);
      }
      const obj = value as Record<string, unknown>;
      if (typeof obj['name'] !== 'string') {
        return err([{ path: [], message: 'Expected name to be a string' }]);
      }
      return ok({ name: obj['name'] as string });
    };

    const validator = withCommonFields(pathAwareCommonSchema, pathAwareSpecificSchema);

    const input = { id: 123, name: 'John' }; // id should be a string
    const result = validator(input, ['user', 'data']);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      const error = result.error[0] || { path: [], message: '' };
      expect(error.path).toEqual(['user', 'data']);
    }
  });

  test('should fail when common schema validation fails', () => {
    const failingCommonSchema: Validator<unknown, { id: string }> = (_, path = []) => {
      return err([{ path, message: 'Common schema validation failed' }]);
    };

    const specificSchema: Validator<unknown, { name: string }> = () => {
      return ok({ name: 'test' });
    };

    const validator = withCommonFields(failingCommonSchema, specificSchema);
    const input = { id: '123', name: 'John' };

    const result = validator(input);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error[0]?.message).toBe('Common schema validation failed');
    }
  });

  test('should fail when specific schema validation fails', () => {
    const commonSchema: Validator<unknown, { id: string }> = () => {
      return ok({ id: '123' });
    };

    const failingSpecificSchema: Validator<unknown, { name: string }> = (_, path = []) => {
      return err([{ path, message: 'Specific schema validation failed' }]);
    };

    const validator = withCommonFields(commonSchema, failingSpecificSchema);
    const input = { id: '123', name: 'John' };

    const result = validator(input);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error[0]?.message).toBe('Specific schema validation failed');
    }
  });
});
