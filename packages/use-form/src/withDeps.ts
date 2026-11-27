import type { ExtractFieldPaths, FieldTypeAtPath, FieldValidatorAnswer } from './types';

/**
 * Marks a field validator made by {@link withDeps}, so the form tells it from a plain one. From the global registry, so
 * a second copy of the package, as a nested install gives, still finds the mark.
 */
export const listsFields: unique symbol = Symbol.for('@railway-ts/use-form/listsFields');

/** One own property per listed path, typed. Distributes over a union of lists; a non-tuple list gives optional ones. */
export type DepValues<TValues, D extends readonly ExtractFieldPaths<TValues>[]> = D extends unknown
  ? number extends D['length']
    ? { readonly [R in D[number]]?: FieldTypeAtPath<TValues, R> }
    : { readonly [R in D[number]]: FieldTypeAtPath<TValues, R> }
  : never;

/**
 * A field validator that lists the other fields it reads, made by {@link withDeps}. The form calls `validate` with the
 * values at `deps`. Their exact type lives in the `withDeps` call, so here it is `never`. The list and `validate` live
 * together under the brand, so a copy of the validator can't split them. `values` exists for the types only: it ties
 * the validator to its form's values, so one built for another form doesn't fit.
 */
export interface FieldValidatorWithDeps<TValues, TValue> {
  readonly [listsFields]: {
    readonly deps: readonly ExtractFieldPaths<TValues>[];
    readonly validate: (value: TValue, deps: never) => FieldValidatorAnswer;
    /** Type only: ties the validator to its form's values, so one built for another form doesn't fit */
    readonly values?: (values: TValues) => TValues;
  };
}

/**
 * Makes a field validator that lists the other fields it reads. `validate` gets the field's value, then the values at
 * `deps`: one own property per listed path, keyed by the path as written, and typed. It can't read any other field.
 * A list that isn't a tuple, such as one typed as an array, gives each listed value as optional.
 *
 * Write it inside the `fieldValidators` entry, where it takes the form's types. One declared elsewhere gives its type
 * arguments, `withDeps<Form, string, readonly ['workspaceId']>(…)`. Without them it has no form to take its types from,
 * and one built for another form doesn't fit.
 *
 * @template TValues - The form values, from the `fieldValidators` entry
 * @template TValue - The value at the validator's field, from the `fieldValidators` entry
 * @template D - The listed paths
 *
 * @param deps - The other fields the validator reads, as field paths
 * @param validate - Returns an error message, or undefined when the value passes. It gets the field's value and the
 *   listed values.
 * @returns The field validator, for a `fieldValidators` entry
 *
 * @example
 * // The slug must be free in the selected workspace
 * const form = useForm(projectSchema, {
 *   initialValues,
 *   fieldValidators: {
 *     slug: withDeps(['workspaceId'], async (slug, { workspaceId }) =>
 *       (await isSlugTaken(workspaceId, slug)) ? 'This slug is taken' : undefined,
 *     ),
 *   },
 * });
 */
export const withDeps = <
  TValues extends Record<string, unknown>,
  TValue,
  const D extends readonly ExtractFieldPaths<TValues>[],
>(
  deps: D,
  validate: (value: TValue, deps: DepValues<TValues, D>) => FieldValidatorAnswer,
): FieldValidatorWithDeps<TValues, TValue> => ({ [listsFields]: { deps, validate } });
