import { err, isErr, type Result } from '../result';

import { array, minItems } from './array';
import { boolean } from './boolean';
import { object, required } from './core';
import { string } from './string';
import { chain } from './utils';

import type { ValidationError, Validator } from './core';

/**
 * Read a `Result` that crossed the wire as JSON back into a typed `Result`, with no cast.
 *
 * A `Result` serializes to `{ ok: true, value }` or `{ ok: false, error }` (the brand is a symbol
 * key, so `JSON.stringify` leaves it out). `decodeResult` checks that shape: the `ok` value goes
 * through `schema`, and the error list must be a non-empty `ValidationError[]` (only `path` and
 * `message` are kept). Anything else becomes one error at path `[]` with `message`, whose `cause`
 * lists why, with paths into the response (for example `['value', 'createdAt']`).
 *
 * @example
 * // server
 * return Response.json(result, { status: result.ok ? 201 : 422 });
 *
 * @example
 * // client
 * const res = await fetch('/api/signup', { method: 'POST', body: JSON.stringify(values) });
 * const result = decodeResult(await res.json(), object({ id: required(string()) }));
 * // Result<{ id: string }, ValidationError[]>
 *
 * @param value - The parsed JSON, for example `await res.json()`
 * @param schema - A synchronous validator for the `ok` value
 * @param message - The message of the error returned when `value` isn't a valid `Result`
 * @returns The decoded `Result`, or one error at path `[]` whose `cause` says why
 */
export function decodeResult<T>(
  value: unknown,
  schema: Validator<unknown, T>,
  message: string = 'Unexpected response',
): Result<T, ValidationError[]> {
  const fail = (cause: ValidationError[]): Result<never, ValidationError[]> => err([{ path: [], message, cause }]);

  if (typeof value !== 'object' || value === null) return fail([{ path: [], message: 'Expected an object' }]);

  const flag = boolean()('ok' in value ? value.ok : undefined, ['ok']);
  if (isErr(flag)) return fail(flag.error);

  if (flag.value) {
    const decoded = schema('value' in value ? value.value : undefined, ['value']);
    return isErr(decoded) ? fail(decoded.error) : decoded;
  }

  const errors = chain(
    array(object({ path: required(array(string())), message: required(string()) }, { strict: false })),
    minItems(1),
  )('error' in value ? value.error : undefined, ['error']);
  return isErr(errors) ? fail(errors.error) : err(errors.value);
}
