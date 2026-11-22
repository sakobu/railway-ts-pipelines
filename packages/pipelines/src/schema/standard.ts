import { isOk } from '../result';

import type { MaybeAsyncValidator, ValidationError, Validator } from './core';

// ─── Vendored Standard Schema types (v1) ────────────────────
// Source: https://github.com/standard-schema/standard-schema
// Vendored to avoid external dependency (~30 lines, stable v1 spec)

interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly '~standard': StandardSchemaV1.Props<Input, Output>;
}

// eslint-disable-next-line @typescript-eslint/no-namespace -- required by Standard Schema spec for nested types
declare namespace StandardSchemaV1 {
  interface Props<Input = unknown, Output = Input> {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (value: unknown) => Result<Output> | Promise<Result<Output>>;
    readonly types?: Types<Input, Output> | undefined;
  }

  type Result<Output> =
    | { readonly value: Output; readonly issues?: undefined }
    | { readonly issues: ReadonlyArray<Issue> };

  interface Issue {
    readonly message: string;
    readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined;
  }

  interface PathSegment {
    readonly key: PropertyKey;
  }

  interface Types<Input = unknown, Output = Input> {
    readonly input: Input;
    readonly output: Output;
  }

  type InferInput<Schema extends StandardSchemaV1> = NonNullable<Schema['~standard']['types']>['input'];

  type InferOutput<Schema extends StandardSchemaV1> = NonNullable<Schema['~standard']['types']>['output'];
}

export type { StandardSchemaV1 };

// ─── Adapter ────────────────────────────────────────────────

function mapErrors(errors: ValidationError[]): StandardSchemaV1.Issue[] {
  return errors.map((e) => ({ message: e.message, path: e.path }));
}

/**
 * Wrap a validator as a Standard Schema v1 object.
 *
 * The returned object satisfies the `StandardSchemaV1` interface, making
 * it compatible with tRPC, TanStack Form/Router, React Hook Form, Hono,
 * Next.js Server Actions, and any other tool that consumes Standard Schema.
 *
 * @example
 * const userSchema = object({
 *   name: required(string()),
 *   email: required(email()),
 * });
 *
 * // Wrap for Standard Schema consumers
 * const standardUserSchema = toStandardSchema(userSchema);
 *
 * @param validator - A sync or async validator to wrap
 * @returns A Standard Schema v1 object
 */
export function toStandardSchema<O>(validator: Validator<unknown, O>): StandardSchemaV1<unknown, O>;
export function toStandardSchema<O>(validator: MaybeAsyncValidator<unknown, O>): StandardSchemaV1<unknown, O>;
export function toStandardSchema<O>(validator: MaybeAsyncValidator<unknown, O>): StandardSchemaV1<unknown, O> {
  return {
    '~standard': {
      version: 1,
      vendor: 'railway-ts',
      validate(value) {
        try {
          const result = validator(value);
          if (result instanceof Promise) {
            return result
              .then((r) => (isOk(r) ? { value: r.value } : { issues: mapErrors(r.error) }))
              .catch((error: unknown) => ({
                issues: [{ message: error instanceof Error ? error.message : String(error) }],
              }));
          }
          return isOk(result) ? { value: result.value } : { issues: mapErrors(result.error) };
        } catch (error) {
          return { issues: [{ message: error instanceof Error ? error.message : String(error) }] };
        }
      },
      types: undefined as unknown as StandardSchemaV1.Types<unknown, O>,
    },
  };
}
