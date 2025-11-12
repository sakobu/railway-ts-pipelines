/* eslint-disable unicorn/no-array-reduce */
import { isErr, ok, err, type Result, match } from '../result';

import type { ValidationError, ValidationResult, Validator } from './core';

/**
 * Combines multiple validators into a single validator, applying them in sequence (left to right).
 * Each validator's result is passed to the next validator in the chain.
 * The sequence stops and returns an error if any validator in the chain fails.
 */
export function chain<A, B>(v1: Validator<A, B>): Validator<A, B>;
export function chain<A, B, C>(v1: Validator<A, B>, v2: Validator<B, C>): Validator<A, C>;
export function chain<A, B, C, D>(v1: Validator<A, B>, v2: Validator<B, C>, v3: Validator<C, D>): Validator<A, D>;
export function chain<A, B, C, D, E>(
  v1: Validator<A, B>,
  v2: Validator<B, C>,
  v3: Validator<C, D>,
  v4: Validator<D, E>,
): Validator<A, E>;
export function chain<A, B, C, D, E, F>(
  v1: Validator<A, B>,
  v2: Validator<B, C>,
  v3: Validator<C, D>,
  v4: Validator<D, E>,
  v5: Validator<E, F>,
): Validator<A, F>;
export function chain<A, B, C, D, E, F, G>(
  v1: Validator<A, B>,
  v2: Validator<B, C>,
  v3: Validator<C, D>,
  v4: Validator<D, E>,
  v5: Validator<E, F>,
  v6: Validator<F, G>,
): Validator<A, G>;
export function chain<A, B, C, D, E, F, G, H>(
  v1: Validator<A, B>,
  v2: Validator<B, C>,
  v3: Validator<C, D>,
  v4: Validator<D, E>,
  v5: Validator<E, F>,
  v6: Validator<F, G>,
  v7: Validator<G, H>,
): Validator<A, H>;
export function chain<A, B, C, D, E, F, G, H, I>(
  v1: Validator<A, B>,
  v2: Validator<B, C>,
  v3: Validator<C, D>,
  v4: Validator<D, E>,
  v5: Validator<E, F>,
  v6: Validator<F, G>,
  v7: Validator<G, H>,
  v8: Validator<H, I>,
): Validator<A, I>;
export function chain<A, B, C, D, E, F, G, H, I, J>(
  v1: Validator<A, B>,
  v2: Validator<B, C>,
  v3: Validator<C, D>,
  v4: Validator<D, E>,
  v5: Validator<E, F>,
  v6: Validator<F, G>,
  v7: Validator<G, H>,
  v8: Validator<H, I>,
  v9: Validator<I, J>,
): Validator<A, J>;
export function chain<A, B, C, D, E, F, G, H, I, J, K>(
  v1: Validator<A, B>,
  v2: Validator<B, C>,
  v3: Validator<C, D>,
  v4: Validator<D, E>,
  v5: Validator<E, F>,
  v6: Validator<F, G>,
  v7: Validator<G, H>,
  v8: Validator<H, I>,
  v9: Validator<I, J>,
  v10: Validator<J, K>,
): Validator<A, K>;

/**
 * Implementation of chain that combines multiple validators into a single validator,
 * applying them in sequence (left to right).
 *
 * @template A - The input type for the first validator
 * @template B - The output type of the first validator and input type for the second validator (if any)
 * @template C, D, E, F, G, H, I, J, K - Types for subsequent validators in the chain
 *
 * @param {...Validator[]} validators - A list of validators to compose
 * @returns {Validator<unknown, unknown>} A combined validator that applies all validators in sequence
 *
 * @example
 * // Basic composition of string validators
 * const passwordValidator = chain(
 *   string(),
 *   nonEmpty(),
 *   minLength(8)
 * );
 *
 * const result = passwordValidator('password123');
 * // If valid: { ok: true, value: 'password123', [RESULT_BRAND]: 'ok' }
 *
 * @example
 * // Chain validators with type conversion
 * const ageValidator = chain(
 *   parseString(),  // Converts to string
 *   nonEmpty(),     // Ensures not empty
 *   parseNumber()   // Converts to number
 * );
 *
 * const result = ageValidator('25');
 * // If valid: { ok: true, value: 25, [RESULT_BRAND]: 'ok' }
 *
 * @example
 * // Validation fails at first error
 * const result = chain(string(), minLength(5))('abc');
 * // If invalid: { ok: false, error: [{ path: [], message: 'Must be at least 5 characters' }], [RESULT_BRAND]: 'error' }
 *
 * @example
 * // Used in an object schema
 * const userSchema = object({
 *   name: required(string()),
 *   email: required(chain(string(), email())),
 *   age: required(chain(parseString(), parseNumber(), min(18)))
 * });
 */
