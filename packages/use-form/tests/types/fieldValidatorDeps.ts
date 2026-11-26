import * as S from '@railway-ts/pipelines/schema';

import { useForm, withDeps, type ExtractFieldPaths } from '../../src';

import type { FormOptions } from '../../src/types';

const schema = S.object({
  name: S.required(S.string()),
  workspaceId: S.required(S.number()),
  slug: S.required(S.string()),
  address: S.required(S.object({ city: S.required(S.string()), zip: S.required(S.string()) })),
});
type V = S.InferSchemaType<typeof schema>;
declare const init: V;
declare const on: boolean;

/** Each listed value comes in typed, next to a plain function. */
export function useInferred() {
  return useForm(schema, {
    initialValues: init,
    fieldValidators: {
      name: (value) => (value.length > 0 ? undefined : 'x'),
      slug: withDeps(['workspaceId', 'address.city'], (value, { workspaceId, 'address.city': city }) => {
        const id: number = workspaceId;
        const c: string = city;
        const v: string = value;
        return id && c && v ? undefined : 'taken';
      }),
    },
  });
}

/** What the types reject. Each error lands on the line below its directive. */
export function useRejected() {
  useForm(schema, {
    initialValues: init,
    fieldValidators: {
      // @ts-expect-error -- name isn't listed
      slug: withDeps(['workspaceId'], (_v, { name }) => (name === undefined ? 'x' : undefined)),
    },
  });
  useForm(schema, {
    initialValues: init,
    fieldValidators: {
      // @ts-expect-error -- a listed path must be a field
      slug: withDeps(['nope'], () => undefined),
    },
  });
  useForm(schema, {
    initialValues: init,
    fieldValidators: {
      // @ts-expect-error -- a key must be a field
      nope: () => undefined,
    },
  });
  useForm(schema, {
    initialValues: init,
    fieldValidators: {
      // @ts-expect-error -- a plain function gets only its value
      name: (_v: string, _values: V) => undefined,
    },
  });
  useForm(schema, {
    initialValues: init,
    fieldValidators: {
      // @ts-expect-error -- a validator that lists fields is made with withDeps
      slug: { deps: ['workspaceId'], validate: () => undefined },
    },
  });
}

const listed = ['workspaceId'] as const;

/** Shapes that compile, with no cast. */
export function useAccepted() {
  useForm(schema, { initialValues: init, fieldValidators: { name: undefined } });
  useForm(schema, { initialValues: init });
  useForm(schema, { initialValues: init, fieldValidators: { slug: withDeps([], () => undefined) } });
  useForm(schema, {
    initialValues: init,
    fieldValidators: { slug: withDeps(listed, (_v, { workspaceId }) => (workspaceId > 0 ? undefined : 'x')) },
  });
  // A ternary whose branches have different keys, as the switch-off tests write
  useForm(schema, {
    initialValues: init,
    fieldValidators: on
      ? {
          name: () => undefined,
          slug: withDeps(['workspaceId'], (_v, { workspaceId }) => (workspaceId > 0 ? undefined : 'x')),
        }
      : { name: () => undefined },
  });
  // Switched off at its key
  useForm(schema, {
    initialValues: init,
    fieldValidators: {
      slug: on ? withDeps(['workspaceId'], (_v, { workspaceId }) => (workspaceId > 0 ? undefined : 'x')) : undefined,
    },
  });
  // A map built at runtime
  useForm(schema, { initialValues: init, fieldValidators: Object.fromEntries([['__proto__', () => undefined]]) });
}

/** Explicit type arguments keep exact types. */
export function useExplicit() {
  useForm<V>(schema, {
    initialValues: init,
    fieldValidators: {
      slug: withDeps(['workspaceId'], (_v, { workspaceId }) => {
        const id: number = workspaceId;
        return id > 0 ? undefined : 'x';
      }),
    },
  });
  useForm<V, { id: string }>(schema, {
    initialValues: init,
    fieldValidators: {
      slug: withDeps(['workspaceId'], (_v, { workspaceId }) => (workspaceId > 0 ? undefined : 'x')),
    },
  });
  useForm<V>(schema, {
    initialValues: init,
    fieldValidators: {
      // @ts-expect-error -- a listed path must be a field
      slug: withDeps(['nope'], () => undefined),
    },
  });
}

const someListed: ExtractFieldPaths<V>[] = on ? ['workspaceId'] : [];

/** A list that isn't a tuple holds paths known only when it runs, so each listed value may be missing. */
export function useUntupled() {
  useForm(schema, {
    initialValues: init,
    fieldValidators: {
      slug: withDeps(someListed, (_v, { workspaceId }) => {
        // @ts-expect-error -- the list may not hold workspaceId
        const id: number = workspaceId;
        return id > 0 ? undefined : 'x';
      }),
    },
  });
  useForm(schema, {
    initialValues: init,
    fieldValidators: {
      slug: withDeps(someListed, (_v, { workspaceId }) =>
        workspaceId === undefined || workspaceId > 0 ? undefined : 'x',
      ),
    },
  });
}

// Options typed FormOptions<V> and spread into useForm, as autoSave.test.tsx does
const options: Partial<FormOptions<V>> = {
  fieldValidators: {
    slug: withDeps(['workspaceId'], (_v, { workspaceId }) => {
      const id: number = workspaceId;
      return id > 0 ? undefined : 'x';
    }),
  },
};
export function useSpread() {
  return useForm(schema, { initialValues: init, ...options });
}
