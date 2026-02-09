import { describe, test, expect } from 'bun:test';

import { pipe } from '@/composition';
import { type Option, some, none, mapWith, flatMapWith, filterWith, tapWith } from '@/option';

describe('Option curried helpers', () => {
  describe('mapWith', () => {
    test('transforms Some value', () => {
      const double = mapWith((x: number) => x * 2);
      expect(double(some(5))).toEqual(some(10));
    });

    test('passes through None', () => {
      const double = mapWith((x: number) => x * 2);
      expect(double(none())).toEqual(none());
    });
  });

  describe('flatMapWith (sync)', () => {
    test('chains on Some', () => {
      const toStr = flatMapWith((x: number) => some(String(x)));
      expect(toStr(some(42))).toEqual(some('42'));
    });

    test('passes through None', () => {
      const toStr = flatMapWith((x: number) => some(String(x)));
      expect(toStr(none())).toEqual(none());
    });
  });

  describe('flatMapWith (async)', () => {
    test('chains async fn on Some', async () => {
      const asyncDouble = flatMapWith(async (x: number) => some(x * 2));
      const result = await asyncDouble(some(5));
      expect(result).toEqual(some(10));
    });

    test('passes through None', () => {
      const asyncDouble = flatMapWith(async (x: number) => some(x * 2));
      const input: Option<number> = none();
      const result = asyncDouble(input);
      // None short-circuits synchronously even with async overload
      expect(result as unknown).toEqual(none());
    });
  });

  describe('filterWith', () => {
    test('keeps value matching predicate', () => {
      const positive = filterWith((x: number) => x > 0);
      expect(positive(some(5))).toEqual(some(5));
    });

    test('returns None on mismatch', () => {
      const positive = filterWith((x: number) => x > 0);
      expect(positive(some(-1))).toEqual(none());
    });

    test('passes through None', () => {
      const positive = filterWith((x: number) => x > 0);
      expect(positive(none())).toEqual(none());
    });
  });

  describe('tapWith (sync)', () => {
    test('executes side effect on Some', () => {
      let called = false;
      const doTap = tapWith<number>((x: number) => {
        called = true;
        expect(x).toBe(5);
      });
      const result = doTap(some(5));
      expect(called).toBe(true);
      expect(result).toEqual(some(5));
    });

    test('no-ops on None', () => {
      let called = false;
      const doTap = tapWith<number>(() => {
        called = true;
      });
      const result = doTap(none());
      expect(called).toBe(false);
      expect(result).toEqual(none());
    });
  });

  describe('tapWith (async)', () => {
    test('executes async side effect on Some', async () => {
      let called = false;
      const doTap = tapWith<number>(async (x: number) => {
        called = true;
        expect(x).toBe(5);
      });
      const result = await doTap(some(5));
      expect(called).toBe(true);
      expect(result).toEqual(some(5));
    });

    test('returns original on None without awaiting', () => {
      const doTap = tapWith<number>(async () => {});
      const input: Option<number> = none();
      const result = doTap(input);
      // None short-circuits synchronously even with async overload
      expect(result as unknown).toEqual(none());
    });
  });

  describe('composition with pipe', () => {
    test('chains multiple curried helpers', () => {
      const result = pipe(
        some(5),
        mapWith((x: number) => x * 2),
        flatMapWith((x: number) => some(x + 1)),
      );
      expect(result).toEqual(some(11));
    });

    test('short-circuits on None', () => {
      const result = pipe(
        none() as Option<number>,
        mapWith((x: number) => x * 2),
        flatMapWith((x: number) => some(x + 1)),
      );
      expect(result).toEqual(none());
    });
  });
});
