import { err, isOk, type Result } from '../result';

import type { MaybeAsyncValidator, ValidatorMapOutput, ValidationError, Validator } from './core';

/**
 * Create a validator that checks if a value matches any of the provided validators.
 * Returns the result of the first successful validator, or all errors if none match.
 *
 * @example
 * const validate = union([string(), number()]);
 * validate('hello'); // ok("hello")
 * validate(42);      // ok(42)
 * validate(true);    // err([...all errors...])
 *
 * @param validators - Array of validators to try in order
 * @param options - Configuration options
 * @returns A validator that succeeds if any of the provided validators succeed
 */
export function union<I>(
  validators: [],
  options?: {
    collectAllErrors?: boolean;
    errorPrefix?: string;
  },
): Validator<I, never>;

export function union<I, O1>(
  validators: [Validator<I, O1>],
  options?: {
    collectAllErrors?: boolean;
    errorPrefix?: string;
  },
): Validator<I, O1>;
export function union<I, O1>(
  validators: [MaybeAsyncValidator<I, O1>],
  options?: {
    collectAllErrors?: boolean;
    errorPrefix?: string;
  },
): MaybeAsyncValidator<I, O1>;

export function union<I, O1, O2>(
  validators: [Validator<I, O1>, Validator<I, O2>],
  options?: {
    collectAllErrors?: boolean;
    errorPrefix?: string;
  },
): Validator<I, O1 | O2>;
export function union<I, O1, O2>(
  validators: [MaybeAsyncValidator<I, O1>, MaybeAsyncValidator<I, O2>],
  options?: {
    collectAllErrors?: boolean;
    errorPrefix?: string;
  },
): MaybeAsyncValidator<I, O1 | O2>;

export function union<I, O1, O2, O3>(
  validators: [Validator<I, O1>, Validator<I, O2>, Validator<I, O3>],
  options?: {
    collectAllErrors?: boolean;
    errorPrefix?: string;
  },
): Validator<I, O1 | O2 | O3>;
export function union<I, O1, O2, O3>(
  validators: [MaybeAsyncValidator<I, O1>, MaybeAsyncValidator<I, O2>, MaybeAsyncValidator<I, O3>],
  options?: {
    collectAllErrors?: boolean;
    errorPrefix?: string;
  },
): MaybeAsyncValidator<I, O1 | O2 | O3>;

export function union<I, O1, O2, O3, O4>(
  validators: [Validator<I, O1>, Validator<I, O2>, Validator<I, O3>, Validator<I, O4>],
  options?: {
    collectAllErrors?: boolean;
    errorPrefix?: string;
  },
): Validator<I, O1 | O2 | O3 | O4>;
export function union<I, O1, O2, O3, O4>(
  validators: [
    MaybeAsyncValidator<I, O1>,
    MaybeAsyncValidator<I, O2>,
    MaybeAsyncValidator<I, O3>,
    MaybeAsyncValidator<I, O4>,
  ],
  options?: {
    collectAllErrors?: boolean;
    errorPrefix?: string;
  },
): MaybeAsyncValidator<I, O1 | O2 | O3 | O4>;

export function union<I, O1, O2, O3, O4, O5>(
  validators: [Validator<I, O1>, Validator<I, O2>, Validator<I, O3>, Validator<I, O4>, Validator<I, O5>],
  options?: {
    collectAllErrors?: boolean;
    errorPrefix?: string;
  },
): Validator<I, O1 | O2 | O3 | O4 | O5>;
export function union<I, O1, O2, O3, O4, O5>(
  validators: [
    MaybeAsyncValidator<I, O1>,
    MaybeAsyncValidator<I, O2>,
    MaybeAsyncValidator<I, O3>,
    MaybeAsyncValidator<I, O4>,
    MaybeAsyncValidator<I, O5>,
  ],
  options?: {
    collectAllErrors?: boolean;
    errorPrefix?: string;
  },
): MaybeAsyncValidator<I, O1 | O2 | O3 | O4 | O5>;

export function union<I, O>(
  validators: Array<Validator<I, O>>,
  options?: {
    collectAllErrors?: boolean;
    errorPrefix?: string;
  },
): Validator<I, O>;
export function union<I, O>(
  validators: Array<MaybeAsyncValidator<I, O>>,
  options?: {
    collectAllErrors?: boolean;
    errorPrefix?: string;
  },
): MaybeAsyncValidator<I, O>;

