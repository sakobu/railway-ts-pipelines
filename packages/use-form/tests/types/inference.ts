import * as S from '@railway-ts/pipelines/schema';
import { type } from 'arktype';
import * as v from 'valibot';
import { z } from 'zod';

import { useForm } from '../../src';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

const expectTrue = <T extends true>(): T | undefined => undefined;

const flat = S.object({ name: S.string(), age: S.optional(S.number()) });

const nested = S.object({
  name: S.string(),
  profile: S.object({ bio: S.optional(S.string()), city: S.string() }),
});

const optionalNested = S.object({
  name: S.string(),
  profile: S.optional(S.object({ bio: S.optional(S.string()), city: S.string() })),
});

const arrays = S.object({ tags: S.array(S.string()) });

const arrayOfObjects = S.object({
  items: S.array(S.object({ name: S.string(), note: S.optional(S.string()) })),
});

const deepArrays = S.object({
  items: S.array(
    S.object({
      name: S.string(),
      meta: S.optional(S.object({ label: S.optional(S.string()), rank: S.number() })),
      children: S.array(S.object({ id: S.number(), note: S.optional(S.string()) })),
    }),
  ),
});

const tupled = S.object({ point: S.tuple([S.number(), S.number()]) });

const unioned = S.object({ value: S.union([S.string(), S.number()]) });

const optionalUnion = S.object({
  name: S.string(),
  value: S.optional(S.union([S.string(), S.nullable()])),
});

const discriminated = S.object({
  shape: S.discriminatedUnion('kind', {
    circle: S.object({ kind: S.literal('circle'), radius: S.number() }),
    square: S.object({ kind: S.literal('square'), side: S.number(), label: S.optional(S.string()) }),
  }),
});

const chained = S.chain(
  S.object({ name: S.string(), age: S.optional(S.number()) }),
  S.refineAt<{ name: string; age?: number }>('name', (d) => d.name.length > 0, 'Required'),
);

const chainedAsync = S.chainAsync(
  S.object({ name: S.string(), age: S.optional(S.number()) }),
  S.refineAtAsync<{ name: string; age?: number }>('name', (d) => Promise.resolve(d.name.length > 0), 'Required'),
);

const zodSchema = z.object({
  name: z.string(),
  age: z.number().optional(),
  tags: z.array(z.string()),
});

const valibotSchema = v.object({
  name: v.string(),
  age: v.optional(v.number()),
  tags: v.array(v.string()),
});

const arkSchema = type({ name: 'string', 'age?': 'number', tags: 'string[]' });

export function useInferenceCases() {
  const flatForm = useForm(flat, { initialValues: { name: '' } });
  expectTrue<Equal<typeof flatForm.values, S.InferSchemaType<typeof flat>>>();

  const nestedForm = useForm(nested, { initialValues: { name: '', profile: { city: '' } } });
  expectTrue<Equal<typeof nestedForm.values, S.InferSchemaType<typeof nested>>>();
  nestedForm.getFieldProps('profile.bio');

  const optionalNestedForm = useForm(optionalNested, { initialValues: { name: '' } });
  expectTrue<Equal<typeof optionalNestedForm.values, S.InferSchemaType<typeof optionalNested>>>();

  const arraysForm = useForm(arrays, { initialValues: { tags: [] } });
  expectTrue<Equal<typeof arraysForm.values, S.InferSchemaType<typeof arrays>>>();

  const arrayOfObjectsForm = useForm(arrayOfObjects, { initialValues: { items: [] } });
  expectTrue<Equal<typeof arrayOfObjectsForm.values, S.InferSchemaType<typeof arrayOfObjects>>>();
  arrayOfObjectsForm.arrayHelpers('items').push({ name: '' });

  const deepArraysForm = useForm(deepArrays, { initialValues: { items: [] } });
  expectTrue<Equal<typeof deepArraysForm.values, S.InferSchemaType<typeof deepArrays>>>();

  const tupledForm = useForm(tupled, { initialValues: { point: [0, 0] } });
  expectTrue<Equal<typeof tupledForm.values, S.InferSchemaType<typeof tupled>>>();

  const unionedForm = useForm(unioned, { initialValues: { value: '' } });
  expectTrue<Equal<typeof unionedForm.values, S.InferSchemaType<typeof unioned>>>();

  const optionalUnionForm = useForm(optionalUnion, { initialValues: { name: '' } });
  expectTrue<Equal<typeof optionalUnionForm.values, S.InferSchemaType<typeof optionalUnion>>>();

  const discriminatedForm = useForm(discriminated, {
    initialValues: { shape: { kind: 'circle', radius: 1 } },
  });
  expectTrue<Equal<typeof discriminatedForm.values, S.InferSchemaType<typeof discriminated>>>();

  const chainedForm = useForm(chained, { initialValues: { name: '' } });
  expectTrue<Equal<typeof chainedForm.values, S.InferSchemaType<typeof chained>>>();

  const chainedAsyncForm = useForm(chainedAsync, { initialValues: { name: '' } });
  expectTrue<Equal<typeof chainedAsyncForm.values, S.InferSchemaType<typeof chainedAsync>>>();

  const zodForm = useForm(zodSchema, { initialValues: { name: '', tags: [] } });
  expectTrue<Equal<typeof zodForm.values, z.output<typeof zodSchema>>>();

  const valibotForm = useForm(valibotSchema, { initialValues: { name: '', tags: [] } });
  expectTrue<Equal<typeof valibotForm.values, v.InferOutput<typeof valibotSchema>>>();

  const arkForm = useForm(arkSchema, { initialValues: { name: '', tags: [] } });
  expectTrue<Equal<typeof arkForm.values, typeof arkSchema.infer>>();

  // initialValues from a variable must not widen the inferred values.
  const saved = { name: 'x' };
  const savedForm = useForm(flat, { initialValues: saved });
  expectTrue<Equal<typeof savedForm.values, S.InferSchemaType<typeof flat>>>();

  useForm(flat, {
    // @ts-expect-error unknown key in initialValues
    initialValues: { name: '', nope: 1 },
  });

  useForm(flat, {
    // @ts-expect-error wrong value type in initialValues
    initialValues: { name: 1 },
  });
}
