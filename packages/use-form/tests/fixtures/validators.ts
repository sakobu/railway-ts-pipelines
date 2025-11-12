import { ok, err } from '@railway-ts/pipelines/result';
import type { Validator } from '@railway-ts/pipelines/schema';
import {
  object,
  required,
  chain,
  string,
  nonEmpty,
  email,
  parseNumber,
  min,
  array,
  stringEnum,
  type InferSchemaType,
} from '@railway-ts/pipelines/schema';

/**
 * Simple user validator for testing using Railway schema builders
 */
export const userValidator = object({
  name: required(chain(string(), nonEmpty('Name is required'))),
  email: required(
    chain(string(), nonEmpty('Email is required'), email('Email must be valid'))
  ),
  age: required(
    chain(
      parseNumber('Age must be a valid number'),
      min(18, 'Must be 18 or older')
    )
  ),
});

export type UserForm = InferSchemaType<typeof userValidator>;

/**
 * Nested form validator for testing using Railway schema builders
 */
export const addressSchema = object({
  street: required(chain(string(), nonEmpty('Street is required'))),
  city: required(chain(string(), nonEmpty('City is required'))),
  zip: required(chain(string(), nonEmpty('ZIP code is required'))),
});

export type AddressForm = InferSchemaType<typeof addressSchema>;

export const userWithAddressValidator = object({
  name: required(chain(string(), nonEmpty('Name is required'))),
  address: required(addressSchema),
});

export type UserWithAddressForm = InferSchemaType<
  typeof userWithAddressValidator
>;

/**
 * Array form validator for testing using Railway schema builders
 */
export const contactSchema = object({
  type: required(stringEnum(['email', 'phone'], 'Type is required')),
  value: required(chain(string(), nonEmpty('Contact value is required'))),
});

export type ContactForm = InferSchemaType<typeof contactSchema>;

export const userWithContactsValidator = object({
  name: required(chain(string(), nonEmpty('Name is required'))),
  contacts: required(array(contactSchema)),
});

export type UserWithContactsForm = InferSchemaType<
  typeof userWithContactsValidator
>;

/**
 * Always valid validator for testing (pass-through)
 */
export const alwaysValidValidator: Validator<
  unknown,
  Record<string, unknown>
> = (input) => {
  return ok(input as Record<string, unknown>);
};

/**
 * Always invalid validator for testing
 */
export const alwaysInvalidValidator: Validator<unknown, never> = () => {
  return err([{ path: ['root'], message: 'Validation failed' }]);
};
