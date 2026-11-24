import * as S from '@railway-ts/pipelines/schema';

import { useForm } from '../../src';

import type { UseFormReturn } from '../../src';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

const expectTrue = <T extends true>(): T | undefined => undefined;

const flat = S.object({ name: S.required(S.string()), age: S.optional(S.number()) });

type Flat = S.InferSchemaType<typeof flat>;

export function useFollowCases() {
  // resetKey takes the loaded record's id, or nothing
  useForm(flat, { initialValues: { name: '' }, resetKey: 'id-1' });
  useForm(flat, { initialValues: { name: '' }, resetKey: 42 });
  useForm(flat, { initialValues: { name: '' }, resetKey: undefined });

  useForm(flat, {
    initialValues: { name: '' },
    // @ts-expect-error a record is not a reset key; pass its id
    resetKey: { id: 1 },
  });

  expectTrue<Equal<ReturnType<typeof useForm<Flat>>['isStale'], boolean>>();
}

// The maps are read-only: an empty one is a shared frozen object, so a write would throw
export function writeMaps(form: UseFormReturn<Flat>) {
  // @ts-expect-error touched is read-only
  form.touched.name = true;
  // @ts-expect-error errors is read-only
  form.errors.name = 'Required';
  // @ts-expect-error clientErrors is read-only
  form.clientErrors.name = 'Required';
  // @ts-expect-error serverErrors is read-only
  form.serverErrors.name = 'Taken';
  // @ts-expect-error fieldErrors is read-only
  form.fieldErrors.name = 'Taken';
  // @ts-expect-error validatingFields is read-only
  form.validatingFields.name = true;

  // Reading them, or passing them on, still works
  const touched: Record<string, boolean> = form.touched;
  return touched.name === true && form.errors.name !== undefined;
}
