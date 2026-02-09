import { describe, test, expect } from 'bun:test';

import { pipeAsync } from '@/composition';
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

describe('pipeAsync', () => {
  test('sync-only pipeline — result is still a Promise', async () => {
    const result = pipeAsync(
      5,
      (x) => x * 2,
      (x) => x + 1,
    );

    expect(result).toBeInstanceOf(Promise);
    expect(await result).toBe(11);
  });

  test('async-only pipeline — awaits between steps', async () => {
    const result = await pipeAsync(
      5,
      async (x) => x * 2,
      async (x) => x + 1,
    );

    expect(result).toBe(11);
  });

  test('mixed sync/async pipeline — interleaved', async () => {
    const result = await pipeAsync(
      5,
      (x) => x * 2,
      async (x) => x + 1,
      (x) => x.toString(),
    );

    expect(result).toBe('11');
  });

  test('with Result types — pipeAsync(ok(5), flatMapWith(asyncFn), mapWith(syncFn))', async () => {
    const result = await pipeAsync(
      ok(5),
      flatMapWithResult(async (n) => ok(n * 2)),
      mapWithResult((n) => n.toString()),
    );

    expect(isOk(result)).toBe(true);
    expect(unwrapResult(result)).toBe('10');
  });

  test('initial value is a Promise', async () => {
    const result = await pipeAsync(
      Promise.resolve(ok(5)),
      flatMapWithResult(async (n) => ok(n * 2)),
      mapWithResult((n) => n.toString()),
    );

    expect(isOk(result)).toBe(true);
    expect(unwrapResult(result)).toBe('10');
  });

  test('single function — returns Promise<number>', async () => {
    const result = pipeAsync(5, (x) => x * 2);

    expect(result).toBeInstanceOf(Promise);
    expect(await result).toBe(10);
  });

  test('error short-circuit — async flatMapWith on Err skips the async call', async () => {
    let called = false;

    const boom: Result<number, string> = err('boom');
    const result = await pipeAsync(
      boom,
      flatMapWithResult(async (n: number) => {
        called = true;
        return ok(n * 2);
      }),
      mapWithResult((n) => n.toString()),
    );

    expect(called).toBe(false);
    expect(isErr(result)).toBe(true);
  });

  test('handles long pipelines', async () => {
    const result = await pipeAsync(
      1,
      (x) => x + 1,
      async (x) => x + 1,
      (x) => x + 1,
      async (x) => x + 1,
      (x) => x + 1,
      async (x) => x + 1,
      (x) => x + 1,
      async (x) => x + 1,
      (x) => x + 1,
    );

    expect(result).toBe(10);
  });
});
