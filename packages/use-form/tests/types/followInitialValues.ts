import * as S from '@railway-ts/pipelines/schema';

import { useForm } from '../../src';

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
