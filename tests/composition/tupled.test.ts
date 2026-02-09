import { describe, test, expect } from 'bun:test';

import { tupled, pipe, curry, uncurry } from '@/composition';
import {
  type Option,
  some,
  none,
  isSome,
  isNone,
  map as mapOption,
  flatMap as flatMapOption,
  unwrap as unwrapOption,
  combine as combineOption,
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
  combine as combineResult,
  fromTryWithError,
} from '@/result';

describe('tupled', () => {
  describe('basic functionality', () => {
    test('should tuple a 2-arity function', () => {
      const add = (a: number, b: number) => a + b;
      const tupledAdd = tupled(add);

      expect(tupledAdd([5, 3])).toBe(8);
      expect(tupledAdd([10, -2])).toBe(8);
      expect(tupledAdd([0, 0])).toBe(0);
    });

    test('should tuple a 3-arity function', () => {
      const multiply = (a: number, b: number, c: number) => a * b * c;
      const tupledMultiply = tupled(multiply);

      expect(tupledMultiply([2, 3, 4])).toBe(24);
      expect(tupledMultiply([1, 5, 10])).toBe(50);
      expect(tupledMultiply([0, 100, 200])).toBe(0);
    });

    test('should tuple a 4-arity function', () => {
      const combine = (a: string, b: string, c: string, d: string) => `${a}-${b}-${c}-${d}`;
      const tupledCombine = tupled(combine);

      expect(tupledCombine(['a', 'b', 'c', 'd'])).toBe('a-b-c-d');
      expect(tupledCombine(['hello', 'world', 'foo', 'bar'])).toBe('hello-world-foo-bar');
    });

    test('should tuple a 5-arity function', () => {
      const sum = (a: number, b: number, c: number, d: number, e: number) => a + b + c + d + e;
      const tupledSum = tupled(sum);

      expect(tupledSum([1, 2, 3, 4, 5])).toBe(15);
      expect(tupledSum([10, 20, 30, 40, 50])).toBe(150);
    });

    test('should handle functions with different parameter types', () => {
      const format = (prefix: string, num: number, suffix: string) => `${prefix}${num}${suffix}`;
      const tupledFormat = tupled(format);

      expect(tupledFormat(['$', 100, '.00'])).toBe('$100.00');
      expect(tupledFormat(['€', 75, '.50'])).toBe('€75.50');
    });
  });

  describe('with pipe composition', () => {
    test('should work with pipe for processing tuple data', () => {
      const distance = (x: number, y: number) => Math.hypot(x, y);
      const tupledDistance = tupled(distance);

      const coordinates: [number, number] = [3, 4];

      const result = pipe(coordinates, tupledDistance, (d) => Math.round(d));

      expect(result).toBe(5);
    });

    test('should work with pipe for multi-step transformations', () => {
      const createPoint = (x: number, y: number) => ({ x, y });
      const formatPoint = (point: { x: number; y: number }) => `(${point.x}, ${point.y})`;
      const tupledCreatePoint = tupled(createPoint);

      const result = pipe([10, 20] as [number, number], tupledCreatePoint, formatPoint);

      expect(result).toBe('(10, 20)');
    });

    test('should compose with mathematical operations', () => {
      const average = (a: number, b: number, c: number) => (a + b + c) / 3;
      const tupledAverage = tupled(average);

      const result = pipe(
        [9, 6, 15] as [number, number, number],
        tupledAverage,
        (avg) => Math.round(avg),
        (rounded) => `Average: ${rounded}`,
      );

      expect(result).toBe('Average: 10');
    });
  });

  describe('with Option type', () => {
    test('should work with Option values in pipe', () => {
      const safeDivide = (dividend: number, divisor: number): Option<number> =>
        divisor === 0 ? none() : some(dividend / divisor);

      const tupledSafeDivide = tupled(safeDivide);

      const validResult = pipe(
        some([10, 2] as [number, number]),
        (o) => flatMapOption(o, tupledSafeDivide),
        (o) => mapOption(o, (n) => n * 2),
      );

      expect(isSome(validResult)).toBe(true);
      expect(unwrapOption(validResult)).toBe(10);

      const invalidResult = pipe(
        some([10, 0] as [number, number]),
        (o) => flatMapOption(o, tupledSafeDivide),
        (o) => mapOption(o, (n) => n * 2),
      );

      expect(isNone(invalidResult)).toBe(true);
    });

    test('should handle safeParse with tupled functions', () => {
      const safeParse = (str: string, radix: number): Option<number> => {
        const n = Number.parseInt(str, radix);
        return Number.isNaN(n) ? none() : some(n);
      };

      const tupledParse = tupled(safeParse);

      // Valid hex parse
      const hexResult = pipe(some(['FF', 16] as [string, number]), (o) => flatMapOption(o, tupledParse));

      expect(isSome(hexResult)).toBe(true);
      expect(unwrapOption(hexResult)).toBe(255);

      // Invalid parse
      const invalidResult = pipe(some(['XYZ', 10] as [string, number]), (o) => flatMapOption(o, tupledParse));

      expect(isNone(invalidResult)).toBe(true);
    });

    test('should handle combining multiple Options into tuples', () => {
      const calculateScore = (correct: number, total: number, bonus: number): Option<number> => {
        if (total === 0) return none();
        const percentage = (correct / total) * 100;
        return some(percentage + bonus);
      };

      const tupledScore = tupled(calculateScore);

      const quizData = combineOption([
        some(8), // correct answers
        some(10), // total questions
        some(5), // bonus points
      ]);

      const result = pipe(quizData, (o) => flatMapOption(o, (data) => tupledScore(data as [number, number, number])));

      expect(isSome(result)).toBe(true);
      expect(unwrapOption(result)).toBe(85);

      // Test with missing data
      const incompleteData = combineOption([some(8), none<number>(), some(5)]);

      const incompleteResult = pipe(incompleteData, (o) =>
        flatMapOption(o, (data) => tupledScore(data as [number, number, number])),
      );

      expect(isNone(incompleteResult)).toBe(true);
    });
  });

  describe('with Result type', () => {
    test('should work with Result values for validation', () => {
      const divide = (dividend: number, divisor: number): Result<number, string> =>
        divisor === 0 ? err('Division by zero') : ok(dividend / divisor);

      const tupledDivide = tupled(divide);

      const validResult = pipe(
        ok([10, 2] as [number, number]),
        (r) => flatMapResult(r, tupledDivide),
        (r) => mapResult(r, (n) => n * 2),
      );

      expect(isOk(validResult)).toBe(true);
      expect(unwrapResult(validResult)).toBe(10);

      const errorResult = pipe(
        ok([10, 0] as [number, number]),
        (r) => flatMapResult(r, tupledDivide),
        (r) => mapResult(r, (n) => n * 2),
      );

      expect(isErr(errorResult)).toBe(true);
      if (isErr(errorResult)) {
        expect(errorResult.error).toBe('Division by zero');
      }
    });

    test('should handle coordinate validation', () => {
      type Point = { x: number; y: number };

      const createPoint = (x: number, y: number): Result<Point, string> => {
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          return err('Invalid coordinates');
        }
        return ok({ x, y });
      };

      const tupledCreatePoint = tupled(createPoint);

      // Valid coordinates
      const validResult = tupledCreatePoint([10, 20]);
      expect(isOk(validResult)).toBe(true);
      expect(unwrapResult(validResult)).toEqual({ x: 10, y: 20 });

      // Invalid coordinates
      const invalidResult = tupledCreatePoint([Infinity, 20]);
      expect(isErr(invalidResult)).toBe(true);
      if (isErr(invalidResult)) {
        expect(invalidResult.error).toBe('Invalid coordinates');
      }
    });

    test('should handle form validation with tuples', () => {
      type UserData = {
        username: string;
        email: string;
        age: number;
      };

      const validateUser = (username: string, email: string, age: number): Result<UserData, string> => {
        if (username.length < 3) return err('Username too short');
        if (!email.includes('@')) return err('Invalid email');
        if (age < 18) return err('Must be 18 or older');
        return ok({ username, email, age });
      };

      const tupledValidateUser = tupled(validateUser);

      // Valid user data
      const validData: [string, string, number] = ['john_doe', 'john@example.com', 25];
      const validResult = pipe(ok(validData), (r) => flatMapResult(r, tupledValidateUser));

      expect(isOk(validResult)).toBe(true);
      expect(unwrapResult(validResult)).toEqual({
        username: 'john_doe',
        email: 'john@example.com',
        age: 25,
      });

      // Invalid username
      const invalidUsername: [string, string, number] = ['jo', 'john@example.com', 25];
      const usernameResult = tupledValidateUser(invalidUsername);
      expect(isErr(usernameResult)).toBe(true);
      if (isErr(usernameResult)) {
        expect(usernameResult.error).toBe('Username too short');
      }

      // Invalid email
      const invalidEmail: [string, string, number] = ['john_doe', 'invalid-email', 25];
      const emailResult = tupledValidateUser(invalidEmail);
      expect(isErr(emailResult)).toBe(true);
      if (isErr(emailResult)) {
        expect(emailResult.error).toBe('Invalid email');
      }

      // Invalid age
      const invalidAge: [string, string, number] = ['john_doe', 'john@example.com', 16];
      const ageResult = tupledValidateUser(invalidAge);
      expect(isErr(ageResult)).toBe(true);
      if (isErr(ageResult)) {
        expect(ageResult.error).toBe('Must be 18 or older');
      }
    });

    test('should handle database row parsing', () => {
      type User = {
        id: number;
        name: string;
        createdAt: Date;
      };

      const parseDbRow = (id: unknown, name: unknown, createdAt: unknown): Result<User, Error> => {
        return fromTryWithError(() => ({
          id: Number(id),
          name: String(name),
          createdAt: new Date(String(createdAt)),
        }));
      };

      const tupledParseRow = tupled(parseDbRow);

      // Valid database row
      const dbRow: [unknown, unknown, unknown] = [1, 'Alice', '2024-01-01'];
      const result = tupledParseRow(dbRow);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.id).toBe(1);
        expect(result.value.name).toBe('Alice');
        expect(result.value.createdAt).toBeInstanceOf(Date);
      }
    });

    test('should combine multiple Results with tupled functions', () => {
      const validateRange = (min: number, max: number, value: number): Result<number, string> =>
        value >= min && value <= max ? ok(value) : err(`Must be between ${min} and ${max}`);

      const tupledValidateRange = tupled(validateRange);

      const rangeData = combineResult([
        ok(0), // min
        ok(100), // max
        ok(75), // value
      ]);

      const result = pipe(rangeData, (r) =>
        flatMapResult(r, (data) => tupledValidateRange(data as [number, number, number])),
      );

      expect(isOk(result)).toBe(true);
      expect(unwrapResult(result)).toBe(75);

      // Test with failed validation
      const invalidRangeData = combineResult([
        ok(0), // min
        ok(100), // max
        ok(150), // value (out of range)
      ]);

      const invalidResult = pipe(invalidRangeData, (r) =>
        flatMapResult(r, (data) => tupledValidateRange(data as [number, number, number])),
      );

      expect(isErr(invalidResult)).toBe(true);
      if (isErr(invalidResult)) {
        expect(invalidResult.error).toBe('Must be between 0 and 100');
      }
    });
  });

  describe('integration with curry/uncurry', () => {
    test('should work with curry for flexible APIs', () => {
      const between = curry(
        (min: number, max: number, value: number): Result<number, string> =>
          value >= min && value <= max ? ok(value) : err(`Must be between ${min} and ${max}`),
      );

      // Use tupled to handle all three at once
      const tupledBetween = tupled((min: number, max: number, value: number) => between(min)(max)(value));

      const config: [number, number, number] = [0, 100, 75];
      const result = tupledBetween(config);

      expect(isOk(result)).toBe(true);
      expect(unwrapResult(result)).toBe(75);
    });

    test('should compose with uncurry', () => {
      // Start with a curried function
      const curriedAdd = (a: number) => (b: number) => (c: number) => a + b + c;

      // Uncurry it to get a regular multi-arg function
      const add = uncurry(curriedAdd);

      // Then tuple it to work with tuple data
      const tupledAdd = tupled(add);

      const result = tupledAdd([1, 2, 3]);
      expect(result).toBe(6);
    });
  });

  describe('practical scenarios', () => {
    test('should handle CSV data processing', () => {
      type Product = {
        id: number;
        name: string;
        price: number;
      };

      const parseProductRow = (id: string, name: string, price: string): Result<Product, string> => {
        const parsedId = Number.parseInt(id, 10);
        const parsedPrice = Number.parseFloat(price);

        if (Number.isNaN(parsedId)) return err('Invalid product ID');
        if (!name.trim()) return err('Product name cannot be empty');
        if (Number.isNaN(parsedPrice) || parsedPrice < 0) return err('Invalid price');

        return ok({
          id: parsedId,
          name: name.trim(),
          price: parsedPrice,
        });
      };

      const tupledParseProduct = tupled(parseProductRow);

      // Valid CSV row
      const csvRow: [string, string, string] = ['123', 'Laptop', '999.99'];
      const result = tupledParseProduct(csvRow);

      expect(isOk(result)).toBe(true);
      expect(unwrapResult(result)).toEqual({
        id: 123,
        name: 'Laptop',
        price: 999.99,
      });

      // Invalid CSV row
      const invalidRow: [string, string, string] = ['abc', 'Laptop', '999.99'];
      const invalidResult = tupledParseProduct(invalidRow);

      expect(isErr(invalidResult)).toBe(true);
      if (isErr(invalidResult)) {
        expect(invalidResult.error).toBe('Invalid product ID');
      }
    });

    test('should handle API response transformation', () => {
      type ApiResponse = {
        status: number;
        message: string;
        data: unknown;
      };

      const createApiResponse = (status: number, message: string, data: unknown): Result<ApiResponse, string> => {
        if (status < 100 || status > 599) return err('Invalid HTTP status code');
        if (!message) return err('Message cannot be empty');

        return ok({ status, message, data });
      };

      const tupledCreateResponse = tupled(createApiResponse);

      // Success response
      const successData: [number, string, unknown] = [200, 'OK', { user: 'john' }];
      const successResult = tupledCreateResponse(successData);

      expect(isOk(successResult)).toBe(true);
      expect(unwrapResult(successResult)).toEqual({
        status: 200,
        message: 'OK',
        data: { user: 'john' },
      });

      // Error response
      const errorData: [number, string, unknown] = [999, 'Invalid', null];
      const errorResult = tupledCreateResponse(errorData);

      expect(isErr(errorResult)).toBe(true);
      if (isErr(errorResult)) {
        expect(errorResult.error).toBe('Invalid HTTP status code');
      }
    });

    test('should handle mathematical calculations with validation', () => {
      const calculateBMI = (weight: number, height: number): Result<number, string> => {
        if (weight <= 0) return err('Weight must be positive');
        if (height <= 0) return err('Height must be positive');

        const bmi = weight / (height * height);
        return ok(Math.round(bmi * 100) / 100);
      };

      const tupledCalculateBMI = tupled(calculateBMI);

      // Valid calculation
      const validData: [number, number] = [70, 1.75];
      const result = pipe(validData, tupledCalculateBMI, (r) =>
        mapResult(r, (bmi) => ({
          bmi,
          // eslint-disable-next-line unicorn/no-nested-ternary
          category: bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese',
        })),
      );

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.bmi).toBe(22.86);
        expect(result.value.category).toBe('Normal');
      }

      // Invalid weight
      const invalidWeight: [number, number] = [-5, 1.75];
      const weightResult = tupledCalculateBMI(invalidWeight);

      expect(isErr(weightResult)).toBe(true);
      if (isErr(weightResult)) {
        expect(weightResult.error).toBe('Weight must be positive');
      }
    });
  });
});
