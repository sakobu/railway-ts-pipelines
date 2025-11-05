import { err, ok } from '../result';

import type { Validator } from './core';

/**
 * Creates a validator that ensures a value is a string.
 *
 * @param {string} [message='Must be a string'] - Custom error message
 * @returns {Validator<unknown, string>} A validator that checks if a value is a string
 *
 * @example
 * // Validate that a value is a string
 * const nameValidator = string();
 * const result = nameValidator('John');
 * // If valid: { ok: true, value: 'John', [RESULT_BRAND]: 'ok' }
 *
 * @example
 * // With invalid input
 * const result = string()(42);
 * // If invalid: { ok: false, error: [{ path: [], message: 'Must be a string' }], [RESULT_BRAND]: 'error' }
 *
 * @example
 * // With custom error message
 * const labelValidator = string('Label must be text');
 *
 * @example
 * // Used in an object schema
 * const userSchema = object({
 *   name: required(string())
 * });
 */
export function string(message: string = 'Must be a string'): Validator<unknown, string> {
  return (value, path = []) => {
    if (typeof value !== 'string') {
      return err([{ path, message }]);
    }
    return ok(value);
  };
}

/**
 * Creates a validator that ensures a string's length is at least a minimum value.
 *
 * @param {number} min - The minimum length (inclusive)
 * @param {string} [message] - Custom error message (defaults to 'Must be at least {min} characters')
 * @returns {Validator<string>} A validator that checks if a string meets the minimum length
 *
 * @example
 * // Validate that a string is at least 3 characters long
 * const usernameValidator = minLength(3);
 * const result = usernameValidator('john_doe');
 * // If valid: { ok: true, value: 'john_doe', [RESULT_BRAND]: 'ok' }
 *
 * @example
 * // With invalid input
 * const result = minLength(3)('jo');
 * // If invalid: { ok: false, error: [{ path: [], message: 'Must be at least 3 characters' }], [RESULT_BRAND]: 'error' }
 *
 * @example
 * // With custom error message
 * const passwordValidator = minLength(8, 'Password must be at least 8 characters long');
 *
 * @example
 * // Used in an object schema with composition
 * const userSchema = object({
 *   username: required(chain(string(), nonEmpty(), minLength(3)))
 * });
 */
export function minLength(min: number, message: string = `Must be at least ${min} characters`): Validator<string> {
  return (value, path = []) => {
    if (value.length < min) {
      return err([{ path, message }]);
    }
    return ok(value);
  };
}

/**
 * Creates a validator that ensures a string's length is at most a maximum value.
 *
 * @param {number} max - The maximum length (inclusive)
 * @param {string} [message] - Custom error message (defaults to 'Must be at most {max} characters')
 * @returns {Validator<string>} A validator that checks if a string meets the maximum length
 *
 * @example
 * // Validate that a string is at most 50 characters long
 * const titleValidator = maxLength(50);
 * const result = titleValidator('This is a short title');
 * // If valid: { ok: true, value: 'This is a short title', [RESULT_BRAND]: 'ok' }
 *
 * @example
 * // With invalid input (too long)
 * const veryLongString = 'This string is more than 10 characters long';
 * const result = maxLength(10)(veryLongString);
 * // If invalid: { ok: false, error: [{ path: [], message: 'Must be at most 10 characters' }], [RESULT_BRAND]: 'error' }
 *
 * @example
 * // With custom error message
 * const bioValidator = maxLength(150, 'Bio must be 150 characters or less');
 *
 * @example
 * // Used in an object schema with composition
 * const postSchema = object({
 *   title: required(chain(string(), maxLength(100)))
 * });
 */
export function maxLength(max: number, message: string = `Must be at most ${max} characters`): Validator<string> {
  return (value, path = []) => {
    if (value.length > max) {
      return err([{ path, message }]);
    }
    return ok(value);
  };
}

/**
 * Creates a validator that ensures a string matches a regular expression pattern.
 *
 * @param {RegExp} regex - The regular expression to test against
 * @param {string} [message='Invalid format'] - Custom error message
 * @returns {Validator<string>} A validator that checks if a string matches the pattern
 *
 * @example
 * // Validate that a string matches a pattern (alphanumeric)
 * const alphanumericValidator = pattern(/^[a-zA-Z0-9]+$/);
 * const result = alphanumericValidator('abc123');
 * // If valid: { ok: true, value: 'abc123', [RESULT_BRAND]: 'ok' }
 *
 * @example
 * // With invalid input
 * const result = pattern(/^\d{5}$/)('abc');
 * // If invalid: { ok: false, error: [{ path: [], message: 'Invalid format' }], [RESULT_BRAND]: 'error' }
 *
 * @example
 * // With custom error message
 * const zipCodeValidator = pattern(/^\d{5}$/, 'ZIP code must be 5 digits');
 *
 * @example
 * // Used in an object schema
 * const addressSchema = object({
 *   zipCode: optional(chain(string(), pattern(/^\d{5}$/, 'Invalid ZIP code format')))
 * });
 */
