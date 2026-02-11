import { ok, err } from '@railway-ts/pipelines/result';
import type {
  Validator,
  MaybeAsyncValidator,
  StandardSchemaV1,
} from '@railway-ts/pipelines/schema';
import {
  object,
  required,
  chain,
  chainAsync,
  refineAsync,
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

// =============================================================================
// Async Validators
// =============================================================================

/**
 * Async user validator that simulates a server-side uniqueness check.
 * Name 'taken' is rejected as already in use.
 */
export const asyncUserValidator = object({
  name: required(
    chainAsync(
      string(),
      nonEmpty('Name is required'),
      refineAsync<string>(async (value) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return value !== 'taken';
      }, 'Name is already taken')
    )
  ),
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

export type AsyncUserForm = InferSchemaType<typeof asyncUserValidator>;

/**
 * Always valid async validator for testing (pass-through)
 */
export const alwaysValidAsyncValidator: MaybeAsyncValidator<
  unknown,
  Record<string, unknown>
> = async (input) => {
  await new Promise((resolve) => setTimeout(resolve, 10));
  return ok(input as Record<string, unknown>);
};

/**
 * Always invalid async validator for testing
 */
export const alwaysInvalidAsyncValidator: MaybeAsyncValidator<
  unknown,
  never
> = async () => {
  await new Promise((resolve) => setTimeout(resolve, 10));
  return err([{ path: ['root'], message: 'Async validation failed' }]);
};

// =============================================================================
// Standard Schema v1 Mock Validators
// =============================================================================

/**
 * Sync Standard Schema v1 mock that validates UserForm shape.
 * Does NOT depend on any external schema library.
 */
export const standardSchemaUserValidator: StandardSchemaV1<unknown, UserForm> =
  {
    '~standard': {
      version: 1,
      vendor: 'test',
      validate: (value) => {
        const v = value as Partial<UserForm>;
        const issues: StandardSchemaV1.Issue[] = [];
        if (!v.name)
          issues.push({ message: 'Name is required', path: ['name'] });
        if (!v.email?.includes('@'))
          issues.push({ message: 'Email must be valid', path: ['email'] });
        if (v.age == null || v.age < 18)
          issues.push({ message: 'Must be 18 or older', path: ['age'] });
        return issues.length ? { issues } : { value: v as UserForm };
      },
    },
  };

/**
 * Async Standard Schema v1 mock that simulates async validation.
 * Name 'taken' is rejected.
 */
export const asyncStandardSchemaUserValidator: StandardSchemaV1<
  unknown,
  UserForm
> = {
  '~standard': {
    version: 1,
    vendor: 'test',
    validate: async (value) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      const v = value as Partial<UserForm>;
      const issues: StandardSchemaV1.Issue[] = [];
      if (!v.name) issues.push({ message: 'Name is required', path: ['name'] });
      if (v.name === 'taken')
        issues.push({ message: 'Name is already taken', path: ['name'] });
      if (!v.email?.includes('@'))
        issues.push({ message: 'Email must be valid', path: ['email'] });
      if (v.age == null || v.age < 18)
        issues.push({ message: 'Must be 18 or older', path: ['age'] });
      return issues.length ? { issues } : { value: v as UserForm };
    },
  },
};

/**
 * Standard Schema v1 mock with nested path segments using { key } objects.
 */
export const standardSchemaNestedPathValidator: StandardSchemaV1<
  unknown,
  UserWithAddressForm
> = {
  '~standard': {
    version: 1,
    vendor: 'test',
    validate: (value) => {
      const v = value as Partial<UserWithAddressForm>;
      const issues: StandardSchemaV1.Issue[] = [];
      if (!v.name) issues.push({ message: 'Name is required', path: ['name'] });
      if (!v.address?.street)
        issues.push({
          message: 'Street is required',
          path: [{ key: 'address' }, { key: 'street' }],
        });
      if (!v.address?.city)
        issues.push({
          message: 'City is required',
          path: ['address', 'city'],
        });
      return issues.length ? { issues } : { value: v as UserWithAddressForm };
    },
  },
};
