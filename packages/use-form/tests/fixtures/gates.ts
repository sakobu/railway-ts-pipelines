import { mock } from 'bun:test';

import { ok, type Result } from '@railway-ts/pipelines/result';

import type { MaybeAsyncValidator, ValidationError } from '@railway-ts/pipelines/schema';

/** Waits one macrotask, so callbacks of promises already settled run before the test continues. */
export const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * A schema validator whose checks stay pending until the test settles them, in call order.
 *
 * @template TValues - The values a check resolves to
 */
export const createGatedValidator = <TValues>() => {
  const pending: PromiseWithResolvers<Result<TValues, ValidationError[]>>[] = [];
  const gated: MaybeAsyncValidator<unknown, TValues> = () => {
    const check = Promise.withResolvers<Result<TValues, ValidationError[]>>();
    pending.push(check);
    return check.promise;
  };
  return { pending, gated };
};

/** A field validator whose calls stay pending until the test settles them, in call order. */
export const createGatedFieldValidator = () => {
  const calls: PromiseWithResolvers<string | undefined>[] = [];
  const gate = () => {
    const call = Promise.withResolvers<string | undefined>();
    calls.push(call);
    return call.promise;
  };
  return { calls, gate };
};

/**
 * An `onSubmit` whose calls stay pending until the test settles them, in call order. A call settled with
 * nothing saves, and returns `ok` with the submitted values. One settled with an `ok` or an `err` returns it.
 *
 * @template TValues - The form values
 */
export const createGatedOnSubmit = <TValues>() => {
  const saves: PromiseWithResolvers<Result<TValues, ValidationError[]> | undefined>[] = [];
  const onSubmit = mock(async (values: TValues): Promise<Result<TValues, ValidationError[]>> => {
    const save = Promise.withResolvers<Result<TValues, ValidationError[]> | undefined>();
    saves.push(save);
    return (await save.promise) ?? ok(values);
  });
  return { saves, onSubmit };
};
