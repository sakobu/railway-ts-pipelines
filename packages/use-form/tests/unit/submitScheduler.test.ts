import { describe, test, expect, mock } from 'bun:test';

import { createSubmitScheduler } from '../../src/submitScheduler';

type Values = { name: string };

/** A `run` whose submissions stay pending until the test settles them, in call order. */
const createDeferredRun = () => {
  const pending: Array<PromiseWithResolvers<string>> = [];
  const run = mock((_values: Values) => {
    const submission = Promise.withResolvers<string>();
    pending.push(submission);
    return submission.promise;
  });
  return { run, pending };
};

describe('createSubmitScheduler', () => {
  test('starts a run with the current values when idle', async () => {
    const scheduler = createSubmitScheduler<Values, string>();
    const { run, pending } = createDeferredRun();

    const outcome = scheduler.submit(() => ({ name: 'a' }), run);

    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith({ name: 'a' });

    pending[0]!.resolve('saved');
    expect(await outcome).toBe('saved');
  });

  test('a call with the same values while running returns the running promise', async () => {
    const scheduler = createSubmitScheduler<Values, string>();
    const { run, pending } = createDeferredRun();

    const first = scheduler.submit(() => ({ name: 'a' }), run);
    // A new object with the same content, as a re-render would produce
    const second = scheduler.submit(() => ({ name: 'a' }), run);

    expect(second).toBe(first);
    expect(run).toHaveBeenCalledTimes(1);

    pending[0]!.resolve('saved');
    expect(await second).toBe('saved');
  });

  test('a call with changed values waits for the running submission, then runs with the values at that moment', async () => {
    const scheduler = createSubmitScheduler<Values, string>();
    const { run, pending } = createDeferredRun();
    let values: Values = { name: 'a' };
    const getValues = () => values;

    const first = scheduler.submit(getValues, run);
    values = { name: 'ab' };
    const second = scheduler.submit(getValues, run);
    // Edited again after the call: the follow-up reads the values when it starts
    values = { name: 'abc' };

    expect(run).toHaveBeenCalledTimes(1);

    pending[0]!.resolve('first');
    await first;

    expect(run).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenLastCalledWith({ name: 'abc' });

    pending[1]!.resolve('second');
    expect(await second).toBe('second');
  });

  test('calls while a follow-up waits share it, and it uses the most recent run', async () => {
    const scheduler = createSubmitScheduler<Values, string>();
    const running = createDeferredRun();
    const earlier = createDeferredRun();
    const later = createDeferredRun();

    const first = scheduler.submit(() => ({ name: 'a' }), running.run);
    const second = scheduler.submit(() => ({ name: 'ab' }), earlier.run);
    const third = scheduler.submit(() => ({ name: 'abc' }), later.run);

    expect(third).toBe(second);

    running.pending[0]!.resolve('first');
    await first;

    expect(earlier.run).not.toHaveBeenCalled();
    expect(later.run).toHaveBeenCalledTimes(1);
    expect(later.run).toHaveBeenCalledWith({ name: 'abc' });

    later.pending[0]!.resolve('follow-up');
    expect(await second).toBe('follow-up');
  });

  test('a call after a submission settled starts a new one', async () => {
    const scheduler = createSubmitScheduler<Values, string>();
    const { run, pending } = createDeferredRun();

    const first = scheduler.submit(() => ({ name: 'a' }), run);
    pending[0]!.resolve('first');
    await first;

    const second = scheduler.submit(() => ({ name: 'a' }), run);

    expect(second).not.toBe(first);
    expect(run).toHaveBeenCalledTimes(2);

    pending[1]!.resolve('second');
    expect(await second).toBe('second');
  });

  test('a rejected submission still starts its follow-up, and the next call starts fresh', async () => {
    const scheduler = createSubmitScheduler<Values, string>();
    const { run, pending } = createDeferredRun();

    const first = scheduler.submit(() => ({ name: 'a' }), run);
    const second = scheduler.submit(() => ({ name: 'ab' }), run);

    const firstFailure = new Error('first failed');
    pending[0]!.reject(firstFailure);
    expect(await first.catch((error: unknown) => error)).toBe(firstFailure);

    expect(run).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenLastCalledWith({ name: 'ab' });

    const followUpFailure = new Error('follow-up failed');
    pending[1]!.reject(followUpFailure);
    expect(await second.catch((error: unknown) => error)).toBe(followUpFailure);

    const third = scheduler.submit(() => ({ name: 'ab' }), run);

    expect(third).not.toBe(second);
    expect(run).toHaveBeenCalledTimes(3);

    pending[2]!.resolve('third');
    expect(await third).toBe('third');
  });

  test('retire makes a waiting follow-up submit the given values', async () => {
    const scheduler = createSubmitScheduler<{ n: number }, string>();
    const first = Promise.withResolvers<string>();
    const run = mock((v: { n: number }) => (v.n === 1 ? first.promise : Promise.resolve('second')));
    let live = { n: 1 };
    void scheduler.submit(() => live, run);
    live = { n: 2 };
    const followUp = scheduler.submit(() => live, run);
    scheduler.retire({ n: 2 });
    live = { n: 3 };
    first.resolve('first');
    expect(await followUp).toBe('second');
    expect(run.mock.calls[1]?.[0]).toEqual({ n: 2 });
  });
});