export function chain(...validators: Validator<unknown, unknown>[]): Validator<unknown, unknown> {
  return (value, path = []) => {
    let result: Result<unknown, ValidationError[]> = ok(value);

    for (const validator of validators) {
      if (isErr(result)) return result;

      const nextResult = validator(result.value, path);
      result = isErr(nextResult) ? nextResult : ok(nextResult.value);
    }

    return result;
  };
}

/**
 * Validates a value against a validator.
 * This is a simple utility function that directly applies a validator to a value.
 *
 * @template T - The expected output type of the validator
 * @param {unknown} value - The value to validate
 * @param {Validator<unknown, T>} validator - The validator to apply to the value
 * @returns {Result<T, ValidationError[]>} A Result containing either the validated value or validation errors
 *
 * @example
 * // Validate a simple value
 * const numberValidator = chain(parseNumber(), min(5));
 * const result = validate(10, numberValidator);
 * // If valid: { ok: true, value: 10, [RESULT_BRAND]: 'ok' }
 *
 * @example
 * // Validation with errors
 * const result = validate('hello', number());
 * // If invalid: { ok: false, error: [{ path: [], message: 'Must be a number' }], [RESULT_BRAND]: 'error' }
 *
 * @example
 * // Check the result
 * const result = validate(userInput, userSchema);
 * if (isErr(result)) {
 *   // Handle validation errors
 *   const formattedErrors = formatErrors(result.error);
 *   displayErrors(formattedErrors);
 * } else {
 *   // Use the validated data
 *   saveUser(result.value);
 * }
 */
export function validate<T>(value: unknown, validator: Validator<unknown, T>): Result<T, ValidationError[]>;
export function validate<T>(
  value: unknown,
  validator: Validator<unknown, T>,
  path: string[],
): Result<T, ValidationError[]>;
export function validate<T>(
  value: unknown,
  validator: Validator<unknown, T>,
  path: string[] = [],
): Result<T, ValidationError[]> {
  return validator(value, path);
}

/**
 * Formats validation errors into a more user-friendly object structure.
 * Converts array paths to a dot notation string format, suitable for form libraries or error displays.
 *
 * @param {ValidationError[]} errors - The array of validation errors to format
 * @returns {Record<string, string>} An object mapping paths to error messages
 *
 * @example
 * // Simple errors
 * const result = validate(data, schema);
 * if (isErr(result)) {
 *   const formatted = formatErrors(result.error);
 *   // { name: 'Name is required', 'address.zipCode': 'Invalid ZIP code' }
 * }
 *
 * @example
 * // Formatting errors with array indices
 * const schema = object({
 *   items: array(number())
 * });
 * const result = validate({ items: [1, 'two', 3] }, schema);
 * if (isErr(result)) {
 *   const formatted = formatErrors(result.error);
 *   // { 'items[1]': 'Must be a number' }
 * }
 *
 * @example
 * // Using formatted errors with a form library
 * const formErrors = formatErrors(validationErrors);
 * form.setErrors(formErrors);
 */
export function formatErrors(errors: ValidationError[]): Record<string, string> {
  return errors.reduce(
    (acc, error) => {
      const formattedPath = error.path.reduce((path, segment, index) => {
        if (/^\d+$/.test(segment)) {
          return `${path}[${segment}]`;
        } else {
          return index === 0 ? segment : `${path}.${segment}`;
        }
      }, '');

      // eslint-disable-next-line security/detect-object-injection
      acc[formattedPath] = error.message;
      return acc;
    },
    {} as Record<string, string>,
  );
}

