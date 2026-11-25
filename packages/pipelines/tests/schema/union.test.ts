import { describe, test, expect } from 'bun:test';

import { isErr, isOk, ok, err } from '@/result';
import { union, discriminatedUnion, object, required, type Validator, type MaybeAsyncValidator } from '@/schema';

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

  test('collectAllErrors: false reports every error of the first validator and none of the rest', () => {
    const twoErrors: Validator<unknown, string> = () =>
      err([
        { path: ['a'], message: 'First' },
        { path: ['b'], message: 'Second' },
      ]);
    const validator = union([twoErrors, numberValidator], { collectAllErrors: false });

    expect(validator({})).toEqual(
      err([
        { path: ['a'], message: 'First' },
        { path: ['b'], message: 'Second' },
      ]),
    );
  });

  test('collectAllErrors: false still accepts a value a later validator accepts', () => {
    const validator = union([stringValidator, numberValidator, booleanValidator], { collectAllErrors: false });

    expect(validator(42)).toEqual(ok(42));
    expect(validator(true)).toEqual(ok(true));
  });

  describe('an error with a cause', () => {
    const explained: Validator<unknown, string> = (_value, path = []) =>
      err([{ path, message: 'Not a known code', cause: [{ path: ['code'], message: 'Unknown prefix' }] }]);

    test('keeps its cause when the union fails', () => {
      const validator = union([explained, numberValidator]);

      expect(validator(true)).toEqual(
        err([
          { path: [], message: 'Not a known code', cause: [{ path: ['code'], message: 'Unknown prefix' }] },
          { path: [], message: 'Expected a number' },
        ]),
      );
    });

    test('keeps its cause when errorPrefix changes its message', () => {
      const validator = union([explained, numberValidator], { errorPrefix: 'Code' });

      expect(validator(true)).toEqual(
        err([
          { path: [], message: 'Code: Not a known code', cause: [{ path: ['code'], message: 'Unknown prefix' }] },
          { path: [], message: 'Code: Expected a number' },
        ]),
      );
    });
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

  test('errorPrefix goes before the error of a union with no validators', () => {
    const validator = union([], { errorPrefix: 'Code' });

    expect(validator('anything')).toEqual(err([{ path: [], message: 'Code: No validators provided to union' }]));
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

describe('union async validator', () => {
  const asyncStringValidator: MaybeAsyncValidator<unknown, string> = async (value) => {
    if (typeof value !== 'string') {
      return err([{ path: [], message: 'Expected a string (async)' }]);
    }
    return ok(value);
  };

  const asyncNumberValidator: MaybeAsyncValidator<unknown, number> = async (value) => {
    if (typeof value !== 'number') {
      return err([{ path: [], message: 'Expected a number (async)' }]);
    }
    return ok(value);
  };

  test('async validator succeeds (first match)', async () => {
    const validator = union([asyncStringValidator, asyncNumberValidator]);
    const result = await validator('hello');

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBe('hello');
    }
  });

  test('all async validators fail — collects errors', async () => {
    const validator = union([asyncStringValidator, asyncNumberValidator]);
    const result = await validator({});

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.length).toBe(2);
      expect(result.error[0]!.message).toBe('Expected a string (async)');
      expect(result.error[1]!.message).toBe('Expected a number (async)');
    }
  });

  test('mixed sync/async — sync tried first, falls through to async', async () => {
    const validator = union([stringValidator, asyncNumberValidator]);
    const result = await validator(42);

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBe(42);
    }
  });

  test('mixed sync/async — sync succeeds, returns sync Result (not Promise)', () => {
    const validator = union([stringValidator, asyncNumberValidator]);
    const result = validator('hello');

    // Sync validator matched first, so result is NOT a Promise
    expect(result instanceof Promise).toBe(false);
    // MaybeAsyncValidator return type includes Promise, but we verified it's sync above
    expect(isOk(result as Awaited<typeof result>)).toBe(true);
  });

  test('all sync validators — returns Result, NOT Promise', () => {
    const validator = union([stringValidator, numberValidator]);
    const result = validator('hello');

    expect(result instanceof Promise).toBe(false);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBe('hello');
    }
  });

  describe.each<[string, Array<MaybeAsyncValidator<unknown, unknown>>, string]>([
    ['async first', [asyncStringValidator, asyncNumberValidator, booleanValidator], 'Expected a string (async)'],
    ['sync then async', [stringValidator, asyncNumberValidator, booleanValidator], 'Expected a string'],
  ])('collectAllErrors: false, %s', (_chain, validators, firstMessage) => {
    const validator = union(validators, { collectAllErrors: false });

    test('still accepts a value a later validator accepts', async () => {
      expect(await validator(42)).toEqual(ok(42));
      expect(await validator(true)).toEqual(ok(true));
    });

    test('reports only the first validator errors', async () => {
      expect(await validator({})).toEqual(err([{ path: [], message: firstMessage }]));
    });
  });

  test('errorPrefix with async errors', async () => {
    const validator = union([asyncStringValidator], { errorPrefix: 'Async union' });
    const result = await validator(42);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error[0]!.message).toBe('Async union: Expected a string (async)');
    }
  });

  test('async validators maintain path information', async () => {
    const pathAwareAsync: MaybeAsyncValidator<unknown, string> = async (value, path = []) => {
      if (typeof value !== 'string') {
        return err([{ path, message: 'Expected a string' }]);
      }
      return ok(value);
    };

    const validator = union([pathAwareAsync]);
    const result = await validator(42, ['field']);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error[0]!.path).toEqual(['field']);
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
    const validator = discriminatedUnion('type', {
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
    const validator = discriminatedUnion('type', {
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
    const validator = discriminatedUnion('type', {
      text: textSchema,
      image: imageSchema,
    });

    const result = validator({ content: 'No type field' });

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error[0]?.message || '').toContain('Missing or invalid discriminant field');
    }
  });

  test('should fail with a discriminant the input inherits', () => {
    const validator = discriminatedUnion('type', {
      text: textSchema,
      image: imageSchema,
    });

    const result = validator(Object.create({ type: 'text', content: 'Hello' }));

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error[0]?.message || '').toContain('Missing or invalid discriminant field');
    }
  });

  test.each(['constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__'])(
    'should fail with discriminant value %p, an Object.prototype member',
    (name) => {
      const validator = discriminatedUnion('type', {
        text: textSchema,
        image: imageSchema,
      });

      // Shaped like an ok Result, so a lookup that reaches Object.prototype would pass it through as valid
      const result = validator({ type: name, ok: true, value: { evil: 1 } });

      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toEqual([{ path: ['type'], message: `Invalid discriminant value for 'type': '${name}'` }]);
      }
    },
  );

  test('should fail with non-object value', () => {
    const validator = discriminatedUnion('type', {
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
    const validator = discriminatedUnion(
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
    const validator = discriminatedUnion('type', {
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
