import { describe, test, expect } from 'bun:test';

import { curry, pipe } from '@/composition';
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

describe('curry', () => {
  test('should curry a 2-arity function', () => {
    const add = (a: number, b: number) => a + b;
    const curriedAdd = curry(add);

    // Step by step application
    const add5 = curriedAdd(5);
    expect(add5(3)).toBe(8);

    // Direct application
    expect(curriedAdd(5)(3)).toBe(8);
  });

  test('should curry a 3-arity function', () => {
    const multiply = (a: number, b: number, c: number) => a * b * c;
    const curriedMultiply = curry(multiply);

    // One at a time
    expect(curriedMultiply(2)(3)(4)).toBe(24);

    // Store intermediate functions
    const multiply2 = curriedMultiply(2);
    const multiply2By3 = multiply2(3);
    expect(multiply2By3(4)).toBe(24);
  });

  test('should curry a 4-arity function', () => {
    const combine = (a: string, b: string, c: string, d: string) => `${a}-${b}-${c}-${d}`;
    const curriedCombine = curry(combine);

    expect(curriedCombine('a')('b')('c')('d')).toBe('a-b-c-d');

    // Partial application
    const combineWithA = curriedCombine('a');
    const combineWithAB = combineWithA('b');
    const combineWithABC = combineWithAB('c');
    expect(combineWithABC('d')).toBe('a-b-c-d');
  });

  test('should curry a 5-arity function', () => {
    const sum5 = (a: number, b: number, c: number, d: number, e: number) => a + b + c + d + e;
    const curriedSum = curry(sum5);

    expect(curriedSum(1)(2)(3)(4)(5)).toBe(15);

    // Build up gradually
    const sum1 = curriedSum(1);
    const sum12 = sum1(2);
    const sum123 = sum12(3);
    const sum1234 = sum123(4);
    expect(sum1234(5)).toBe(15);
  });

  test('should handle functions with different parameter types', () => {
    const format = (prefix: string, num: number, suffix: string) => `${prefix}${num}${suffix}`;
    const curriedFormat = curry(format);

    expect(curriedFormat('$')(100)('.00')).toBe('$100.00');

    // Create reusable formatters
    const dollarFormat = curriedFormat('$');
    const euroFormat = curriedFormat('€');

    expect(dollarFormat(50)('.00')).toBe('$50.00');
    expect(euroFormat(75)('.00')).toBe('€75.00');
  });

  describe('with pipe integration', () => {
    test('should work seamlessly with pipe for function composition', () => {
      const divide = (divisor: number, dividend: number) => dividend / divisor;
      const curriedDivide = curry(divide);

      const result = pipe(
        100,
        curriedDivide(2), // Creates a "divide by 2" function
        (n) => n + 1,
      );

      expect(result).toBe(51);
    });

    test('should compose multiple curried functions', () => {
      const add = (a: number, b: number) => a + b;
      const multiply = (a: number, b: number) => a * b;
      const subtract = (a: number, b: number) => a - b;

      const curriedAdd = curry(add);
      const curriedMultiply = curry(multiply);
      const curriedSubtract = curry(subtract);

      const result = pipe(
        5,
        curriedAdd(3), // 8
        curriedMultiply(2), // 16
        curriedSubtract(6), // 6 - 16 = -10
      );

      expect(result).toBe(-10);
    });
  });

  describe('with Option type', () => {
    test('should work with Option map transformations', () => {
      const parseWithRadix = (radix: number, str: string): number => {
        const n = Number.parseInt(str, radix);
        return Number.isNaN(n) ? 0 : n;
      };

      const curriedParse = curry(parseWithRadix);
      const parseHex = curriedParse(16);
      const parseBinary = curriedParse(2);

      const result = pipe(some('FF'), (o) => mapOption(o, parseHex));

      expect(isSome(result)).toBe(true);
      expect(unwrapOption(result)).toBe(255);

      const binaryResult = pipe(some('1010'), (o) => mapOption(o, parseBinary));

      expect(isSome(binaryResult)).toBe(true);
      expect(unwrapOption(binaryResult)).toBe(10);
    });

    test('should handle safe Option transformations with curried validators', () => {
      const clamp = (min: number, max: number, value: number): number => Math.min(max, Math.max(min, value));

      const scale = (factor: number, value: number): number => value * factor;

      const round = (precision: number, value: number): number => {
        const factor = Math.pow(10, precision);
        return Math.round(value * factor) / factor;
      };

      const curriedClamp = curry(clamp);
      const curriedScale = curry(scale);
      const curriedRound = curry(round);

      // Create a percentage formatter
      const toPercentage = (value: number) =>
        pipe(
          value,
          curriedClamp(0)(1), // Ensure 0-1 range
          curriedScale(100), // Convert to percentage
          curriedRound(2), // Round to 2 decimals
        );

      const result = pipe(some(0.3456), (o) => mapOption(o, toPercentage));

      expect(isSome(result)).toBe(true);
      expect(unwrapOption(result)).toBe(34.56);

      // Test clamping
      const clampedResult = pipe(some(1.5), (o) => mapOption(o, toPercentage));

      expect(isSome(clampedResult)).toBe(true);
      expect(unwrapOption(clampedResult)).toBe(100);
    });

    test('should handle None values gracefully', () => {
      const add = (a: number, b: number) => a + b;
      const curriedAdd = curry(add);

      const result = pipe(none<number>(), (o) => mapOption(o, curriedAdd(5)));

      expect(isNone(result)).toBe(true);
    });

    test('should work with flatMap transformations', () => {
      const safeParseInt = (radix: number, str: string) => {
        const n = Number.parseInt(str, radix);
        return Number.isNaN(n) ? none<number>() : some(n);
      };

      const curriedSafeParse = curry(safeParseInt);
      const safeParseDecimal = curriedSafeParse(10);

      const validResult = pipe(some('42'), (o) => flatMapOption(o, safeParseDecimal));

      expect(isSome(validResult)).toBe(true);
      expect(unwrapOption(validResult)).toBe(42);

      const invalidResult = pipe(some('invalid'), (o) => flatMapOption(o, safeParseDecimal));

      expect(isNone(invalidResult)).toBe(true);
    });
  });

  describe('with Result type', () => {
    test('should work with Result transformations for validation', () => {
      const validateBetween = (min: number, max: number, value: number) =>
        value >= min && value <= max ? ok(value) : err(`Value must be between ${min} and ${max}`);

      const curriedValidate = curry(validateBetween);
      const validateAge = curriedValidate(0)(120);
      const validatePercentage = curriedValidate(0)(100);

      const validAge = pipe(
        ok(25),
        (r) => flatMapResult(r, validateAge),
        (r) => mapResult(r, (age) => `Valid age: ${age}`),
      );

      expect(isOk(validAge)).toBe(true);
      expect(unwrapResult(validAge)).toBe('Valid age: 25');

      const invalidAge = pipe(ok(150), (r) => flatMapResult(r, validateAge));

      expect(isErr(invalidAge)).toBe(true);
      expect(() => unwrapResult(invalidAge)).toThrow('Value must be between 0 and 120');

      const validPercentage = pipe(ok(85), (r) => flatMapResult(r, validatePercentage));

      expect(isOk(validPercentage)).toBe(true);
      expect(unwrapResult(validPercentage)).toBe(85);
    });

    test('should build validation pipelines with curried validators', () => {
      const minLength = (min: number, str: string) =>
        str.length >= min ? ok(str) : err(`Must be at least ${min} characters`);

      const maxLength = (max: number, str: string) =>
        str.length <= max ? ok(str) : err(`Must be at most ${max} characters`);

      const matches = (pattern: RegExp, str: string) =>
        pattern.test(str) ? ok(str) : err(`Must match pattern ${pattern}`);

      const curriedMinLength = curry(minLength);
      const curriedMaxLength = curry(maxLength);
      const curriedMatches = curry(matches);

      // Compose into a username validator
      const validateUsername = (username: string) =>
        pipe(
          ok(username),
          (r) => flatMapResult(r, curriedMinLength(3)),
          (r) => flatMapResult(r, curriedMaxLength(20)),
          (r) => flatMapResult(r, curriedMatches(/^[a-zA-Z0-9_]+$/)),
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

    test('should handle error formatting with curried functions', () => {
      type ApiError = {
        code: number;
        message: string;
        timestamp: number;
      };

      const formatError = (prefix: string, code: number, message: string): ApiError => ({
        code,
        message: `${prefix}: ${message}`,
        timestamp: Date.now(),
      });

      const curriedFormatError = curry(formatError);
      const authError = curriedFormatError('AUTH');

      const result = err('Invalid credentials');

      const formattedResult = pipe(result, (r) => {
        if (isErr(r)) {
          const error = authError(401)('Invalid credentials');
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
          return apiError; // Return the error to keep the chain going
        }),
      );

      // Verify the error mapping worked
      expect(isErr(errorValidation)).toBe(true);
    });

    test('should short-circuit on errors in railway pattern', () => {
      const validateEven = (n: number) => (n % 2 === 0 ? ok(n) : err('Not even'));
      const validatePositive = (n: number) => (n > 0 ? ok(n) : err('Not positive'));
      const double = (a: number, b: number) => a * b;

      const curriedDouble = curry(double);
      const doubleValue = curriedDouble(2);

      // This should fail at the first validation
      const result = pipe(
        ok(5), // Odd number
        (r) => flatMapResult(r, validateEven), // Should fail here
        (r) => flatMapResult(r, validatePositive), // Should not run
        (r) => mapResult(r, doubleValue), // Should not run
      );

      expect(isErr(result)).toBe(true);
      expect(() => unwrapResult(result)).toThrow('Not even');
    });
  });

  describe('practical use cases', () => {
    test('should create reusable configuration functions', () => {
      const createUrl = (protocol: string, domain: string, path: string, query: string) =>
        `${protocol}://${domain}${path}${query ? `?${query}` : ''}`;

      const curriedCreateUrl = curry(createUrl);
      const httpsUrl = curriedCreateUrl('https');
      const apiUrl = httpsUrl('api.example.com');
      const usersEndpoint = apiUrl('/users');

      expect(usersEndpoint('')).toBe('https://api.example.com/users');
      expect(usersEndpoint('limit=10')).toBe('https://api.example.com/users?limit=10');

      // Create different endpoint builders
      const postsEndpoint = apiUrl('/posts');
      expect(postsEndpoint('author=john')).toBe('https://api.example.com/posts?author=john');
    });

    test('should work with mathematical operations', () => {
      const power = (base: number, exponent: number) => Math.pow(base, exponent);
      const modulo = (divisor: number, dividend: number) => dividend % divisor;

      const curriedPower = curry(power);
      const curriedModulo = curry(modulo);

      const square = curriedPower(2);
      const cube = curriedPower(3);
      const isEven = curriedModulo(2);
      const isMultipleOf5 = curriedModulo(5);

      expect(square(4)).toBe(16);
      expect(cube(3)).toBe(27);
      expect(isEven(8)).toBe(0); // Even numbers have remainder 0
      expect(isEven(7)).toBe(1); // Odd numbers have remainder 1
      expect(isMultipleOf5(15)).toBe(0);
      expect(isMultipleOf5(17)).toBe(2);
    });

    test('should handle string manipulation functions', () => {
      const replace = (search: string, replacement: string, str: string) =>
        str.replaceAll(new RegExp(search, 'g'), replacement);

      const padStart = (targetLength: number, padString: string, str: string) => str.padStart(targetLength, padString);

      const curriedReplace = curry(replace);
      const curriedPadStart = curry(padStart);

      const removeSpaces = curriedReplace(' ')('');
      const addZeroPadding = curriedPadStart(5)('0');

      expect(removeSpaces('hello world')).toBe('helloworld');
      expect(addZeroPadding('42')).toBe('00042');
      expect(addZeroPadding('12345')).toBe('12345');

      // Combine with pipe for text processing
      const result = pipe(
        '  hello world  ',
        (s: string) => s.trim(),
        removeSpaces,
        (s: string) => s.toUpperCase(),
      );

      expect(result).toBe('HELLOWORLD');
    });
  });

  describe('edge cases', () => {
    test('should handle functions that return functions', () => {
      const createAdder = (base: number, increment: number) => (value: number) => base + increment + value;
      const curriedCreateAdder = curry(createAdder);

      const adderFactory = curriedCreateAdder(10);
      const add15 = adderFactory(5); // Creates a function that adds 10 + 5 = 15

      expect(add15(3)).toBe(18); // 10 + 5 + 3
    });

    test('should preserve function context and behavior', () => {
      const createFormatter = (prefix: string, suffix: string, value: string) => {
        return `${prefix}${value}${suffix}`;
      };

      const curriedFormatter = curry(createFormatter);
      const htmlTag = curriedFormatter('<b>')('</b>');

      expect(htmlTag('hello')).toBe('<b>hello</b>');
    });

    test('should work with functions that have optional behavior', () => {
      const formatMessage = (prefix: string, fallback: string, value: string) => `${prefix}${value || fallback}`;

      const curriedFormat = curry(formatMessage);
      const withPrefix = curriedFormat('Hello, ');
      const greet = withPrefix('Anonymous');

      expect(greet('John')).toBe('Hello, John');
      expect(greet('')).toBe('Hello, Anonymous');
    });
  });

  describe('type safety', () => {
    test('should maintain type information through currying', () => {
      const concat = (a: string, b: string) => a + b;
      const curriedConcat = curry(concat);

      // The type system should enforce that we can only pass strings
      const concatHello = curriedConcat('Hello, ');
      const result = concatHello('World!');

      expect(result).toBe('Hello, World!');
      expect(typeof result).toBe('string');
    });

    test('should work with complex return types', () => {
      type User = { name: string; age: number };

      const createUser = (name: string, age: number): User => ({ name, age });
      const curriedCreateUser = curry(createUser);

      const createUserNamed = curriedCreateUser('John');
      const user = createUserNamed(30);

      expect(user).toEqual({ name: 'John', age: 30 });
      expect(user.name).toBe('John');
      expect(user.age).toBe(30);
    });
  });
});
