import * as S from '@railway-ts/pipelines/schema';

import { useForm, withDeps, type ExtractFieldPaths } from '../../src';

import type { FieldTypeAtPath } from '../../src/types';

const schema = S.object({
  slug: S.required(S.string()),
  workspaceId: S.required(S.number()),
  address: S.optional(S.object({ city: S.required(S.string()), zip: S.required(S.string()) })),
  billing: S.required(S.object({ country: S.required(S.string()) })),
  pair: S.required(S.tuple([S.string(), S.number()] as const)),
});
type V = S.InferSchemaType<typeof schema>;
declare const init: V;

type Nullable = { owner: { name: string } | null; tags: readonly [string, number] };

// A path through an optional or nullable object can hold undefined: the form reads it as missing
export const city: FieldTypeAtPath<V, 'address.city'> = undefined;
export const ownerName: FieldTypeAtPath<Nullable, 'owner.name'> = undefined;
// A path through required objects can't
// @ts-expect-error -- billing is required, so billing.country is a string
export const country: FieldTypeAtPath<V, 'billing.country'> = undefined;
// A tuple's items are typed by index
export const first: FieldTypeAtPath<V, 'pair.0'> = 'a';
export const second: FieldTypeAtPath<V, 'pair.1'> = 1;
export const tagIndexes: ExtractFieldPaths<Nullable> = 'tags.1';
// @ts-expect-error -- the tuple has two items
export const outOfRange: ExtractFieldPaths<Nullable> = 'tags.7';

/** Each value a validator gets is typed as the form can hold it. */
export function useHonest() {
  return useForm(schema, {
    initialValues: init,
    fieldValidators: {
      // @ts-expect-error -- city can be undefined while address is missing
      'address.city': (value) => (value.trim() ? undefined : 'x'),
      'address.zip': (value) => (value === undefined || value.length === 5 ? undefined : 'x'),
      'pair.0': withDeps(['workspaceId'], (value, { workspaceId }) => (value.length > workspaceId ? undefined : 'x')),
      slug: withDeps(['address.city', 'billing.country'], (value, deps) => {
        const c: string | undefined = deps['address.city'];
        const b: string = deps['billing.country'];
        // @ts-expect-error -- address is optional, so its city can be undefined
        const strict: string = deps['address.city'];
        return value && b && strict && c?.trim() ? undefined : 'x';
      }),
    },
  });
}
