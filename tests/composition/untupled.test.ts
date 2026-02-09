import { describe, test, expect } from 'bun:test';

import { untupled, tupled, pipe, curry, uncurry } from '@/composition';
import {
  type Option,
  some,
  none,
  isSome,
  isNone,
  map as mapOption,
  flatMap as flatMapOption,
  unwrap as unwrapOption,
} from '@/option';
import {
  type Result,
  ok,
  err,
  isOk,
  isErr,
  map as mapResult,
  flatMap as flatMapResult,
  unwrap as unwrapResult,
  fromTryWithError,
} from '@/result';

describe('untupled', () => {
  describe('basic functionality', () => {
    test('should untuple a 2-arity function', () => {
      const tupledAdd = ([a, b]: [number, number]) => a + b;
      const add = untupled(tupledAdd);

      expect(add(5, 3)).toBe(8);
      expect(add(10, -2)).toBe(8);
      expect(add(0, 0)).toBe(0);
    });

    test('should untuple a 3-arity function', () => {
      const tupledMultiply = ([a, b, c]: [number, number, number]) => a * b * c;
      const multiply = untupled(tupledMultiply);

      expect(multiply(2, 3, 4)).toBe(24);
      expect(multiply(1, 5, 10)).toBe(50);
      expect(multiply(0, 100, 200)).toBe(0);
    });

    test('should untuple a 4-arity function', () => {
      const tupledCombine = ([a, b, c, d]: [string, string, string, string]) => `${a}-${b}-${c}-${d}`;
      const combine = untupled(tupledCombine);

      expect(combine('a', 'b', 'c', 'd')).toBe('a-b-c-d');
      expect(combine('hello', 'world', 'foo', 'bar')).toBe('hello-world-foo-bar');
    });

    test('should untuple a 5-arity function', () => {
      const tupledSum = ([a, b, c, d, e]: [number, number, number, number, number]) => a + b + c + d + e;
      const sum = untupled(tupledSum);

      expect(sum(1, 2, 3, 4, 5)).toBe(15);
      expect(sum(10, 20, 30, 40, 50)).toBe(150);
    });

    test('should handle functions with different parameter types', () => {
      const tupledFormat = ([prefix, num, suffix]: [string, number, string]) => `${prefix}${num}${suffix}`;
      const format = untupled(tupledFormat);

      expect(format('$', 100, '.00')).toBe('$100.00');
      expect(format('€', 75, '.50')).toBe('€75.50');
    });
  });

  describe('round-trip with tupled', () => {
    test('should work as inverse of tupled for 2-arity functions', () => {
      const originalAdd = (a: number, b: number) => a + b;
      const tupledAdd = tupled(originalAdd);
      const untupledAdd = untupled(tupledAdd);

      expect(untupledAdd(5, 3)).toBe(8);
      expect(untupledAdd(5, 3)).toBe(originalAdd(5, 3));
    });

    test('should work as inverse of tupled for 3-arity functions', () => {
      const originalMultiply = (a: number, b: number, c: number) => a * b * c;
      const tupledMultiply = tupled(originalMultiply);
      const untupledMultiply = untupled(tupledMultiply);

      expect(untupledMultiply(2, 3, 4)).toBe(24);
      expect(untupledMultiply(2, 3, 4)).toBe(originalMultiply(2, 3, 4));
    });

    test('should work as inverse of tupled for 4-arity functions', () => {
      const originalConcat = (a: string, b: string, c: string, d: string) => a + b + c + d;
      const tupledConcat = tupled(originalConcat);
      const untupledConcat = untupled(tupledConcat);

      expect(untupledConcat('a', 'b', 'c', 'd')).toBe('abcd');
      expect(untupledConcat('a', 'b', 'c', 'd')).toBe(originalConcat('a', 'b', 'c', 'd'));
    });

    test('should work as inverse of tupled for 5-arity functions', () => {
      const originalSum = (a: number, b: number, c: number, d: number, e: number) => a + b + c + d + e;
      const tupledSum = tupled(originalSum);
      const untupledSum = untupled(tupledSum);

      expect(untupledSum(1, 2, 3, 4, 5)).toBe(15);
      expect(untupledSum(1, 2, 3, 4, 5)).toBe(originalSum(1, 2, 3, 4, 5));
    });
  });

  describe('with pipe composition', () => {
    test('should work with pipe for processing individual arguments', () => {
      const tupledDistance = ([x, y]: [number, number]) => Math.hypot(x, y);
      const distance = untupled(tupledDistance);

      const result = pipe(
        3,
        (x) => distance(x, 4),
        (d) => Math.round(d),
      );

      expect(result).toBe(5);
    });

    test('should enable flexible API design', () => {
      const tupledCreatePoint = ([x, y]: [number, number]) => ({ x, y });
      const createPoint = untupled(tupledCreatePoint);
      const formatPoint = (point: { x: number; y: number }) => `(${point.x}, ${point.y})`;

      const result = pipe(10, (x) => createPoint(x, 20), formatPoint);

      expect(result).toBe('(10, 20)');
    });

    test('should compose with mathematical operations', () => {
      const tupledAverage = ([a, b, c]: [number, number, number]) => (a + b + c) / 3;
      const average = untupled(tupledAverage);

      const result = pipe(
        9,
        (a) => average(a, 6, 15),
        (avg) => Math.round(avg),
        (rounded) => `Average: ${rounded}`,
      );

      expect(result).toBe('Average: 10');
    });
  });

  describe('with Option type', () => {
    test('should work with Option-returning tuple functions', () => {
      const tupledSafeDivide = ([dividend, divisor]: [number, number]): Option<number> =>
        divisor === 0 ? none() : some(dividend / divisor);

      const safeDivide = untupled(tupledSafeDivide);

      const validResult = pipe(
        some(10),
        (o) => flatMapOption(o, (n) => safeDivide(n, 2)),
        (o) => mapOption(o, (n) => n * 2),
      );

      expect(isSome(validResult)).toBe(true);
      expect(unwrapOption(validResult)).toBe(10);

      const invalidResult = pipe(
        some(10),
        (o) => flatMapOption(o, (n) => safeDivide(n, 0)),
        (o) => mapOption(o, (n) => n * 2),
      );

      expect(isNone(invalidResult)).toBe(true);
    });

    test('should handle coordinate parsing', () => {
      const tupledParseCoordinate = ([x, y]: [string, string]): Option<{ x: number; y: number }> => {
        const nx = Number.parseFloat(x);
        const ny = Number.parseFloat(y);
        return Number.isNaN(nx) || Number.isNaN(ny) ? none() : some({ x: nx, y: ny });
      };

      const parseCoordinate = untupled(tupledParseCoordinate);

      // Valid coordinates
      const validResult = parseCoordinate('3.14', '2.71');
      expect(isSome(validResult)).toBe(true);
      expect(unwrapOption(validResult)).toEqual({ x: 3.14, y: 2.71 });

      // Invalid coordinates
      const invalidResult = parseCoordinate('abc', '2.71');
      expect(isNone(invalidResult)).toBe(true);
    });

    test('should work with database query builders', () => {
      type Query = {
        table: string;
        where: string;
        limit: number;
      };

      const tupledBuildQuery = ([table, where, limit]: [string, string, number]): Option<Query> => {
        if (!table || limit < 0) return none();
        return some({ table, where, limit });
      };

      const buildQuery = untupled(tupledBuildQuery);

      const result = pipe(some('users'), (o) => flatMapOption(o, (table) => buildQuery(table, 'active = true', 10)));

      expect(isSome(result)).toBe(true);
      expect(unwrapOption(result)).toEqual({
        table: 'users',
        where: 'active = true',
        limit: 10,
      });

      // Invalid query
      const invalidResult = buildQuery('', 'active = true', 10);
      expect(isNone(invalidResult)).toBe(true);
    });
  });

  describe('with Result type', () => {
    test('should work with Result-returning tuple functions', () => {
      const tupledValidateRange = ([min, max, value]: [number, number, number]): Result<number, string> =>
        value >= min && value <= max ? ok(value) : err(`Value ${value} not between ${min} and ${max}`);

      const validateRange = untupled(tupledValidateRange);

      const validResult = pipe(
        ok(50),
        (r) => flatMapResult(r, (n) => validateRange(0, 100, n)),
        (r) => mapResult(r, (n) => n * 2),
      );

      expect(isOk(validResult)).toBe(true);
      expect(unwrapResult(validResult)).toBe(100);

      const invalidResult = pipe(
        ok(150),
        (r) => flatMapResult(r, (n) => validateRange(0, 100, n)),
        (r) => mapResult(r, (n) => n * 2),
      );

      expect(isErr(invalidResult)).toBe(true);
      if (isErr(invalidResult)) {
        expect(invalidResult.error).toBe('Value 150 not between 0 and 100');
      }
    });

    test('should handle BMI calculation', () => {
      const tupledCalculateBMI = ([weight, height]: [number, number]): Result<number, string> => {
        if (weight <= 0 || height <= 0) {
          return err('Weight and height must be positive');
        }
        const bmi = weight / (height * height);
        return ok(Math.round(bmi * 10) / 10);
      };

      const calculateBMI = untupled(tupledCalculateBMI);

      // Valid calculation
      const validResult = calculateBMI(70, 1.75);
      expect(isOk(validResult)).toBe(true);
      expect(unwrapResult(validResult)).toBe(22.9);

      // Invalid weight
      const invalidResult = calculateBMI(-5, 1.75);
      expect(isErr(invalidResult)).toBe(true);
      if (isErr(invalidResult)) {
        expect(invalidResult.error).toBe('Weight and height must be positive');
      }
    });

    test('should handle RGB color creation', () => {
      type RGB = { r: number; g: number; b: number };

      const tupledCreateRGB = ([r, g, b]: [number, number, number]): Result<RGB, string> => {
        const valid = [r, g, b].every((n) => n >= 0 && n <= 255);
        return valid ? ok({ r, g, b }) : err('RGB values must be 0-255');
      };

      const createRGB = untupled(tupledCreateRGB);

      // Valid RGB
      const validResult = createRGB(255, 128, 0);
      expect(isOk(validResult)).toBe(true);
      expect(unwrapResult(validResult)).toEqual({ r: 255, g: 128, b: 0 });

      // Invalid RGB
      const invalidResult = createRGB(300, 128, 0);
      expect(isErr(invalidResult)).toBe(true);
      if (isErr(invalidResult)) {
        expect(invalidResult.error).toBe('RGB values must be 0-255');
      }

      // Test both APIs work the same
      const arrayResult = tupledCreateRGB([255, 128, 0]);
      const multiArgResult = createRGB(255, 128, 0);
      expect(arrayResult).toEqual(multiArgResult);
    });

    test('should handle form validation with error details', () => {
      type UserData = {
        username: string;
        email: string;
        age: number;
      };

      const tupledValidateUser = ([username, email, age]: [string, string, number]): Result<UserData, string> => {
        if (username.length < 3) return err('Username too short');
        if (!email.includes('@')) return err('Invalid email');
        if (age < 18) return err('Must be 18 or older');
        return ok({ username, email, age });
      };

      const validateUser = untupled(tupledValidateUser);

      // Valid user
      const validResult = validateUser('john_doe', 'john@example.com', 25);
      expect(isOk(validResult)).toBe(true);
      expect(unwrapResult(validResult)).toEqual({
        username: 'john_doe',
        email: 'john@example.com',
        age: 25,
      });

      // Invalid username
      const invalidResult = validateUser('jo', 'john@example.com', 25);
      expect(isErr(invalidResult)).toBe(true);
      if (isErr(invalidResult)) {
        expect(invalidResult.error).toBe('Username too short');
      }
    });
  });

  describe('mathematical operations', () => {
    test('should handle vector operations', () => {
      const tupledDotProduct = ([x1, y1, x2, y2]: [number, number, number, number]): number => x1 * x2 + y1 * y2;

      const tupledCrossProduct = ([x1, y1, x2, y2]: [number, number, number, number]): number => x1 * y2 - y1 * x2;

      const dotProduct = untupled(tupledDotProduct);
      const crossProduct = untupled(tupledCrossProduct);

      const result = pipe(ok({ v1: [3, 4] as [number, number], v2: [1, 2] as [number, number] }), (r) =>
        mapResult(r, ({ v1, v2 }) => ({
          dot: dotProduct(v1[0], v1[1], v2[0], v2[1]),
          cross: crossProduct(v1[0], v1[1], v2[0], v2[1]),
        })),
      );

      expect(isOk(result)).toBe(true);
      expect(unwrapResult(result)).toEqual({
        dot: 11, // 3*1 + 4*2
        cross: 2, // 3*2 - 4*1
      });
    });

    test('should handle complex calculations', () => {
      const tupledQuadratic = ([a, b, c, x]: [number, number, number, number]): number => a * x * x + b * x + c;

      const quadratic = untupled(tupledQuadratic);

      const result = pipe(
        [1, -3, 2] as [number, number, number],
        ([a, b, c]) => quadratic(a, b, c, 2), // x = 2
      );

      expect(result).toBe(0); // 1*4 + (-3)*2 + 2 = 4 - 6 + 2 = 0
    });
  });

  describe('integration with curry/uncurry', () => {
    test('should combine with curry for flexible APIs', () => {
      const curriedValidate = curry(
        (min: number, max: number, value: number): Result<number, string> =>
          value >= min && value <= max ? ok(value) : err('Out of range'),
      );

      // Create different interfaces
      const validateTuple = tupled(uncurry(curriedValidate));
      const validateMulti = uncurry(curriedValidate);
      const validatePartial = curriedValidate;

      // Transform tuple version to multi-arg
      const fromTupleToMulti = untupled(validateTuple);

      // All should work the same
      const tupleResult = validateTuple([0, 100, 50]);
      const multiResult = validateMulti(0, 100, 50);
      const partialResult = validatePartial(0)(100)(50);
      const transformedResult = fromTupleToMulti(0, 100, 50);

      expect(tupleResult).toEqual(multiResult);
      expect(multiResult).toEqual(partialResult);
      expect(partialResult).toEqual(transformedResult);
      expect(isOk(transformedResult)).toBe(true);
      expect(unwrapResult(transformedResult)).toBe(50);
    });

    test('should work with uncurry for round-trip transformations', () => {
      // Start with a curried function
      const curriedAdd = (a: number) => (b: number) => (c: number) => a + b + c;

      // Uncurry it to get a regular multi-arg function
      const add = uncurry(curriedAdd);

      // Tuple it to work with array data
      const tupledAdd = tupled(add);

      // Untuple it back to multi-arg
      const untupledAdd = untupled(tupledAdd);

      const result = untupledAdd(1, 2, 3);
      expect(result).toBe(6);
    });
  });

  describe('practical scenarios', () => {
    test('should handle logging and debugging', () => {
      const tupledLog = ([level, message, timestamp]: [string, string, number]): Result<void, Error> => {
        return fromTryWithError(() => {
          console.log(`[${level}] ${timestamp}: ${message}`);
        });
      };

      const log = untupled(tupledLog);

      // Should work without throwing
      const result = log('info', 'User login', Date.now());
      expect(isOk(result)).toBe(true);
    });

    test('should handle API endpoint builders', () => {
      type Endpoint = {
        method: string;
        path: string;
        version: number;
      };

      const tupledBuildEndpoint = ([method, path, version]: [string, string, number]): Result<Endpoint, string> => {
        if (!method || !path) return err('Method and path are required');
        if (version < 1) return err('Version must be >= 1');
        return ok({ method, path, version });
      };

      const buildEndpoint = untupled(tupledBuildEndpoint);

      // Valid endpoint
      const validResult = buildEndpoint('GET', '/users', 2);
      expect(isOk(validResult)).toBe(true);
      expect(unwrapResult(validResult)).toEqual({
        method: 'GET',
        path: '/users',
        version: 2,
      });

      // Invalid endpoint
      const invalidResult = buildEndpoint('', '/users', 2);
      expect(isErr(invalidResult)).toBe(true);
      if (isErr(invalidResult)) {
        expect(invalidResult.error).toBe('Method and path are required');
      }
    });

    test('should handle configuration validation', () => {
      type Config = {
        host: string;
        port: number;
        ssl: boolean;
      };

      const tupledValidateConfig = ([host, port, ssl]: [string, number, boolean]): Result<Config, string> => {
        if (!host) return err('Host is required');
        if (port < 1 || port > 65_535) return err('Port must be between 1 and 65535');
        return ok({ host, port, ssl });
      };

      const validateConfig = untupled(tupledValidateConfig);

      // Valid config
      const validResult = validateConfig('localhost', 8080, true);
      expect(isOk(validResult)).toBe(true);
      expect(unwrapResult(validResult)).toEqual({
        host: 'localhost',
        port: 8080,
        ssl: true,
      });

      // Invalid port
      const invalidResult = validateConfig('localhost', 70_000, false);
      expect(isErr(invalidResult)).toBe(true);
      if (isErr(invalidResult)) {
        expect(invalidResult.error).toBe('Port must be between 1 and 65535');
      }
    });

    test('should handle data transformation pipelines', () => {
      const tupledTransformRow = ([id, name, score]: [string, string, string]): Result<
        { id: number; name: string; score: number },
        string
      > => {
        const parsedId = Number.parseInt(id, 10);
        const parsedScore = Number.parseFloat(score);

        if (Number.isNaN(parsedId)) return err('Invalid ID');
        if (!name.trim()) return err('Name cannot be empty');
        if (Number.isNaN(parsedScore)) return err('Invalid score');

        return ok({
          id: parsedId,
          name: name.trim(),
          score: parsedScore,
        });
      };

      const transformRow = untupled(tupledTransformRow);

      // Valid transformation
      const validResult = transformRow('123', 'Alice', '95.5');
      expect(isOk(validResult)).toBe(true);
      expect(unwrapResult(validResult)).toEqual({
        id: 123,
        name: 'Alice',
        score: 95.5,
      });

      // Invalid ID
      const invalidResult = transformRow('abc', 'Alice', '95.5');
      expect(isErr(invalidResult)).toBe(true);
      if (isErr(invalidResult)) {
        expect(invalidResult.error).toBe('Invalid ID');
      }
    });
  });
});
