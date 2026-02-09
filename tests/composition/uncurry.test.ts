import { describe, test, expect } from 'bun:test';

import { curry, uncurry, pipe } from '@/composition';
import {
  some,
  none,
  isSome,
  isNone,
  map as mapOption,
  flatMap as flatMapOption,
  unwrap as unwrapOption,
} from '@/option';
import {
  ok,
  err,
  isOk,
  isErr,
  map as mapResult,
  mapErr as mapErrorResult,
  flatMap as flatMapResult,
  unwrap as unwrapResult,
} from '@/result';

describe('uncurry', () => {
  test('should uncurry a 2-arity curried function', () => {
    const curriedAdd = (a: number) => (b: number) => a + b;
    const add = uncurry(curriedAdd);

    expect(add(5, 3)).toBe(8);
    expect(add(10, -2)).toBe(8);
  });

  test('should uncurry a 3-arity curried function', () => {
    const curriedMultiply = (a: number) => (b: number) => (c: number) => a * b * c;
    const multiply = uncurry(curriedMultiply);

    expect(multiply(2, 3, 4)).toBe(24);
    expect(multiply(1, 5, 10)).toBe(50);
  });

  test('should uncurry a 4-arity curried function', () => {
    const curriedCombine = (a: string) => (b: string) => (c: string) => (d: string) => `${a}-${b}-${c}-${d}`;
    const combine = uncurry(curriedCombine);

    expect(combine('a', 'b', 'c', 'd')).toBe('a-b-c-d');
    expect(combine('hello', 'world', 'foo', 'bar')).toBe('hello-world-foo-bar');
  });

  test('should uncurry a 5-arity curried function', () => {
    const curriedSum = (a: number) => (b: number) => (c: number) => (d: number) => (e: number) => a + b + c + d + e;
    const sum = uncurry(curriedSum);

    expect(sum(1, 2, 3, 4, 5)).toBe(15);
    expect(sum(10, 20, 30, 40, 50)).toBe(150);
  });

  test('should handle functions with different parameter types', () => {
    const curriedFormat = (prefix: string) => (num: number) => (suffix: string) => `${prefix}${num}${suffix}`;
    const format = uncurry(curriedFormat);

    expect(format('$', 100, '.00')).toBe('$100.00');
    expect(format('€', 75, '.50')).toBe('€75.50');
  });

  describe('round-trip with curry', () => {
    test('should work as inverse of curry for 2-arity functions', () => {
      const originalAdd = (a: number, b: number) => a + b;
      const curriedAdd = curry(originalAdd);
      const uncurriedAdd = uncurry(curriedAdd);

      expect(uncurriedAdd(5, 3)).toBe(8);
      expect(uncurriedAdd(5, 3)).toBe(originalAdd(5, 3));
    });

    test('should work as inverse of curry for 3-arity functions', () => {
      const originalMultiply = (a: number, b: number, c: number) => a * b * c;
      const curriedMultiply = curry(originalMultiply);
      const uncurriedMultiply = uncurry(curriedMultiply);

      expect(uncurriedMultiply(2, 3, 4)).toBe(24);
      expect(uncurriedMultiply(2, 3, 4)).toBe(originalMultiply(2, 3, 4));
    });

    test('should work as inverse of curry for 4-arity functions', () => {
      const originalConcat = (a: string, b: string, c: string, d: string) => a + b + c + d;
      const curriedConcat = curry(originalConcat);
      const uncurriedConcat = uncurry(curriedConcat);

      expect(uncurriedConcat('a', 'b', 'c', 'd')).toBe('abcd');
      expect(uncurriedConcat('a', 'b', 'c', 'd')).toBe(originalConcat('a', 'b', 'c', 'd'));
    });

    test('should work as inverse of curry for 5-arity functions', () => {
      const originalSum = (a: number, b: number, c: number, d: number, e: number) => a + b + c + d + e;
      const curriedSum = curry(originalSum);
      const uncurriedSum = uncurry(curriedSum);

      expect(uncurriedSum(1, 2, 3, 4, 5)).toBe(15);
      expect(uncurriedSum(1, 2, 3, 4, 5)).toBe(originalSum(1, 2, 3, 4, 5));
    });
  });

  describe('with pipe integration', () => {
    test('should work seamlessly with pipe for function composition', () => {
      const curriedDivide = (divisor: number) => (dividend: number) => dividend / divisor;
      const divide = uncurry(curriedDivide);

      const result = pipe(
        100,
        (n) => divide(2, n), // Divide 100 by 2
        (n) => n + 1,
      );

      expect(result).toBe(51);
    });

    test('should compose with other uncurried functions', () => {
      const curriedAdd = (a: number) => (b: number) => a + b;
      const curriedMultiply = (a: number) => (b: number) => a * b;
      const curriedSubtract = (a: number) => (b: number) => a - b;

      const add = uncurry(curriedAdd);
      const multiply = uncurry(curriedMultiply);
      const subtract = uncurry(curriedSubtract);

      const result = pipe(
        5,
        (n) => add(n, 3), // 8
        (n) => multiply(n, 2), // 16
        (n) => subtract(n, 6), // 10
      );

      expect(result).toBe(10);
    });
  });

  describe('with Option type', () => {
    test('should work with Option transformations', () => {
      const curriedParseAndScale =
        (radix: number) =>
        (multiplier: number) =>
        (str: string): number => {
          const n = Number.parseInt(str, radix);
          return Number.isNaN(n) ? 0 : n * multiplier;
        };

      const parseAndScale = uncurry(curriedParseAndScale);

      const result = pipe(some('FF'), (o) => mapOption(o, (s) => parseAndScale(16, 2, s)));

      expect(isSome(result)).toBe(true);
      expect(unwrapOption(result)).toBe(510); // FF in hex is 255, times 2 is 510
    });

    test('should handle safe Option transformations with validation', () => {
      const curriedValidateAndTransform = (min: number) => (max: number) => (value: number) => {
        if (value >= min && value <= max) {
          return some(value * 2);
        }
        return none<number>();
      };

      const validateAndTransform = uncurry(curriedValidateAndTransform);

      const validResult = pipe(some(15), (o) => flatMapOption(o, (n) => validateAndTransform(10, 20, n)));

      expect(isSome(validResult)).toBe(true);
      expect(unwrapOption(validResult)).toBe(30);

      const invalidResult = pipe(some(25), (o) => flatMapOption(o, (n) => validateAndTransform(10, 20, n)));

      expect(isNone(invalidResult)).toBe(true);
    });

    test('should handle None values gracefully', () => {
      const curriedAdd = (a: number) => (b: number) => a + b;
      const add = uncurry(curriedAdd);

      const result = pipe(none<number>(), (o) => mapOption(o, (n) => add(n, 5)));

      expect(isNone(result)).toBe(true);
    });

    test('should work with complex Option pipelines', () => {
      const curriedParseWithFallback = (radix: number) => (fallback: number) => (str: string) => {
        const n = Number.parseInt(str, radix);
        return Number.isNaN(n) ? some(fallback) : some(n);
      };

      const parseWithFallback = uncurry(curriedParseWithFallback);

      const validParseResult = pipe(some('42'), (o) => flatMapOption(o, (s) => parseWithFallback(10, 0, s)));

      expect(isSome(validParseResult)).toBe(true);
      expect(unwrapOption(validParseResult)).toBe(42);

      const invalidParseResult = pipe(some('invalid'), (o) => flatMapOption(o, (s) => parseWithFallback(10, -1, s)));

      expect(isSome(invalidParseResult)).toBe(true);
      expect(unwrapOption(invalidParseResult)).toBe(-1);
    });
  });

  describe('with Result type', () => {
    test('should work with Result transformations for validation', () => {
      const curriedValidateRange = (min: number) => (max: number) => (value: number) =>
        value >= min && value <= max ? ok(value) : err(`Value must be between ${min} and ${max}`);

      const validateRange = uncurry(curriedValidateRange);

      const validResult = pipe(
        ok(15),
        (r) => flatMapResult(r, (n) => validateRange(10, 20, n)),
        (r) => mapResult(r, (age) => `Valid value: ${age}`),
      );

      expect(isOk(validResult)).toBe(true);
      expect(unwrapResult(validResult)).toBe('Valid value: 15');

      const invalidResult = pipe(ok(25), (r) => flatMapResult(r, (n) => validateRange(10, 20, n)));

      expect(isErr(invalidResult)).toBe(true);
      expect(() => unwrapResult(invalidResult)).toThrow('Value must be between 10 and 20');
    });

    test('should build validation pipelines with uncurried validators', () => {
      const curriedMinLength = (min: number) => (str: string) =>
        str.length >= min ? ok(str) : err(`Must be at least ${min} characters`);

      const curriedMaxLength = (max: number) => (str: string) =>
        str.length <= max ? ok(str) : err(`Must be at most ${max} characters`);

      const curriedMatches = (pattern: RegExp) => (str: string) =>
        pattern.test(str) ? ok(str) : err(`Must match pattern ${pattern}`);

      const minLength = uncurry(curriedMinLength);
      const maxLength = uncurry(curriedMaxLength);
      const matches = uncurry(curriedMatches);

      // Compose into a username validator
      const validateUsername = (username: string) =>
        pipe(
          ok(username),
          (r) => flatMapResult(r, (s) => minLength(3, s)),
          (r) => flatMapResult(r, (s) => maxLength(20, s)),
          (r) => flatMapResult(r, (s) => matches(/^[a-zA-Z0-9_]+$/, s)),
        );

      const validUsername = validateUsername('john_doe');
      expect(isOk(validUsername)).toBe(true);
      expect(unwrapResult(validUsername)).toBe('john_doe');

      const tooShort = validateUsername('ab');
      expect(isErr(tooShort)).toBe(true);
      expect(() => unwrapResult(tooShort)).toThrow('Must be at least 3 characters');

      const invalidChars = validateUsername('john-doe!');
      expect(isErr(invalidChars)).toBe(true);
      expect(() => unwrapResult(invalidChars)).toThrow('Must match pattern');
    });

    test('should handle error formatting with uncurried functions', () => {
      type ApiError = {
        code: number;
        message: string;
        timestamp: number;
      };

      const curriedFormatError =
        (prefix: string) =>
        (code: number) =>
        (message: string): ApiError => ({
          code,
          message: `${prefix}: ${message}`,
          timestamp: Date.now(),
        });

      const formatError = uncurry(curriedFormatError);

      const result = err('Invalid credentials');

      const formattedResult = pipe(result, (r) => {
        if (isErr(r)) {
          const error = formatError('AUTH', 401, 'Invalid credentials');
          return err(error);
        }
        return r;
      });

      expect(isErr(formattedResult)).toBe(true);

      // Use mapErrorResult to access the error in a type-safe way
      const errorValidation = pipe(formattedResult, (r) =>
        mapErrorResult(r, (apiError: ApiError) => {
          expect(apiError.code).toBe(401);
          expect(apiError.message).toBe('AUTH: Invalid credentials');
          expect(typeof apiError.timestamp).toBe('number');
          return apiError;
        }),
      );

      expect(isErr(errorValidation)).toBe(true);
    });

    test('should handle railway pattern with error short-circuiting', () => {
      const curriedValidateEven = (n: number) => (n % 2 === 0 ? ok(n) : err('Not even'));
      const curriedValidatePositive = (n: number) => (n > 0 ? ok(n) : err('Not positive'));
      const curriedDouble = (a: number) => (b: number) => a * b;

      const validateEven = uncurry(curriedValidateEven);
      const validatePositive = uncurry(curriedValidatePositive);
      const double = uncurry(curriedDouble);

      // This should fail at the first validation
      const result = pipe(
        ok(5), // Odd number
        (r) => flatMapResult(r, validateEven), // Should fail here
        (r) => flatMapResult(r, validatePositive), // Should not run
        (r) => mapResult(r, (n) => double(2, n)), // Should not run
      );

      expect(isErr(result)).toBe(true);
      expect(() => unwrapResult(result)).toThrow('Not even');
    });
  });

  describe('practical use cases', () => {
    test('should work with URL building functions', () => {
      const curriedCreateUrl = (protocol: string) => (domain: string) => (path: string) => (query: string) =>
        `${protocol}://${domain}${path}${query ? `?${query}` : ''}`;

      const createUrl = uncurry(curriedCreateUrl);

      expect(createUrl('https', 'api.example.com', '/users', '')).toBe('https://api.example.com/users');
      expect(createUrl('https', 'api.example.com', '/users', 'limit=10')).toBe(
        'https://api.example.com/users?limit=10',
      );
      expect(createUrl('http', 'localhost', '/posts', 'author=john')).toBe('http://localhost/posts?author=john');
    });

    test('should work with mathematical operations', () => {
      const curriedPower = (base: number) => (exponent: number) => Math.pow(base, exponent);
      const curriedModulo = (divisor: number) => (dividend: number) => dividend % divisor;

      const power = uncurry(curriedPower);
      const modulo = uncurry(curriedModulo);

      expect(power(2, 4)).toBe(16);
      expect(power(3, 3)).toBe(27);
      expect(modulo(2, 8)).toBe(0); // Even number
      expect(modulo(2, 7)).toBe(1); // Odd number
      expect(modulo(5, 15)).toBe(0); // Multiple of 5
      expect(modulo(5, 17)).toBe(2); // Not multiple of 5
    });

    test('should handle string manipulation functions', () => {
      const curriedReplace = (search: string) => (replacement: string) => (str: string) =>
        str.replaceAll(search, replacement);

      const curriedPadStart = (targetLength: number) => (padString: string) => (str: string) =>
        str.padStart(targetLength, padString);

      const replace = uncurry(curriedReplace);
      const padStart = uncurry(curriedPadStart);

      expect(replace(' ', '', 'hello world')).toBe('helloworld');
      expect(padStart(5, '0', '42')).toBe('00042');
      expect(padStart(5, '0', '12345')).toBe('12345');

      // Combine with pipe for text processing
      const result = pipe(
        '  hello world  ',
        (s: string) => s.trim(),
        (s: string) => replace(' ', '', s),
        (s: string) => s.toUpperCase(),
      );

      expect(result).toBe('HELLOWORLD');
    });

    test('should work with configuration builders', () => {
      type Config = {
        host: string;
        port: number;
        path: string;
        secure: boolean;
      };

      const curriedCreateConfig =
        (host: string) =>
        (port: number) =>
        (path: string) =>
        (secure: boolean): Config => ({
          host,
          port,
          path,
          secure,
        });

      const createConfig = uncurry(curriedCreateConfig);

      const config = createConfig('localhost', 3000, '/api', true);
      expect(config).toEqual({
        host: 'localhost',
        port: 3000,
        path: '/api',
        secure: true,
      });
    });
  });

  describe('edge cases', () => {
    test('should handle functions that return functions', () => {
      const curriedCreateAdder = (base: number) => (increment: number) => (value: number) => base + increment + value;
      const createAdder = uncurry(curriedCreateAdder);

      // After uncurrying, we need to provide all 3 arguments at once
      const result = createAdder(10, 5, 3); // base + increment + value = 10 + 5 + 3
      expect(result).toBe(18);
    });

    test('should preserve function context and behavior', () => {
      const curriedCreateFormatter = (prefix: string) => (suffix: string) => (value: string) => {
        return `${prefix}${value}${suffix}`;
      };

      const createFormatter = uncurry(curriedCreateFormatter);

      expect(createFormatter('<b>', '</b>', 'hello')).toBe('<b>hello</b>');
      expect(createFormatter('[', ']', 'test')).toBe('[test]');
    });

    test('should work with complex return types', () => {
      type Result = { success: boolean; data: string; meta: { count: number } };

      const curriedCreateResult =
        (success: boolean) =>
        (data: string) =>
        (count: number): Result => ({
          success,
          data,
          meta: { count },
        });

      const createResult = uncurry(curriedCreateResult);

      const result = createResult(true, 'test data', 42);
      expect(result).toEqual({
        success: true,
        data: 'test data',
        meta: { count: 42 },
      });
    });
  });

  describe('type safety', () => {
    test('should maintain type information through uncurrying', () => {
      const curriedConcat = (a: string) => (b: string) => a + b;
      const concat = uncurry(curriedConcat);

      // The type system should enforce that we can only pass strings
      const result = concat('Hello, ', 'World!');

      expect(result).toBe('Hello, World!');
      expect(typeof result).toBe('string');
    });

    test('should work with complex nested types', () => {
      type User = { name: string; age: number; active: boolean };

      const curriedCreateUser =
        (name: string) =>
        (age: number) =>
        (active: boolean): User => ({
          name,
          age,
          active,
        });

      const createUser = uncurry(curriedCreateUser);

      const user = createUser('John', 30, true);

      expect(user).toEqual({ name: 'John', age: 30, active: true });
      expect(user.name).toBe('John');
      expect(user.age).toBe(30);
      expect(user.active).toBe(true);
    });
  });
});
