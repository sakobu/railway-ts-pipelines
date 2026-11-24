import { number, object, string, union, validate } from '@railway-ts/pipelines/schema';

// A consumer of the built package, type-checked by `bun run test:package` with exactOptionalPropertyTypes on.
// An option whose absence means "use the default" must accept an explicit undefined, so a conditional option
// like `{ strict: maybe }` compiles.
import type { Result } from '@railway-ts/pipelines/result';
import type { UnionOptions, ValidateOptions, ValidationError, Validator } from '@railway-ts/pipelines/schema';

/** The optional keys of T that reject an explicit undefined. Needs exactOptionalPropertyTypes: without it, every optional key is listed. */
type KeysRejectingUndefined<T> = {
  [K in keyof T]-?: Partial<Pick<T, K>> extends Pick<T, K> ? (undefined extends Required<T>[K] ? never : K) : never;
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
declare const maybeOptions: ValidateOptions | undefined;
declare const maybePath: string[] | undefined;

// Each result is typed sync: if only an async overload accepted the argument, the call would still compile, with a
// MaybeAsyncValidator or a Result | Promise<Result>
export const validated: Result<number, ValidationError[]> = validate(1, number(), { abortEarly: maybe });
export const validatedWithOptions: Result<number, ValidationError[]> = validate(1, number(), maybeOptions);
export const validatedAtPath: Result<number, ValidationError[]> = validate(1, number(), maybePath);
export const validatedWithBoth: Result<number, ValidationError[]> = validate(1, number(), maybePath, maybeOptions);
export const syncObject: Validator<unknown, { a: string }> = object({ a: string() }, { strict: maybe });
export const either: Validator<unknown, string | number> = union([string(), number()], {
  collectAllErrors: maybe,
  errorPrefix: maybeText,
});
export const error: ValidationError = { path: [], message: 'Invalid', cause: maybeCause };