/**
 * Validates input and returns a formatted ValidationResult in one call.
 * Convenience function that combines validate() + formatErrors() + match() into a single operation.
 *
 * This is a shorthand for the common pattern of validating input and immediately formatting
 * errors into a simple Record<string, string> format, typically used for API responses or
 * client-facing error messages.
 *
 * @template T - The expected output type after successful validation
 * @param {unknown} input - The untrusted input to validate
 * @param {Validator<unknown, T>} schema - The validator/schema to validate against
 * @returns {ValidationResult<T>} An object with either { valid: true, data: T } or { valid: false, errors: Record<string, string> }
 *
 * @example
 * // Basic usage - replaces manual validation + formatting
 * const userSchema = object({
 *   email: required(chain(string(), email())),
 *   age: required(chain(parseNumber(), min(18)))
 * });
 *
 * const result = validateAndFormatResult(input, userSchema);
 * // If valid: { valid: true, data: { email: "user@example.com", age: 25 } }
 * // If invalid: { valid: false, errors: { email: "Invalid email", age: "Must be at least 18" } }
 *
 * @example
 * // API endpoint usage
 * async function registerUser(req: Request) {
 *   const result = validateAndFormatResult(req.body, registrationSchema);
 *
 *   if (!result.valid) {
 *     return res.status(400).json({ errors: result.errors });
 *   }
 *
 *   const user = await createUser(result.data);
 *   return res.json({ user });
 * }
 *
 * @example
 * // Replaces this manual pattern:
 * // const validationResult = validate(input, schema);
 * // const output = match(validationResult, {
 * //   ok: (data) => ({ valid: true, data }),
 * //   err: (errors) => ({ valid: false, errors: formatErrors(errors) })
 * // });
 *
 * // With this one-liner:
 * const output = validateAndFormatResult(input, schema);
 *
 * @example
 * // Type-safe destructuring
 * const { valid, data, errors } = validateAndFormatResult(input, schema);
 *
 * if (valid) {
 *   // TypeScript knows 'data' exists here
 *   console.log(data.email);
 * } else {
 *   // TypeScript knows 'errors' exists here
 *   console.log(errors.email);
 * }
 */
export function validateAndFormatResult<T>(input: unknown, schema: Validator<unknown, T>): ValidationResult<T> {
  const result = validate(input, schema);
  return match<T, ValidationError[], ValidationResult<T>>(result, {
    ok: (data) => ({ valid: true, data }),
    err: (errors) => ({ valid: false, errors: formatErrors(errors) }),
  });
}

/**
 * Creates a validator that transforms a value during validation
 *
 * IMPORTANT: The transformer function must be pure and not throw exceptions.
 * This validator always succeeds and returns the transformed value.
 * For transformations that might fail, use proper validators or chain with validation:
 *
 * @template I - The input type
 * @template O - The output type after transformation
 * @param {(value: I) => O} transformer - A pure function that transforms the input value
 * @returns {Validator<I, O>} A validator that applies the transformation
 *
 * @example
 * // Safe transformation after validation
 * const normalizeEmail = chain(
 *   string(),
 *   email(),
 *   transform(s => s.toLowerCase())  // Safe because we know it's a valid email string
 * );
 *
 * @example
 * // Transform for normalization
 * const trimmedString = chain(
 *   string(),
 *   transform(s => s.trim())
 * );
 *
 * @example
 * // Type conversion
 * const numberToString = transform<number, string>(n => n.toString());
 *
 * @example
 * // DON'T use for risky transformations:
 * // transform(s => JSON.parse(s))  // Could throw!
 * // Instead use: parseJSON()  // Handles errors properly
 */
export function transform<I, O>(transformer: (value: I) => O): Validator<I, O> {
  return (value) => ok(transformer(value));
}

/**
 * Creates a validator that refines a value with a custom predicate
 * Useful for adding custom validation logic that can't be expressed with existing validators
 *
 * @template T - The type of the value being refined
 * @param {(value: T) => boolean} predicate - A function that returns true if the value is valid
 * @param {string} [message='Custom validation failed'] - The error message to return if validation fails
 * @returns {Validator<T, T>} A validator that checks the predicate
 *
 * @example
 * // Check if a number is even
 * const isEven = refine<number>(
 *   n => n % 2 === 0,
 *   "Must be an even number"
 * );
 *
 * @example
 * // Complex business logic
 * const validPassword = chain(
 *   string(),
 *   minLength(8),
 *   refine(
 *     password => /[A-Z]/.test(password) && /[0-9]/.test(password),
 *     "Password must contain at least one uppercase letter and one number"
 *   )
 * );
 *
 * @example
 * // Cross-field validation (when used with object schemas)
 * const dateRange = refine<{ start: Date; end: Date }>(
 *   ({ start, end }) => start <= end,
 *   "Start date must be before or equal to end date"
 * );
 *
 * @example
 * // Multiple refinements
 * const positiveEven = chain(
 *   number(),
 *   refine(n => n > 0, "Must be positive"),
 *   refine(n => n % 2 === 0, "Must be even")
 * );
 */
