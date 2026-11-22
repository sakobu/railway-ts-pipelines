import { describe, test, expect } from 'bun:test';

import { flow } from '@/composition';
import {
  some,
  none,
  isSome,
  isNone,
  map as mapOption,
  flatMap as flatMapOption,
  unwrap as unwrapOption,
  filter as filterOption,
  tap as tapOption,
} from '@/option';
import {
  ok,
  err,
  isOk,
  isErr,
  map as mapResult,
  flatMap as flatMapResult,
  unwrap as unwrapResult,
  filter as filterResult,
  tap as tapResult,
  fromPromise,
} from '@/result';

describe('flow', () => {
  describe('with primitive values', () => {
    test('should create a function that transforms values', () => {
      const processNumber = flow(
        (n: number) => n * 2,
        (n) => n + 1,
        (n) => n.toString(),
      );

      const result = processNumber(5);
      expect(result).toBe('11');
    });

    test('should handle multiple arguments in first function', () => {
      const formatName = flow(
        (first: string, last: string) => `${first} ${last}`,
        (name) => name.toUpperCase(),
      );

      const result = formatName('John', 'Doe');
      expect(result).toBe('JOHN DOE');
    });
  });

  describe('with Option type', () => {
    test('should handle Some values through map transformations', () => {
      const processOption = flow(
        (n: number) => some(n),
        (o) => mapOption(o, (n: number) => n * 2),
        (o) => mapOption(o, (n: number) => n.toString()),
      );

      const result = processOption(5);
      expect(isSome(result)).toBe(true);
      expect(unwrapOption(result)).toBe('10');
    });

    test('should maintain None values through map transformations', () => {
      const processOption = flow(
        () => none<number>(),
        (o) => mapOption(o, (n: number) => n * 2),
        (o) => mapOption(o, (n: number) => n.toString()),
      );

      const result = processOption();
      expect(isNone(result)).toBe(true);
    });

    test('should handle flatMap transformations correctly', () => {
      const processOption = flow(
        (n: number) => some(n),
        (o) => flatMapOption(o, (n) => some(n * 2)),
        (o) => flatMapOption(o, (n) => some(n.toString())),
      );

      const result = processOption(5);
      expect(isSome(result)).toBe(true);
      expect(unwrapOption(result)).toBe('10');
    });

    test('should handle flatMap with None results', () => {
      const processOption = flow(
        (n: number) => some(n),
        (o) => flatMapOption(o, (n) => (n > 10 ? some(n) : none<number>())),
        (o) => mapOption(o, (n: number) => n.toString()),
      );

      const result = processOption(5);
      expect(isNone(result)).toBe(true);
    });

    test('should handle complex Option pipelines with filtering', () => {
      const processOption = flow(
        (n: number) => some(n),
        (o) => mapOption(o, (n: number) => n * 3),
        (o) => filterOption(o, (n: number) => n > 10),
        (o) => mapOption(o, (n: number) => n.toString()),
      );

      const result = processOption(5);
      expect(isSome(result)).toBe(true);
      expect(unwrapOption(result)).toBe('15');
    });

    test('should handle side effects with tap', () => {
      let sideEffect = 0;

      const processOption = flow(
        (n: number) => some(n),
        (o) => tapOption(o, (n) => (sideEffect = n)),
        (o) => mapOption(o, (n) => n * 2),
      );

      const result = processOption(5);
      expect(isSome(result)).toBe(true);
      expect(unwrapOption(result)).toBe(10);
      expect(sideEffect).toBe(5);
    });

    test('should work with function composition patterns', () => {
      const double = (n: number) => n * 2;
      const isEven = (n: number) => n % 2 === 0;
      const toString = (n: number) => n.toString();

      const processOption = flow(
        (n: number) => some(n),
        (o) => mapOption(o, double), // 10
        (o) => filterOption(o, isEven), // still Some(10)
        (o) => mapOption(o, toString), // "10"
      );

      const result = processOption(5);
      expect(isSome(result)).toBe(true);
      expect(unwrapOption(result)).toBe('10');
    });
  });

  describe('with Result type', () => {
    test('should handle Ok values through map transformations', () => {
      const processResult = flow(
        (n: number) => ok(n),
        (r) => mapResult(r, (n) => n * 2),
        (r) => mapResult(r, (n) => n.toString()),
      );

      const result = processResult(5);
      expect(isOk(result)).toBe(true);
      expect(unwrapResult(result)).toBe('10');
    });

    test('should maintain Err values through map transformations', () => {
      const processResult = flow(
        (message: string) => err(message),
        (r) => mapResult(r, (n: number) => n * 2),
        (r) => mapResult(r, (n: number) => n.toString()),
      );

      const result = processResult('Test error');
      expect(isErr(result)).toBe(true);
    });

    test('should handle flatMap transformations correctly', () => {
      const processResult = flow(
        (n: number) => ok(n),
        (r) => flatMapResult(r, (n) => ok(n * 2)),
        (r) => flatMapResult(r, (n) => ok(n.toString())),
      );

      const result = processResult(5);
      expect(isOk(result)).toBe(true);
      expect(unwrapResult(result)).toBe('10');
    });

    test('should handle flatMap with Err results', () => {
      const processResult = flow(
        (n: number) => ok(n),
        (r) => flatMapResult(r, (n) => (n > 10 ? ok(n) : err('Value too small'))),
        (r) => mapResult(r, (n) => n.toString()),
      );

      const result = processResult(5);
      expect(isErr(result)).toBe(true);
    });

    test('should handle complex Result pipelines with filtering', () => {
      const processResult = flow(
        (n: number) => ok(n),
        (r) => mapResult(r, (n) => n * 3),
        (r) => filterResult(r, (n) => n > 10, 'Value too small'),
        (r) => mapResult(r, (n) => n.toString()),
      );

      const result = processResult(5);
      expect(isOk(result)).toBe(true);
      expect(unwrapResult(result)).toBe('15');
    });

    test('should handle side effects with tap', () => {
      let sideEffect = 0;

      const processResult = flow(
        (n: number) => ok(n),
        (r) => tapResult(r, (n) => (sideEffect = n)),
        (r) => mapResult(r, (n) => n * 2),
      );

      const result = processResult(5);
      expect(isOk(result)).toBe(true);
      expect(unwrapResult(result)).toBe(10);
      expect(sideEffect).toBe(5);
    });

    test('should handle conversions between Option and Result', () => {
      const processValue = flow(
        (n: number) => ok(n),
        (r) => mapResult(r, (n) => n * 2),
        (r) => (isOk(r) ? some(unwrapResult(r)) : none<number>()),
        (o) => mapOption(o, (n: number) => n.toString()),
      );

      const result = processValue(5);
      expect(isSome(result)).toBe(true);
      expect(unwrapOption(result)).toBe('10');
    });

    test('should handle conversions from errors properly', () => {
      const processValue = flow(
        (message: string) => err(message),
        (r) => (isOk(r) ? some(unwrapResult(r)) : none<number>()),
        (o) => mapOption(o, (n: number) => n * 2),
      );

      const result = processValue('some error');
      expect(isNone(result)).toBe(true);
    });
  });

  describe('with async operations', () => {
    test('should handle async operations with fromPromise', async () => {
      const asyncFunction = async (n: number) => n * 2;

      const processAsync = flow(
        (n: number) => asyncFunction(n),
        (promise) => fromPromise(promise),
      );

      const resultPromise = processAsync(5);
      const result = await resultPromise;
      expect(isOk(result)).toBe(true);
      expect(unwrapResult(result)).toBe(10);
    });

    test('should handle errors in async operations', async () => {
      const asyncFunction = async () => {
        throw new Error('Async error');
      };

      const processAsync = flow(
        () => asyncFunction(),
        (promise) => fromPromise(promise),
      );

      const resultPromise = processAsync();
      const result = await resultPromise;
      expect(isErr(result)).toBe(true);
    });
  });

  test('should handle single function', () => {
    const double = flow((n: number) => n * 2);
    expect(double(5)).toBe(10);
  });
});
