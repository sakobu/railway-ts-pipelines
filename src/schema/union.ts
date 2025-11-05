import { err, isErr, isOk, ok, type Result } from '../result';

import type { ValidationError, Validator } from './core';

/**
 * Creates a validator that checks if a value matches any of the provided validators
 * Returns the result of the first successful validator, or all errors if all validators fail
 *
 * @template I - Common input type for all validators
 * @template O1, O2, ..., On - Output types for each validator
 * @param {Array<Validator<I, any>>} validators - Array of validators to try in order
 * @param {Object} [options] - Configuration options
 * @param {boolean} [options.collectAllErrors=true] - Whether to collect errors from all validators
 * @param {string} [options.errorPrefix] - Optional prefix for each error message
 * @returns {Validator<I, O1 | O2 | ... | On>} A validator that succeeds if any of the provided validators succeed
 *
 * @example
 * // Define multiple possible schemas for a message
 * const textMessageSchema = object({
 *   type: required(stringEnum(["text"])),
 *   content: required(string())
 * });
 *
 * const imageMessageSchema = object({
 *   type: required(stringEnum(["image"])),
 *   url: required(string()),
 *   caption: optional(string())
 * });
 *
 * // Create a union validator for messages
 * const messageValidator = union([textMessageSchema, imageMessageSchema]);
 *
 * // Infer the message type from the schema
 * type Message = InferSchemaType<typeof messageValidator>;
 * // Equivalent to: type Message = { type: "text", content: string } | { type: "image", url: string, caption?: string }
 *
 * // Usage
 * const result = validate(messageData, messageValidator);
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

export function union<I, O1, O2>(
  validators: [Validator<I, O1>, Validator<I, O2>],
  options?: {
    collectAllErrors?: boolean;
    errorPrefix?: string;
  },
): Validator<I, O1 | O2>;

export function union<I, O1, O2, O3>(
  validators: [Validator<I, O1>, Validator<I, O2>, Validator<I, O3>],
  options?: {
    collectAllErrors?: boolean;
    errorPrefix?: string;
  },
): Validator<I, O1 | O2 | O3>;

export function union<I, O1, O2, O3, O4>(
  validators: [Validator<I, O1>, Validator<I, O2>, Validator<I, O3>, Validator<I, O4>],
  options?: {
    collectAllErrors?: boolean;
    errorPrefix?: string;
  },
): Validator<I, O1 | O2 | O3 | O4>;

export function union<I, O1, O2, O3, O4, O5>(
  validators: [Validator<I, O1>, Validator<I, O2>, Validator<I, O3>, Validator<I, O4>, Validator<I, O5>],
  options?: {
    collectAllErrors?: boolean;
    errorPrefix?: string;
  },
): Validator<I, O1 | O2 | O3 | O4 | O5>;

export function union<I, O>(
  validators: Array<Validator<I, O>>,
  options?: {
    collectAllErrors?: boolean;
    errorPrefix?: string;
  },
): Validator<I, O> {
  const { collectAllErrors = true, errorPrefix } = options || {};

  return (value, parentPath = []) => {
    if (validators.length === 0) {
      return err([{ path: parentPath, message: 'No validators provided to union' }]);
    }

    const allErrors: ValidationError[][] = [];

    // Try each validator in order
    for (const validator of validators) {
      const result = validator(value, parentPath);

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
    const combinedErrors = allErrors.flat().map((error) => ({
      path: error.path,
      message: errorPrefix ? `${errorPrefix}: ${error.message}` : error.message,
    }));

    return err(combinedErrors);
  };
}

/**
 * Creates a discriminated union validator that selects the validator based on
 * a discriminant field's value
 *
 * @template T - The expected output type of the validator
 * @param {string} discriminantField - The name of the field to use as discriminant
 * @param {Record<string, Validator<unknown, unknown>>} validatorMap - Map of discriminant values to validators
 * @param {string} [fallbackMessage] - Message to use when the discriminant value is not found
 * @returns {Validator<unknown, T>} A validator that selects the appropriate schema based on the discriminant
 *
 * @example
 * // Define schemas for different message types
 * const textMessageSchema = object({
 *   type: required(stringEnum(["text"])),
 *   content: required(string())
 * });
 *
 * const imageMessageSchema = object({
 *   type: required(stringEnum(["image"])),
 *   url: required(string()),
 *   caption: optional(string())
 * });
 *
 * // Create a discriminated union validator using the 'type' field
 * const messageValidator = discriminatedUnion<Message>('type', {
 *   text: textMessageSchema,
 *   image: imageMessageSchema
 * });
 */
export function discriminatedUnion<T>(
  discriminantField: string,
  validatorMap: Record<string, Validator<unknown, unknown>>,
  fallbackMessage: string = `Invalid discriminant value for '${discriminantField}'`,
): Validator<unknown, T> {
  return (value, parentPath = []) => {
    // Ensure value is an object
    if (value === null || typeof value !== 'object') {
      return err([{ path: parentPath, message: 'Expected an object' }]);
    }

    // Extract the discriminant value
    // eslint-disable-next-line security/detect-object-injection
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
    // eslint-disable-next-line security/detect-object-injection
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

    // Apply the selected validator and cast the result to the expected type
    return validator(value, parentPath) as Result<T, ValidationError[]>;
  };
}

/**
 * Combines a common fields validator with a discriminated union validator
 * This allows you to validate fields that are common across all variants
 * of a discriminated union
 *
 * @template C - Type of common fields
 * @template S - Type of the specific variant fields
 * @param {Validator<unknown, C>} commonSchema - Validator for common fields
 * @param {Validator<unknown, S>} specificSchema - Discriminated union validator
 * @returns {Validator<unknown, C & S>} A validator that validates both common and specific fields
 *
 * @example
 * // Define common fields for all maneuvers
 * const commonFieldsSchema = object({
 *   startEpoch: required(parseDate()),
 *   endEpoch: required(parseDate())
 * });
 *
 * // Create a discriminated union for specific maneuver types
 * const maneuverTypeSchema = discriminatedUnion('type', {
 *   'manual_burn': manualBurnSchema,
 *   'inclination_change': inclinationChangeSchema
 * });
 *
 * // Combine common fields with type-specific fields
 * const completeManeuverSchema = withCommonFields(
 *   commonFieldsSchema,
 *   maneuverTypeSchema
 * );
 */

export function withCommonFields<C, S>(
  commonSchema: Validator<unknown, C>,
  specificSchema: Validator<unknown, S>,
): Validator<unknown, C & S> {
  return (value, path = []) => {
    // First validate common fields
    const commonResult = commonSchema(value, path);
    if (isErr(commonResult)) {
      return commonResult;
    }

    // Then validate specific fields
    const specificResult = specificSchema(value, path);
    if (isErr(specificResult)) {
      return specificResult;
    }

    // Combine the validated results
    const combinedValue = {
      ...commonResult.value,
      ...specificResult.value,
    } as C & S;

    return ok(combinedValue);
  };
}