export function pattern(regex: RegExp, message: string = 'Invalid format'): Validator<string> {
  return (value, path = []) => {
    if (!regex.test(value)) {
      return err([{ path, message }]);
    }
    return ok(value);
  };
}

/**
 * Creates a validator that ensures a string is not empty after trimming whitespace.
 *
 * @param {string} [message='String must not be empty'] - Custom error message
 * @returns {Validator<string>} A validator that checks if a string is not empty
 *
 * @example
 * // Validate that a string is not empty
 * const nameValidator = nonEmpty();
 * const result = nameValidator('John');
 * // If valid: { ok: true, value: 'John', [RESULT_BRAND]: 'ok' }
 *
 * @example
 * // With invalid input (empty string)
 * const result = nonEmpty()('');
 * // If invalid: { ok: false, error: [{ path: [], message: 'String must not be empty' }], [RESULT_BRAND]: 'error' }
 *
 * @example
 * // With invalid input (only whitespace)
 * const result = nonEmpty()('   ');
 * // If invalid: { ok: false, error: [{ path: [], message: 'String must not be empty' }], [RESULT_BRAND]: 'error' }
 *
 * @example
 * // With custom error message
 * const requiredFieldValidator = nonEmpty('This field is required');
 *
 * @example
 * // Used in an object schema with composition
 * const userSchema = object({
 *   name: required(chain(string(), nonEmpty()))
 * });
 */
export function nonEmpty(message: string = 'String must not be empty'): Validator<string> {
  return (value, path = []) => {
    if (value.trim().length === 0) {
      return err([{ path, message }]);
    }
    return ok(value);
  };
}

/**
 * Creates a validator that ensures a string is formatted as a valid email address.
 * Uses a simple regular expression to validate basic email format.
 *
 * @param {string} [message='Invalid email format'] - Custom error message
 * @returns {Validator<string>} A validator that checks if a string is a valid email
 *
 * @example
 * // Validate that a string is a valid email
 * const emailValidator = email();
 * const result = emailValidator('user@example.com');
 * // If valid: { ok: true, value: 'user@example.com', [RESULT_BRAND]: 'ok' }
 *
 * @example
 * // With invalid input
 * const result = email()('not-an-email');
 * // If invalid: { ok: false, error: [{ path: [], message: 'Invalid email format' }], [RESULT_BRAND]: 'error' }
 *
 * @example
 * // With custom error message
 * const contactEmailValidator = email('Please enter a valid email address');
 *
 * @example
 * // Used in an object schema with composition
 * const userSchema = object({
 *   email: required(chain(string(), nonEmpty(), email()))
 * });
 */
export function email(message: string = 'Invalid email format'): Validator<string> {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return pattern(emailRegex, message);
}

/**
 * Creates a validator that ensures a string is formatted as a valid phone number.
 * Uses a flexible regex that accepts common phone number formats including:
 * - International format with + prefix
 * - Numbers with spaces, dashes, or parentheses
 * - 8 to 20 digits total
 *
 * @param {string} [message='Invalid phone number format'] - Custom error message
 * @returns {Validator<string>} A validator that checks if a string is a valid phone number
 *
 * @example
 * // Validate that a string is a valid phone number
 * const phoneValidator = phoneNumber();
 * const result = phoneValidator('+1-555-123-4567');
 * // If valid: { ok: true, value: '+1-555-123-4567', [RESULT_BRAND]: 'ok' }
 *
 * @example
 * // Accepts various formats
 * phoneNumber()('123-456-7890');     // ok
 * phoneNumber()('(555) 123-4567');   // ok
 * phoneNumber()('+44 20 7123 1234'); // ok
 * phoneNumber()('555 123 4567');     // ok
 *
 * @example
 * // With invalid input
 * const result = phoneNumber()('not-a-phone');
 * // If invalid: { ok: false, error: [{ path: [], message: 'Invalid phone number format' }], [RESULT_BRAND]: 'error' }
 *
 * @example
 * // With custom error message
 * const contactPhoneValidator = phoneNumber('Please enter a valid phone number');
 *
 * @example
 * // Used in an object schema with composition
 * const contactSchema = object({
 *   phone: optional(chain(string(), phoneNumber()))
 * });
 *
 * @example
 * // For stricter validation, use pattern() with a custom regex
 * const usPhoneValidator = pattern(/^\d{3}-\d{3}-\d{4}$/, 'Must be in format XXX-XXX-XXXX');
 */
export function phoneNumber(message: string = 'Invalid phone number format'): Validator<string> {
  // Flexible regex that accepts common phone formats
  // Allows optional + prefix, digits, spaces, dashes, and parentheses
  // Total length should be reasonable for a phone number (8-20 chars after removing spaces)
  const phoneRegex = /^\+?[\d\s\-()]{8,20}$/;
  return (value, path = []) => {
    // Remove all spaces for validation
    const cleanedValue = value.replaceAll(/\s+/g, '');
    if (!phoneRegex.test(cleanedValue)) {
      return err([{ path, message }]);
    }
    return ok(value); // Return original value, not cleaned
  };
}
