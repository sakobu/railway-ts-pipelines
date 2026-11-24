// A consumer of the built package, type-checked by `bun run test:package` with exactOptionalPropertyTypes on.
// An option whose absence means "use the default" must accept an explicit undefined, so a conditional option
// like `{ strict: maybe }` compiles.
import { number, object, string, union, validate } from '@railway-ts/pipelines/schema';

import type { UnionOptions, ValidateOptions, ValidationError, Validator } from '@railway-ts/pipelines/schema';

/** The optional keys of T that reject an explicit undefined. Needs exactOptionalPropertyTypes: without it, every optional key is listed. */
type KeysRejectingUndefined<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? (undefined extends Required<T>[K] ? never : K) : never;
}[keyof T];

/** `{}` fits only when every optional key of T accepts undefined; otherwise the error names the keys that don't. */
type AcceptsUndefined<T> = Record<KeysRejectingUndefined<T>, never>;

export const validateOptions: AcceptsUndefined<ValidateOptions> = {};
export const validationError: AcceptsUndefined<ValidationError> = {};
export const unionOptions: AcceptsUndefined<UnionOptions> = {};
export const objectOptions: AcceptsUndefined<NonNullable<Parameters<typeof object>[1]>> = {};

declare const maybe: boolean | undefined;
declare const maybeText: string | undefined;
declare const maybeCause: ValidationError[] | undefined;

export const validated = validate(1, number(), { abortEarly: maybe });
// The sync overload must accept it too: the async one alone would compile, with a MaybeAsyncValidator
export const syncObject: Validator<unknown, { a: string }> = object({ a: string() }, { strict: maybe });
export const either = union([string(), number()], { collectAllErrors: maybe, errorPrefix: maybeText });
export const error: ValidationError = { path: [], message: 'Invalid', cause: maybeCause };
