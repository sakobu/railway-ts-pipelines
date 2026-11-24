import { err, type Result } from '@railway-ts/pipelines/result';
import * as S from '@railway-ts/pipelines/schema';

import { useForm } from '../../src';

import type { ResetKey, UseFormReturn } from '../../src';

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

type Saved = { id: string; name: string; updatedAt: string };
declare const saveRecord: (values: Flat) => Promise<Result<Saved, S.ValidationError[]>>;

export function useSavedValues() {
  // savedValues gets onSubmit's ok value, and returns the form values the save stored
  const form = useForm(flat, {
    initialValues: { name: '' },
    onSubmit: saveRecord,
    savedValues: (saved) => ({ name: saved.name }),
  });
  expectTrue<Equal<Awaited<ReturnType<typeof form.handleSubmit>>, Result<Saved, S.ValidationError[]>>>();

  useForm(flat, {
    initialValues: { name: '' },
    onSubmit: saveRecord,
    // @ts-expect-error it returns the form values
    savedValues: (saved) => saved.id,
  });

  // A named mapper, as an edit form passes, beside an onSubmit with an err path: onSubmit's ok value still sets TResult
  const toFlat = (record?: Saved): Flat => ({ name: record?.name ?? '' });
  const named = useForm(flat, {
    initialValues: { name: '' },
    onSubmit: async (values) => {
      if (values.name === '') return err([{ path: ['name'], message: 'Required' }]);
      return saveRecord(values);
    },
    savedValues: toFlat,
  });
  expectTrue<Equal<Awaited<ReturnType<typeof named.handleSubmit>>, Result<Saved, S.ValidationError[]>>>();
}

export function useMessages() {
  // Replaces the built-in submit errors, for wording or translation
  useForm(flat, {
    initialValues: { name: '' },
    messages: { submitFailed: 'Algo salió mal.', changedWhileSaving: 'Otra persona cambió este registro.' },
  });

  useForm(flat, {
    initialValues: { name: '' },
    // @ts-expect-error only the built-in submit errors can be replaced
    messages: { required: 'Required' },
  });
}

// A wrapper that forwards resetKey names its type
export function useRecordForm({ id }: { id: ResetKey }) {
  return useForm(flat, { initialValues: { name: '' }, resetKey: id });
}
