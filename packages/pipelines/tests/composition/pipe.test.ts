import { describe, test, expect } from 'bun:test';

import { pipe } from '@/composition';
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

describe('pipe', () => {
  test('should pipe values through functions', () => {
    const result = pipe(
      1,
      (x) => x + 1,
      (x) => x * 2,
    );
    expect(result).toBe(4);
  });

  describe('with Option type', () => {
    test('should pipe Some values through map transformations', () => {
      const result = pipe(
        some(5),
        (o) => mapOption(o, (n) => n * 2),
        (o) => mapOption(o, (n) => n.toString()),
      );

      expect(isSome(result)).toBe(true);
      expect(unwrapOption(result)).toBe('10');
    });

    test('should maintain None values through map transformations', () => {
      const result = pipe(
        none<number>(),
        (o) => mapOption(o, (n: number) => n * 2),
        (o) => mapOption(o, (n: number) => n.toString()),
      );

      expect(isNone(result)).toBe(true);
    });

    test('should handle flatMap transformations correctly', () => {
      const result = pipe(
        some(5),
        (o) => flatMapOption(o, (n) => some(n * 2)),
        (o) => flatMapOption(o, (n) => some(n.toString())),
      );

      expect(isSome(result)).toBe(true);
      expect(unwrapOption(result)).toBe('10');
    });

    test('should handle flatMap with None results', () => {
      const result = pipe(
        some(5),
        (o) => flatMapOption(o, (n) => (n > 10 ? some(n) : none<number>())),
        (o) => mapOption(o, (n: number) => n.toString()),
      );

      expect(isNone(result)).toBe(true);
    });

    test('should handle complex Option pipelines with filtering', () => {
      const result = pipe(
        some(5),
        (o) => mapOption(o, (n: number) => n * 3),
        (o) => filterOption(o, (n: number) => n > 10),
        (o) => mapOption(o, (n: number) => n.toString()),
      );

      expect(isSome(result)).toBe(true);
      expect(unwrapOption(result)).toBe('15');
    });

    test('should handle side effects with tap', () => {
      let sideEffect = 0;

      const result = pipe(
        some(5),
        (o) => tapOption(o, (n) => (sideEffect = n)),
        (o) => mapOption(o, (n) => n * 2),
      );

      expect(sideEffect).toBe(5);
      expect(isSome(result)).toBe(true);
      expect(unwrapOption(result)).toBe(10);
    });

    test('should compose multiple Option transformations', () => {
      const double = (n: number) => n * 2;
      const toString = (n: number) => n.toString();
      const isEven = (n: number) => n % 2 === 0;

      const result = pipe(
        some(5),
        (o) => mapOption(o, double), // 10
        (o) => filterOption(o, isEven), // still Some(10)
        (o) => mapOption(o, toString), // "10"
      );

      expect(isSome(result)).toBe(true);
      expect(unwrapOption(result)).toBe('10');
    });
  });

  describe('with Result type', () => {
    test('should pipe Ok values through map transformations', () => {
      const result = pipe(
        ok(5),
        (r) => mapResult(r, (n) => n * 2),
        (r) => mapResult(r, (n) => n.toString()),
      );

      expect(isOk(result)).toBe(true);
      expect(unwrapResult(result)).toBe('10');
    });

    test('should maintain Err values through map transformations', () => {
      const result = pipe(
        err('Initial error'),
        (r) => mapResult(r, (n: number) => n * 2),
        (r) => mapResult(r, (n: number) => n.toString()),
      );

      expect(isErr(result)).toBe(true);
      expect(() => unwrapResult(result)).toThrow('Initial error');
    });

    test('should handle flatMap transformations correctly', () => {
      const result = pipe(
        ok(5),
        (r) => flatMapResult(r, (n) => ok(n * 2)),
        (r) => flatMapResult(r, (n) => ok(n.toString())),
      );

      expect(isOk(result)).toBe(true);
      expect(unwrapResult(result)).toBe('10');
    });

    test('should handle flatMap with Err results', () => {
      const result = pipe(
        ok(5),
        (r) => flatMapResult(r, (n) => (n > 10 ? ok(n) : err('Value too small'))),
        (r) => mapResult(r, (n) => n.toString()),
      );

      expect(isErr(result)).toBe(true);
      expect(() => unwrapResult(result)).toThrow('Value too small');
    });

    test('should handle complex Result pipelines with filtering', () => {
      const result = pipe(
        ok(5),
        (r) => mapResult(r, (n) => n * 3),
        (r) => filterResult(r, (n) => n > 10, 'Value too small'),
        (r) => mapResult(r, (n) => n.toString()),
      );

      expect(isOk(result)).toBe(true);
      expect(unwrapResult(result)).toBe('15');
    });

    test('should handle side effects with tap', () => {
      let sideEffect = 0;

      const result = pipe(
        ok(5),
        (r) => tapResult(r, (n) => (sideEffect = n)),
        (r) => mapResult(r, (n) => n * 2),
      );

      expect(sideEffect).toBe(5);
      expect(isOk(result)).toBe(true);
      expect(unwrapResult(result)).toBe(10);
    });

    test('should compose multiple Result transformations in a railway pattern', () => {
      const validateEven = (n: number) => (n % 2 === 0 ? ok(n) : err('Not even'));

      const validatePositive = (n: number) => (n > 0 ? ok(n) : err('Not positive'));

      const result = pipe(
        ok(10),
        (r) => flatMapResult(r, validateEven),
        (r) => flatMapResult(r, validatePositive),
        (r) => mapResult(r, (n) => n.toString()),
      );

      expect(isOk(result)).toBe(true);
      expect(unwrapResult(result)).toBe('10');
    });

    test('should short-circuit on first error in railway pattern', () => {
      const validateEven = (n: number) => (n % 2 === 0 ? ok(n) : err('Not even'));

      const validatePositive = (n: number) => (n > 0 ? ok(n) : err('Not positive'));

      // This should fail at the first validation
      const result = pipe(
        ok(5), // Odd number
        (r) => flatMapResult(r, validateEven), // Should fail here
        (r) => flatMapResult(r, validatePositive), // Should not run this
        (r) => mapResult(r, (n) => n.toString()),
      );

      expect(isErr(result)).toBe(true);
      expect(() => unwrapResult(result)).toThrow('Not even');
    });
  });

  describe('mixing Option and Result types', () => {
    test('should convert from Option to Result', () => {
      const result = pipe(
        some(5),
        (o) => mapOption(o, (n) => n * 2),
        (o) => (isSome(o) ? ok(unwrapOption(o)) : err('None value')),
        (r) => mapResult(r, (n) => n.toString()),
      );

      expect(isOk(result)).toBe(true);
      expect(unwrapResult(result)).toBe('10');
    });

    test('should convert from Result to Option', () => {
      const result = pipe(
        ok(5),
        (r) => mapResult(r, (n) => n * 2),
        (r) => (isOk(r) ? some(unwrapResult(r)) : none<number>()),
        (o) => mapOption(o, (n: number) => n.toString()),
      );

      expect(isSome(result)).toBe(true);
      expect(unwrapOption(result)).toBe('10');
    });

    test('should handle conversions from errors properly', () => {
      const result = pipe(
        err('some error'),
        (r) => (isOk(r) ? some(unwrapResult(r)) : none<number>()),
        (o) => mapOption(o, (n: number) => n * 2),
      );

      expect(isNone(result)).toBe(true);
    });
  });

  describe('with async operations', () => {
    test('should handle async operations with fromPromise', async () => {
      const asyncFunction = async (n: number) => n * 2;

      const resultPromise = pipe(
        5,
        (n) => asyncFunction(n),
        (promise) => fromPromise(promise),
      );

      const result = await resultPromise;
      expect(isOk(result)).toBe(true);
      expect(unwrapResult(result)).toBe(10);
    });

    test('should handle errors in async operations', async () => {
      const asyncFunction = async () => {
        throw new Error('Async error');
      };

      const resultPromise = pipe(
        5,
        () => asyncFunction(),
        (promise) => fromPromise(promise),
      );

      const result = await resultPromise;
      expect(isErr(result)).toBe(true);
    });
  });
});
