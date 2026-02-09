import { describe, test, expect } from 'bun:test';

import { pipe } from '@/composition';
import {
  ok,
  err,
  type Result,
  mapWith,
  flatMapWith,
  mapErrWith,
  filterWith,
  tapWith,
  tapErrWith,
  orElse,
  orElseWith,
} from '@/result';

describe('Result curried helpers', () => {
  describe('mapWith', () => {
    test('transforms Ok value', () => {
      const double = mapWith((x: number) => x * 2);
      expect(double(ok(5))).toEqual(ok(10));
    });

    test('passes through Err', () => {
      const double = mapWith((x: number) => x * 2);
      const input: Result<number, string> = err('fail');
      expect(double(input)).toEqual(err('fail'));
    });
  });

  describe('flatMapWith (sync)', () => {
    test('chains on Ok', () => {
      const toStr = flatMapWith((x: number) => ok<string, string>(String(x)));
      expect(toStr(ok(42))).toEqual(ok('42'));
    });

    test('passes through Err', () => {
      const toStr = flatMapWith((x: number) => ok<string, string>(String(x)));
      expect(toStr(err('fail'))).toEqual(err('fail'));
    });
  });

  describe('flatMapWith (async)', () => {
    test('chains async fn on Ok', async () => {
      const asyncDouble = flatMapWith(async (x: number) => ok<number, string>(x * 2));
      const result = await asyncDouble(ok(5));
      expect(result).toEqual(ok(10));
    });

    test('passes through Err', () => {
      const asyncDouble = flatMapWith(async (x: number) => ok<number, string>(x * 2));
      const result = asyncDouble(err('fail'));
      // Err short-circuits synchronously even with async overload
      expect(result as unknown).toEqual(err('fail'));
    });
  });

  describe('mapErrWith', () => {
    test('transforms Err', () => {
      const wrap = mapErrWith((e: string) => new Error(e));
      expect(wrap(err('boom'))).toEqual(err(new Error('boom')));
    });

    test('passes through Ok', () => {
      const wrap = mapErrWith((e: string) => new Error(e));
      const input: Result<number, string> = ok(42);
      expect(wrap(input)).toEqual(ok(42));
    });
  });

  describe('filterWith', () => {
    test('keeps value matching predicate', () => {
      const positive = filterWith((x: number) => x > 0, 'not positive');
      expect(positive(ok(5))).toEqual(ok(5));
    });

    test('returns error on mismatch', () => {
      const positive = filterWith((x: number) => x > 0, 'not positive');
      expect(positive(ok(-1))).toEqual(err('not positive'));
    });

    test('passes through Err', () => {
      const positive = filterWith((x: number) => x > 0, 'not positive');
      expect(positive(err('already bad'))).toEqual(err('not positive'));
    });
  });

  describe('tapWith (sync)', () => {
    test('executes side effect on Ok', () => {
      let called = false;
      const doTap = tapWith<number, string>((x: number) => {
        called = true;
        expect(x).toBe(5);
      });
      const result = doTap(ok(5));
      expect(called).toBe(true);
      expect(result).toEqual(ok(5));
    });

    test('no-ops on Err', () => {
      let called = false;
      const doTap = tapWith<number, string>(() => {
        called = true;
      });
      const result = doTap(err('fail'));
      expect(called).toBe(false);
      expect(result).toEqual(err('fail'));
    });
  });

  describe('tapWith (async)', () => {
    test('executes async side effect on Ok', async () => {
      let called = false;
      const doTap = tapWith<number, string>(async (x: number) => {
        called = true;
        expect(x).toBe(5);
      });
      const result = await doTap(ok(5));
      expect(called).toBe(true);
      expect(result).toEqual(ok(5));
    });

    test('returns original on Err without awaiting', () => {
      const doTap = tapWith<number, string>(async () => {});
      const result = doTap(err('fail'));
      // Err short-circuits synchronously even with async overload
      expect(result as unknown).toEqual(err('fail'));
    });
  });

  describe('tapErrWith', () => {
    test('executes side effect on Err', () => {
      let captured = '';
      const doTap = tapErrWith((e: string) => {
        captured = e;
      });
      const result = doTap(err('boom'));
      expect(captured).toBe('boom');
      expect(result).toEqual(err('boom'));
    });

    test('no-ops on Ok', () => {
      let called = false;
      const doTap = tapErrWith(() => {
        called = true;
      });
      const input: Result<number, string> = ok(42);
      const result = doTap(input);
      expect(called).toBe(false);
      expect(result).toEqual(ok(42));
    });
  });

  describe('orElse', () => {
    test('returns original on Ok', () => {
      expect(orElse(ok(42), () => ok(0))).toEqual(ok(42));
    });

    test('calls fn with error on Err', () => {
      expect(orElse(err('boom'), (e: string) => ok(e.length))).toEqual(ok(4));
    });
  });

  describe('orElseWith', () => {
    test('returns original on Ok', () => {
      const recover = orElseWith<number, string>(() => ok(0));
      expect(recover(ok(42))).toEqual(ok(42));
    });

    test('calls fn with error on Err', () => {
      const recover = orElseWith<number, string>((e) => ok(e.length));
      expect(recover(err('boom'))).toEqual(ok(4));
    });
  });

  describe('composition with pipe', () => {
    test('chains multiple curried helpers', () => {
      const result = pipe(
        ok<number, string>(5),
        mapWith((x: number) => x * 2),
        flatMapWith((x: number) => ok<number, string>(x + 1)),
      );
      expect(result).toEqual(ok(11));
    });

    test('short-circuits on Err', () => {
      const result = pipe(
        err('fail') as Result<number, string>,
        mapWith((x: number) => x * 2),
        flatMapWith((x: number) => ok<number, string>(x + 1)),
      );
      expect(result).toEqual(err('fail'));
    });
  });
});
