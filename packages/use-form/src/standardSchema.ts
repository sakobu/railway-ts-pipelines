import { ok, err } from '@railway-ts/pipelines/result';
import type { Result } from '@railway-ts/pipelines/result';
import type {
  StandardSchemaV1,
  MaybeAsyncValidator,
  ValidationError,
} from '@railway-ts/pipelines/schema';

// =============================================================================
// Type Guard
// =============================================================================

/**
 * Detects whether a value is a Standard Schema v1 object by checking for
 * the `~standard` property with `version === 1`.
 */
export function isStandardSchema(value: unknown): value is StandardSchemaV1 {
  if (value == null || typeof value !== 'object' || !('~standard' in value)) {
    return false;
  }
  const standard = value['~standard'];
  return (
    standard != null &&
    typeof standard === 'object' &&
    'version' in standard &&
    standard.version === 1
  );
}

// =============================================================================
// Path Converter
// =============================================================================

/**
 * Converts Standard Schema paths (PropertyKey | { key: PropertyKey }) to
 * the string[] format used by railway-ts ValidationError paths.
 */
function convertPath(
  path: ReadonlyArray<PropertyKey | { key: PropertyKey }> | undefined
): string[] {
  if (!path) return [];
  return path.map((s) =>
    typeof s === 'object' && s !== null && 'key' in s
      ? String(s.key)
      : String(s)
  );
}

// =============================================================================
// Result Converter
// =============================================================================

/**
 * Maps a Standard Schema v1 result to a Railway Result.
 * `{ value }` → `ok(value)`, `{ issues }` → `err(ValidationError[])`.
 */
function convertResult<T>(
  result: StandardSchemaV1.Result<T>
): Result<T, ValidationError[]> {
  if ('issues' in result && result.issues) {
    const errors: ValidationError[] = result.issues.map((issue) => ({
      path: convertPath(issue.path),
      message: issue.message,
    }));
    return err(errors);
  }
  return ok((result as { value: T }).value);
}

// =============================================================================
// Adapter
// =============================================================================

/**
 * Wraps a Standard Schema v1 object into a `MaybeAsyncValidator` compatible
 * with the railway-ts validation pipeline. This allows `useForm` to accept
 * any Standard Schema v1 compliant validator (Valibot, ArkType, etc.).
 */
export function fromStandardSchema<T extends Record<string, unknown>>(
  schema: StandardSchemaV1<unknown, T>
): MaybeAsyncValidator<unknown, T> {
  return (
    value: unknown
  ): Result<T, ValidationError[]> | Promise<Result<T, ValidationError[]>> => {
    const result = schema['~standard'].validate(value);
    if (result instanceof Promise) {
      return result.then((r) => convertResult<T>(r));
    }
    return convertResult<T>(result);
  };
}

// =============================================================================
// Union Type
// =============================================================================

/**
 * Accepts either a railway-ts `MaybeAsyncValidator` or a Standard Schema v1 object.
 * Used as the validator parameter type for `useForm`.
 */
export type FormValidator<T extends Record<string, unknown>> =
  | MaybeAsyncValidator<unknown, T>
  | StandardSchemaV1<unknown, T>;
