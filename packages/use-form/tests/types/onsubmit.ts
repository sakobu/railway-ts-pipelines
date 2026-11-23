import { err, isErr, ok, type Result } from '@railway-ts/pipelines/result';
import * as S from '@railway-ts/pipelines/schema';

import { useForm } from '../../src';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

const expectTrue = <T extends true>(): T | undefined => undefined;

/** The value a form's `handleSubmit` resolves to on `ok`. */
type OkOf<F extends { handleSubmit: () => Promise<Result<unknown, S.ValidationError[]>> }> =
  Awaited<ReturnType<F['handleSubmit']>> extends Result<infer U, S.ValidationError[]> ? U : never;

const flat = S.object({ name: S.required(S.string()), age: S.optional(S.number()) });

type Flat = S.InferSchemaType<typeof flat>;
type User = { id: string };

declare const save: (v: Flat) => Promise<void>;
declare const createUser: (v: Flat) => Promise<Result<User, S.ValidationError[]>>;

export function useOnSubmitCases() {
  // An onSubmit that returns nothing, or no onSubmit: handleSubmit resolves to the values.
  const asyncVoidForm = useForm(flat, {
    initialValues: { name: '' },
    onSubmit: async (v) => {
      await save(v);
    },
  });
  expectTrue<Equal<OkOf<typeof asyncVoidForm>, Flat>>();

  const syncVoidForm = useForm(flat, {
    initialValues: { name: '' },
    onSubmit: (v) => {
      void save(v);
    },
  });
  expectTrue<Equal<OkOf<typeof syncVoidForm>, Flat>>();

  const noOnSubmitForm = useForm(flat, { initialValues: { name: '' } });
  expectTrue<Equal<OkOf<typeof noOnSubmitForm>, Flat>>();

  const explicitVoidForm = useForm<Flat>(flat, { initialValues: { name: '' }, onSubmit: async () => {} });
  expectTrue<Equal<OkOf<typeof explicitVoidForm>, Flat>>();

  const mixedValuesForm = useForm(flat, {
    initialValues: { name: '' },
    onSubmit: (v) => {
      if (v.name === 'taken') return err([{ path: ['name'], message: 'Taken' }]);
      return ok(v);
    },
  });
  expectTrue<Equal<OkOf<typeof mixedValuesForm>, Flat>>();

  // An onSubmit that returns a Result: handleSubmit resolves to its ok value.
  const userForm = useForm(flat, { initialValues: { name: '' }, onSubmit: (v) => createUser(v) });
  expectTrue<Equal<OkOf<typeof userForm>, User>>();

  const mixedUserForm = useForm(flat, {
    initialValues: { name: '' },
    onSubmit: async (v) => {
      if (v.name === '') return err([{ path: ['name'], message: 'Required' }]);
      const r = await createUser(v);
      if (isErr(r)) return r;
      const { id } = r.value;
      return ok({ id });
    },
  });
  expectTrue<Equal<OkOf<typeof mixedUserForm>, User>>();

  const explicitUserForm = useForm<Flat, User>(flat, { initialValues: { name: '' }, onSubmit: createUser });
  expectTrue<Equal<OkOf<typeof explicitUserForm>, User>>();

  // onSubmit's values are typed from the schema.
  useForm(flat, {
    initialValues: { name: '' },
    onSubmit: (v) => {
      v.name.toUpperCase();
    },
  });

  // The form can be used inside its own onSubmit.
  const form = useForm(flat, {
    initialValues: { name: '' },
    onSubmit: () => {
      form.resetForm();
    },
  });

  // onSubmit returns a Result on every path, or nothing on every path.
  useForm(flat, {
    initialValues: { name: '' },
    // @ts-expect-error err on one path and nothing on another
    onSubmit: (v) => {
      if (v.name === '') return err([{ path: ['name'], message: 'Required' }]);
    },
  });

  useForm(flat, {
    initialValues: { name: '' },
    // @ts-expect-error err on one path and nothing on another, async
    onSubmit: async (v) => {
      await save(v);
      if (v.name === '') return err([{ path: ['name'], message: 'Required' }]);
    },
  });

  useForm(flat, {
    initialValues: { name: '' },
    // @ts-expect-error ok on one path and nothing on another
    onSubmit: (v) => {
      if (v.name !== '') return ok(v);
    },
  });

  // useForm<T> fixes TResult to T, so an onSubmit that returns another value needs useForm<T, U>.
  // @ts-expect-error TResult is Flat when only TValues is given
  useForm<Flat>(flat, { initialValues: { name: '' }, onSubmit: (v) => createUser(v) });
}