export function union<I, O>(
  validators: Array<MaybeAsyncValidator<I, O>>,
  options?: {
    collectAllErrors?: boolean;
    errorPrefix?: string;
  },
): MaybeAsyncValidator<I, O> {
  const { collectAllErrors = true, errorPrefix } = options || {};

  const buildError = (allErrors: ValidationError[][]) =>
    err(
      allErrors.flat().map((error) => ({
        path: error.path,
        message: errorPrefix ? `${errorPrefix}: ${error.message}` : error.message,
      })),
    );

  return (value, parentPath = []) => {
    if (validators.length === 0) {
      return err([{ path: parentPath, message: 'No validators provided to union' }]);
    }

    const allErrors: ValidationError[][] = [];

    // Try each validator in order
    for (let i = 0; i < validators.length; i++) {
      // eslint-disable-next-line security/detect-object-injection -- numeric index over own array
      const result = validators[i]!(value, parentPath);

      if (result instanceof Promise) {
        // Switch to async path: await this result, then continue sequentially
        return (async () => {
          const asyncResult = await result;
          if (isOk(asyncResult)) return asyncResult;
          allErrors.push(asyncResult.error);
          if (!collectAllErrors) return buildError(allErrors);

          // Continue with remaining validators sequentially
          for (let j = i + 1; j < validators.length; j++) {
            // eslint-disable-next-line security/detect-object-injection -- numeric index over own array
            const r = await validators[j]!(value, parentPath);
            if (isOk(r)) return r;
            allErrors.push(r.error);
            if (!collectAllErrors) break;
          }
          return buildError(allErrors);
        })();
      }

      if (isOk(result)) {
        // Return the first successful result
        return result;
      }

      // Collect errors for error reporting
      allErrors.push(result.error);

      // If we don't need to collect all errors, we can stop at the first failure
      if (!collectAllErrors) {
        break;
      }
    }

    // If all validators failed, combine all errors
    return buildError(allErrors);
  };
}

/**
 * Create a discriminated union validator that selects the validator based on
 * a discriminant field's value.
 *
 * @example
 * const validate = discriminatedUnion('type', {
 *   text: object({ type: required(literal('text')), content: required(string()) }),
 *   image: object({ type: required(literal('image')), url: required(string()) }),
 * });
 * validate({ type: 'text', content: 'hello' }); // ok(...)
 * validate({ type: 'unknown' });                 // err(...)
 *
 * @param discriminantField - The name of the field to use as discriminant
 * @param validatorMap - Map of discriminant values to validators
 * @param fallbackMessage - Message when the discriminant value is not found
 * @returns A validator that selects the appropriate schema based on the discriminant
 */
export function discriminatedUnion<const M extends Record<string, Validator<unknown, unknown>>>(
  discriminantField: string,
  validatorMap: M,
  fallbackMessage?: string,
): Validator<unknown, ValidatorMapOutput<M>>;
export function discriminatedUnion<const M extends Record<string, MaybeAsyncValidator<unknown, unknown>>>(
  discriminantField: string,
  validatorMap: M,
  fallbackMessage?: string,
): MaybeAsyncValidator<unknown, ValidatorMapOutput<M>>;
export function discriminatedUnion<const M extends Record<string, MaybeAsyncValidator<unknown, unknown>>>(
  discriminantField: string,
  validatorMap: M,
  fallbackMessage: string = `Invalid discriminant value for '${discriminantField}'`,
): MaybeAsyncValidator<unknown, ValidatorMapOutput<M>> {
  return (value, parentPath = []) => {
    // Ensure value is an object
    if (value === null || typeof value !== 'object') {
      return err([{ path: parentPath, message: 'Expected an object' }]);
    }

    // Extract the discriminant value
    // eslint-disable-next-line security/detect-object-injection -- discriminantField is a schema-defined string literal
    const discriminantValue = (value as Record<string, unknown>)[discriminantField];

    // Ensure discriminant value exists and is a string
    if (typeof discriminantValue !== 'string') {
      return err([
        {
          path: [...parentPath, discriminantField],
          message: `Missing or invalid discriminant field '${discriminantField}'`,
        },
      ]);
    }

    // Get the validator for this discriminant value
    // eslint-disable-next-line security/detect-object-injection -- lookup against schema-defined validatorMap keys
    const validator = validatorMap[discriminantValue];

    // If no validator is found for this discriminant value, return an error
    if (!validator) {
      return err([
        {
          path: [...parentPath, discriminantField],
          message: `${fallbackMessage}: '${discriminantValue}'`,
        },
      ]);
    }

    // SAFETY: ValidatorMapOutput<M> is derived from the validators in M, so the
    // cast is sound — the runtime result is always one of the branch output types.
    const result = validator(value, parentPath);
    if (result instanceof Promise) {
      return result.then((r) => r as Result<ValidatorMapOutput<M>, ValidationError[]>);
    }
    return result as Result<ValidatorMapOutput<M>, ValidationError[]>;
  };
}