export function refine<T>(
  predicate: (value: T) => boolean,
  message: string = 'Custom validation failed',
): Validator<T, T> {
  return (value, path = []) => {
    if (!predicate(value)) {
      return err([{ path, message }]);
    }
    return ok(value);
  };
}

/**
 * Creates a validator that targets a specific field path with custom validation logic
 * operating on the entire object. Used for cross-field validation where one field's
 * validity depends on other fields (e.g., password confirmation, date ranges,
 * conditional required fields).
 *
 * Unlike `refine` which validates a single field in isolation, `refineAt` receives
 * the entire parent object and can attach the error to a specific nested field path.
 * This is essential for validation logic that needs to compare multiple fields.
 *
 * **When to use `refineAt`:**
 * - Password confirmation matching
 * - Date range validation (start date < end date)
 * - Conditional required fields (field A required only if field B has value X)
 * - Cross-field business logic (e.g., discount codes valid for specific products)
 *
 * **When NOT to use `refineAt`:**
 * - Single field validation - use `refine` instead
 * - Simple type constraints - use built-in validators like `minLength`, `email`, etc.
 *
 * @template T - The type of the parent object being validated
 *
 * @param targetPath - The field path where the error should be attached.
 *                     Can be a string like "confirmPassword" or an array like ["address", "zipCode"].
 *                     Supports dot notation for nested fields (e.g., "user.email").
 *
 * @param predicate - Validation function that receives the entire parent object.
 *                    Returns `true` if validation passes, `false` if it fails.
 *                    Has access to all sibling fields for cross-field logic.
 *
 * @param message - Error message to display when validation fails.
 *                  Should clearly describe what the user needs to fix.
 *
 * @returns A validator function that can be used with `chain` at the object level.
 *          The validator merges with `parentPath` to work correctly in nested schemas.
 *
 * @example
 * // Password confirmation
 * const validator = chain(
 *   object({
 *     password: required(string()),
 *     confirmPassword: required(string()),
 *   }),
 *   refineAt(
 *     "confirmPassword",
 *     (data) => data.password === data.confirmPassword,
 *     "Passwords must match"
 *   )
 * );
 *
 * @example
 * // Date range validation
 * const bookingValidator = chain(
 *   object({
 *     checkIn: required(parseDate()),
 *     checkOut: required(parseDate()),
 *   }),
 *   refineAt(
 *     "checkOut",
 *     (data) => data.checkOut > data.checkIn,
 *     "Check-out date must be after check-in date"
 *   )
 * );
 *
 * @example
 * // Conditional required field
 * const accountValidator = chain(
 *   object({
 *     accountType: required(stringEnum(["personal", "business"])),
 *     taxId: optional(string()),
 *   }),
 *   refineAt(
 *     "taxId",
 *     (data) => data.accountType === "personal" || !!data.taxId,
 *     "Tax ID is required for business accounts"
 *   )
 * );
 *
 * @example
 * // Nested field validation with array path
 * const validator = chain(
 *   object({
 *     address: object({
 *       country: required(string()),
 *       state: optional(string()),
 *     }),
 *   }),
 *   refineAt(
 *     ["address", "state"],
 *     (data) => data.address.country !== "US" || !!data.address.state,
 *     "State is required for US addresses"
 *   )
 * );
 *
 * @example
 * // Multiple cross-field validations
 * const rangeValidator = chain(
 *   object({
 *     min: required(parseNumber()),
 *     max: required(parseNumber()),
 *     value: required(parseNumber()),
 *   }),
 *   refineAt("max", (data) => data.max > data.min, "Max must be greater than min"),
 *   refineAt("value", (data) => data.value >= data.min, "Value must be at least min"),
 *   refineAt("value", (data) => data.value <= data.max, "Value must be at most max")
 * );
 *
 * @see refine - For single-field validation without cross-field dependencies
 * @see chain - For composing multiple validators including refineAt
 * @see object - The schema type that refineAt is typically chained after
 */
export function refineAt<T>(targetPath: string | string[], predicate: (value: T) => boolean, message: string) {
  return (value: T, parentPath: string[] = []) => {
    if (!predicate(value)) {
      const fieldPath = Array.isArray(targetPath) ? targetPath : [targetPath];
      return err([{ path: [...parentPath, ...fieldPath], message }]);
    }
    return ok(value);
  };
}
