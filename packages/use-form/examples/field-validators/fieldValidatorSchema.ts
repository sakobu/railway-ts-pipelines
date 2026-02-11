import {
  object,
  required,
  optional,
  chain,
  string,
  nonEmpty,
  minLength,
  email,
  parseNumber,
  parseDate,
  parseBool,
  matches,
  stringEnum,
  array,
  type InferSchemaType,
} from '@railway-ts/pipelines/schema';
import { addressSchema } from '../sync/userSchema';

// Simulated server-side username check — exported for use in fieldValidators
export const checkUsernameAvailable = async (
  username: string
): Promise<boolean> => {
  await new Promise((r) => setTimeout(r, 500));
  return !['admin', 'taken'].includes(username.toLowerCase());
};

// Sync-only schema: username uses chain() instead of chainAsync().
// Async username validation is handled separately via fieldValidators.
export const fieldValidatorUserSchema = object({
  username: required(
    chain(string(), nonEmpty('Username is required'), minLength(3))
  ),
  email: required(chain(string(), nonEmpty('Email is required'), email())),
  password: required(
    chain(string(), nonEmpty('Password is required'), minLength(8))
  ),
  age: required(parseNumber()),
  birthdate: required(parseDate()),
  hasAcceptedTerms: required(
    chain(parseBool(), matches(true, 'You must check this field'))
  ),
  role: required(stringEnum(['admin', 'user'])),
  address: optional(addressSchema),
  contacts: optional(array(stringEnum(['email', 'phone']))),
});

export type FieldValidatorUser = InferSchemaType<
  typeof fieldValidatorUserSchema
>;
