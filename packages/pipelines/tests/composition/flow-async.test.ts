import { describe, test, expect } from 'bun:test';

import { flowAsync } from '@/composition';
import {
  ok,
  err,
  isOk,
  isErr,
  unwrap as unwrapResult,
  mapWith as mapWithResult,
  flatMapWith as flatMapWithResult,
  type Result,
} from '@/result';

describe('flowAsync', () => {
  test('returns a function', () => {
    const fn = flowAsync((x: number) => x * 2);
    expect(typeof fn).toBe('function');
  });

  test('returned function returns a Promise', () => {
    const fn = flowAsync((x: number) => x * 2);
    const result = fn(5);
    expect(result).toBeInstanceOf(Promise);
  });

  test('sync-only composition — works, returns Promise', async () => {
    const fn = flowAsync(
      (x: number) => x * 2,
      (x) => x + 1,
      (x) => x.toString(),
    );

    const result = await fn(5);
    expect(result).toBe('11');
  });

  test('async-only composition — awaits between steps', async () => {
    const fn = flowAsync(
      async (x: number) => x * 2,
      async (x) => x + 1,
      async (x) => x.toString(),
    );

    const result = await fn(5);
    expect(result).toBe('11');
  });

  test('mixed sync/async — interleaved', async () => {
    const fn = flowAsync(
      (x: number) => x * 2,
      async (x) => x + 1,
      (x) => x.toString(),
    );

    const result = await fn(5);
    expect(result).toBe('11');
  });

  test('multi-argument first function', async () => {
    const fn = flowAsync(
      (a: number, b: number) => a + b,
      (x) => x * 2,
    );

    const result = await fn(3, 4);
    expect(result).toBe(14);
  });

  test('with Result types — flowAsync((x) => ok(x), flatMapWith(asyncFn))', async () => {
    const fn = flowAsync(
      (x: number) => ok(x),
      flatMapWithResult(async (n) => ok(n * 2)),
      mapWithResult((n) => n.toString()),
    );

    const result = await fn(5);
    expect(isOk(result)).toBe(true);
    expect(unwrapResult(result)).toBe('10');
  });

  test('single function — returns (x) => Promise<number>', async () => {
    const double = flowAsync((x: number) => x * 2);
    const result = await double(5);
    expect(result).toBe(10);
  });

  test('error short-circuit — flatMapWith on Err skips the async call', async () => {
    let called = false;

    const fn = flowAsync(
      (_x: number): Result<number, string> => err('boom'),
      flatMapWithResult(async (n: number) => {
        called = true;
        return ok(n * 2);
      }),
      mapWithResult((n) => n.toString()),
    );

    const result = await fn(5);
    expect(called).toBe(false);
    expect(isErr(result)).toBe(true);
  });

  test('handles long compositions', async () => {
    const fn = flowAsync(
      (x: number) => x + 1,
      async (x) => x + 1,
      (x) => x + 1,
      async (x) => x + 1,
      (x) => x + 1,
      async (x) => x + 1,
      (x) => x + 1,
      async (x) => x + 1,
      (x) => x + 1,
      async (x) => x + 1,
    );

    const result = await fn(0);
    expect(result).toBe(10);
  });
});
